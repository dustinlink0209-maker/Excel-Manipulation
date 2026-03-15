import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '..', 'uploads');

/**
 * Sanitize a file ID from user input to prevent path traversal.
 * Returns null if the ID would escape the uploads directory.
 */
export function sanitizeFileId(id) {
  if (typeof id !== 'string' || !id) return null;

  // Strip null bytes and resolve to just the basename (removes any directory separators)
  const safe = path.basename(id.replace(/\0/g, ''));
  if (!safe) return null;

  // Double-check the resolved path stays inside uploads
  const resolved = path.resolve(uploadsDir, safe + '.meta.json');
  if (!resolved.startsWith(uploadsDir + path.sep) && resolved !== uploadsDir) {
    return null;
  }

  return safe;
}

/**
 * Send a safe error response — generic message to client, real error to server log.
 */
export function safeError(res, status, publicMessage, internalError) {
  if (internalError) {
    console.error(`[${status}] ${publicMessage}:`, internalError);
  }
  return res.status(status).json({ error: publicMessage });
}

/**
 * Simple in-memory rate limiter middleware factory.
 * @param {number} maxRequests - Max requests allowed per window
 * @param {number} windowMs - Window size in milliseconds
 */
export function createRateLimiter(maxRequests = 10, windowMs = 60_000) {
  const clients = new Map();

  // Periodically clean up stale entries
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of clients) {
      if (now > record.resetAt) clients.delete(key);
    }
  }, windowMs);

  return function rateLimitMiddleware(req, res, next) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const record = clients.get(ip);

    if (!record || now > record.resetAt) {
      clients.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    record.count++;
    next();
  };
}
