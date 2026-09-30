/**
 * Role gate. Must run after authMiddleware (relies on req.user.role, which
 * authMiddleware populates from the JWT). Responds 403 if the authenticated
 * user's role isn't one of `allowedRoles`; otherwise calls next().
 *
 * Usage: router.get("/admin/analyses", authMiddleware, requireRole(["hr", "super_admin"]), handler);
 */
function requireRole(allowedRoles) {
  return function (req, res, next) {
    const role = req.user?.role;

    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({ error: "You do not have permission to access this resource." });
    }

    return next();
  };
}

module.exports = requireRole;

