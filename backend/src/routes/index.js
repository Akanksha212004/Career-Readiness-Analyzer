const express = require("express");
const rateLimit = require("express-rate-limit");

const upload = require("../middleware/upload");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/requireRole");
const { listRoles } = require("../controllers/rolesController");
const { analyzeResume, getHistory, getAnalysisById } = require("../controllers/analysisController");
const { register, login, logout, me } = require("../controllers/authController");
const {
  getCompanyAnalyses,
  getAnalysisDetail,
  getDashboardStats,
  updateAnalysisStatus,
  getPostingSkillGaps,
} = require("../controllers/adminController");
const {
  createPosting,
  listPostings,
  listPublicPostings,
  updatePosting,
  checkJdQuality,
} = require("../controllers/postingController");
const {
  registerCompany,
  getMyCompany,
  inviteTeammate,
  getInviteInfo,
  acceptInvite,
  listMyInvites,
  declineInvite,
} = require("../controllers/companyController");
const { listCompanies, approveCompany, rejectCompany } = require("../controllers/superAdminController");
const {
  submitRequest,
  listRequests,
  approveRequest,
  rejectRequest,
} = require("../controllers/superAdminRequestController");

const router = express.Router();

// Stricter limiter specifically for auth endpoints, to slow down
// credential-stuffing / brute-force attempts against login and register.
const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts, please try again later." },
});

router.post("/auth/register", authLimiter, register);
router.post("/auth/register-company", authLimiter, registerCompany);
router.post("/auth/login", authLimiter, login);
router.post("/auth/logout", authLimiter, logout);
router.get("/auth/me", authMiddleware, me);

router.get("/roles", listRoles);

router.post("/analyze", authMiddleware, upload.single("file"), analyzeResume);

router.get("/history", authMiddleware, getHistory);
router.get("/analysis/:id", authMiddleware, getAnalysisById);

router.get("/admin/dashboard-stats", authMiddleware, requireRole(["hr", "super_admin"]), getDashboardStats);
router.get("/admin/analyses", authMiddleware, requireRole(["hr", "super_admin"]), getCompanyAnalyses);
router.get("/admin/analyses/:id", authMiddleware, requireRole(["hr", "super_admin"]), getAnalysisDetail);
router.patch(
  "/admin/analyses/:id/status",
  authMiddleware,
  requireRole(["hr", "super_admin"]),
  updateAnalysisStatus
);
router.get(
  "/admin/postings/:id/skill-gaps",
  authMiddleware,
  requireRole(["hr", "super_admin"]),
  getPostingSkillGaps
);

// Student-facing browse of open postings (any authenticated user) - must be
// declared before the HR-scoped routes below only for readability; there's
// no path conflict since GET /postings takes no :id segment.
router.get("/postings/public", authMiddleware, listPublicPostings);

router.post("/postings/jd-quality-check", authMiddleware, requireRole(["hr", "super_admin"]), checkJdQuality);
router.post("/postings", authMiddleware, requireRole(["hr", "super_admin"]), createPosting);
router.get("/postings", authMiddleware, requireRole(["hr", "super_admin"]), listPostings);
router.patch("/postings/:id", authMiddleware, requireRole(["hr", "super_admin"]), updatePosting);

// Team/company settings (hr/super_admin) + public invite-acceptance flow.
// getInviteInfo/acceptInvite are public: the person clicking an invite link
// may not have an account yet, so they can't be gated by authMiddleware.
router.get("/companies/me", authMiddleware, requireRole(["hr", "super_admin"]), getMyCompany);
router.post("/companies/:id/invite", authMiddleware, requireRole(["hr", "super_admin"]), inviteTeammate);
router.get("/companies/invite/:token", getInviteInfo);
router.post("/companies/invite/accept", authLimiter, acceptInvite);

// Pending-invite banner (existing, logged-in users only) - lists/declines
// invites addressed to the caller's own account email.
router.get("/invites/me", authMiddleware, listMyInvites);
router.post("/invites/decline", authMiddleware, declineInvite);

// super_admin-only company approval queue.
router.get("/super-admin/companies", authMiddleware, requireRole(["super_admin"]), listCompanies);
router.patch("/super-admin/companies/:id/approve", authMiddleware, requireRole(["super_admin"]), approveCompany);
router.patch("/super-admin/companies/:id/reject", authMiddleware, requireRole(["super_admin"]), rejectCompany);

// Self-service super_admin promotion: an 'hr' user submits a justification,
// an existing super_admin approves/rejects it (see superAdminRequestController.js).
router.post("/super-admin-requests", authMiddleware, requireRole(["hr"]), submitRequest);
router.get("/super-admin-requests", authMiddleware, requireRole(["super_admin"]), listRequests);
router.patch("/super-admin-requests/:id/approve", authMiddleware, requireRole(["super_admin"]), approveRequest);
router.patch("/super-admin-requests/:id/reject", authMiddleware, requireRole(["super_admin"]), rejectRequest);

module.exports = router;


