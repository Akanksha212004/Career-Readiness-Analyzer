const { AUTH_COOKIE_NAME, verifyToken } = require("../utils/authUtils");

/**
 * Requires a valid auth cookie. On success, attaches `req.userId` (the
 * MongoDB ObjectId string of the authenticated user, kept for backwards
 * compatibility with existing controllers) as well as `req.user` (id, role,
 * companyId - read straight from the JWT payload, so role-based checks like
 * requireRole don't need an extra DB round-trip) and calls next(). On
 * failure, responds 401 without calling next().
 */
function authMiddleware(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ error: "Not authenticated. Please log in." });
  }

  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    req.user = {
      id: payload.sub,
      role: payload.role,
      companyId: payload.companyId || null,
    };
    return next();
  } catch {
    return res.status(401).json({ error: "Session expired or invalid. Please log in again." });
  }
}

module.exports = authMiddleware;

