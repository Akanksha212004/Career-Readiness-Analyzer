const Company = require("../models/Company");
const CompanyMember = require("../models/CompanyMember");
const User = require("../models/User");
const {
  AUTH_COOKIE_NAME,
  MIN_PASSWORD_LENGTH,
  isValidPassword,
  hashPassword,
  signToken,
  authCookieOptions,
  verifyToken,
} = require("../utils/authUtils");

function toPublicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId || null,
  };
}

function toPublicCompany(company) {
  return {
    id: company._id,
    name: company.name,
    domain: company.domain,
    status: company.status,
    createdAt: company.createdAt,
  };
}

/** Shape returned by listMyInvites - deliberately includes the raw
 * inviteToken so the pending-invite banner can call the existing
 * acceptInvite/declineInvite endpoints directly. Safe to expose here only
 * because this list is already scoped server-side to invites whose
 * invitedEmail matches the *authenticated* caller's own email. */
function toPublicMyInvite(invite) {
  return {
    id: invite._id,
    token: invite.inviteToken,
    companyName: invite.companyId?.name || "this company",
    subRole: invite.subRole,
    createdAt: invite.createdAt,
  };
}

/**
 * Public: an HR user signs up AND creates their company in one step. The
 * company always starts 'pending' (Company.js default) - a super_admin has
 * to approve it (see superAdminController.js) before it can post openings
 * that students can see/apply to (see postingController.js gating).
 *
 * The signing-up user becomes that company's first team member with
 * subRole "hr_admin" (can invite further teammates - see inviteTeammate).
 */
async function registerCompany(req, res, next) {
  try {
    const { name, email, password, companyName, companyDomain } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Your name is required." });
    }
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required." });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }
    if (!companyName || typeof companyName !== "string" || !companyName.trim()) {
      return res.status(400).json({ error: "Company name is required." });
    }
    if (!companyDomain || typeof companyDomain !== "string" || !companyDomain.trim()) {
      return res.status(400).json({ error: "Company domain is required." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await hashPassword(password);

    const company = await Company.create({
      name: companyName.trim(),
      domain: companyDomain.trim().toLowerCase(),
      status: "pending",
    });

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "hr",
      companyId: company._id,
    });

    await CompanyMember.create({
      companyId: company._id,
      userId: user._id,
      subRole: "hr_admin",
      status: "active",
      invitedEmail: normalizedEmail,
    });

    const token = signToken(user);
    res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());

    res.status(201).json({ user: toPublicUser(user), company: toPublicCompany(company) });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 11000) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    next(err);
  }
}

/**
 * hr/super_admin only: the caller's own company profile + its team roster,
 * for the /admin/team settings page.
 */
async function getMyCompany(req, res, next) {
  try {
    if (!req.user.companyId) {
      return res.status(404).json({ error: "Your account is not associated with a company." });
    }

    const company = await Company.findById(req.user.companyId).lean();
    if (!company) {
      return res.status(404).json({ error: "Company not found." });
    }

    const members = await CompanyMember.find({ companyId: req.user.companyId })
      .populate("userId", "name email")
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      company: toPublicCompany(company),
      members: members.map((m) => ({
        id: m._id,
        userId: m.userId?._id || null,
        name: m.userId?.name || null,
        email: m.userId?.email || m.invitedEmail,
        subRole: m.subRole,
        status: m.status,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * hr/super_admin only: invite a teammate to the caller's own company by
 * email. There's no email-sending infrastructure in this app yet, so this
 * returns the raw invite token/link for the HR user to share manually
 * (Slack, email client, etc.) - see the "inviteUrl" note on the response.
 * Only an existing "hr_admin" teammate may invite (checked via
 * CompanyMember, not just the coarse User.role).
 */
async function inviteTeammate(req, res, next) {
  try {
    if (!req.user.companyId || String(req.user.companyId) !== String(req.params.id)) {
      return res.status(403).json({ error: "You can only invite teammates to your own company." });
    }

    const requesterMembership = await CompanyMember.findOne({
      companyId: req.user.companyId,
      userId: req.userId,
      status: "active",
    }).lean();

    if (!requesterMembership || requesterMembership.subRole !== "hr_admin") {
      return res.status(403).json({ error: "Only company admins can invite teammates." });
    }

    const { email, subRole } = req.body;
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ error: "An email address is required." });
    }
    if (subRole && !CompanyMember.SUB_ROLES.includes(subRole)) {
      return res.status(400).json({ error: `subRole must be one of: ${CompanyMember.SUB_ROLES.join(", ")}.` });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const alreadyMember = await CompanyMember.findOne({
      companyId: req.user.companyId,
      invitedEmail: normalizedEmail,
    }).lean();
    if (alreadyMember) {
      return res.status(409).json({ error: "This email has already been invited to your company." });
    }

    const inviteToken = CompanyMember.generateInviteToken();

    const invite = await CompanyMember.create({
      companyId: req.user.companyId,
      invitedEmail: normalizedEmail,
      invitedBy: req.userId,
      subRole: subRole || "hr_viewer",
      status: "invited",
      inviteToken,
    });

    res.status(201).json({
      invite: {
        id: invite._id,
        email: invite.invitedEmail,
        subRole: invite.subRole,
        inviteToken,
        // Frontend builds the shareable URL as `${origin}/join?token=...`;
        // sent back here too as a convenience for API consumers.
        inviteUrl: `/join?token=${inviteToken}`,
      },
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

/**
 * Public: look up basic, non-sensitive info about a pending invite (company
 * name, invited email) so the /join page can show the person what they're
 * accepting before they submit the acceptance form.
 */
async function getInviteInfo(req, res, next) {
  try {
    const invite = await CompanyMember.findOne({ inviteToken: req.params.token, status: "invited" })
      .populate("companyId", "name")
      .lean();

    if (!invite) {
      return res.status(404).json({ error: "This invite link is invalid or has already been used." });
    }

    res.json({
      companyName: invite.companyId?.name || "this company",
      invitedEmail: invite.invitedEmail,
      subRole: invite.subRole,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Public: accept a team invite. Two paths, depending on whether the person
 * already has an account:
 *  - Already logged in (valid auth cookie) with an email matching the
 *    invite: their existing account is elevated to 'hr' + linked to the
 *    company.
 *  - Not logged in: name + password are required and a brand-new 'hr'
 *    account is created for the invited email.
 * Either way, a fresh cookie is issued so the elevated role/companyId take
 * effect immediately (the JWT embeds both - see authUtils.signToken).
 */
async function acceptInvite(req, res, next) {
  try {
    const { token, name, password } = req.body;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Invite token is required." });
    }

    const invite = await CompanyMember.findOne({ inviteToken: token, status: "invited" });
    if (!invite) {
      return res.status(404).json({ error: "This invite link is invalid or has already been used." });
    }

    // Optional-auth: check for an existing session without requiring one.
    let loggedInUser = null;
    const existingCookieToken = req.cookies?.[AUTH_COOKIE_NAME];
    if (existingCookieToken) {
      try {
        const payload = verifyToken(existingCookieToken);
        loggedInUser = await User.findById(payload.sub);
      } catch {
        // Invalid/expired cookie - fall through to the fresh-signup path.
      }
    }

    let user;
    if (loggedInUser) {
      if (loggedInUser.email !== invite.invitedEmail) {
        return res.status(403).json({
          error: "This invite was sent to a different email address. Log out and try again, or sign up fresh.",
        });
      }
      loggedInUser.role = "hr";
      loggedInUser.companyId = invite.companyId;
      await loggedInUser.save();
      user = loggedInUser;
    } else {
      const existing = await User.findOne({ email: invite.invitedEmail }).lean();
      if (existing) {
        return res.status(409).json({
          error: "An account with this email already exists. Log in first, then open this invite link again.",
        });
      }
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Your name is required." });
      }
      if (!isValidPassword(password)) {
        return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
      }

      const passwordHash = await hashPassword(password);
      user = await User.create({
        name: name.trim(),
        email: invite.invitedEmail,
        passwordHash,
        role: "hr",
        companyId: invite.companyId,
      });
    }

    invite.userId = user._id;
    invite.status = "active";
    invite.inviteToken = undefined;
    await invite.save();

    const token2 = signToken(user);
    res.cookie(AUTH_COOKIE_NAME, token2, authCookieOptions());

    res.json({ user: toPublicUser(user) });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 11000) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    next(err);
  }
}

/**
 * Authenticated (any role): lists pending team invites addressed to the
 * caller's own email - the "pending invite" banner on every page polls
 * this. Deliberately scoped to *existing, logged-in* users only (matched by
 * their account email); someone who doesn't have an account yet still has
 * to use the shared invite link (see getInviteInfo/acceptInvite above).
 */
async function listMyInvites(req, res, next) {
  try {
    const currentUser = await User.findById(req.userId).select("email").lean();
    if (!currentUser) {
      return res.status(404).json({ error: "User not found." });
    }

    const invites = await CompanyMember.find({ invitedEmail: currentUser.email, status: "invited" })
      .populate("companyId", "name")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ invites: invites.map(toPublicMyInvite) });
  } catch (err) {
    next(err);
  }
}

/**
 * Authenticated (any role): declines a pending invite addressed to the
 * caller's own email. No role change happens - the invite is simply marked
 * "declined" so it stops showing on the banner and Jane's Team roster shows
 * the outcome instead of it sitting as "Invited" forever.
 */
async function declineInvite(req, res, next) {
  try {
    const { token } = req.body;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Invite token is required." });
    }

    const invite = await CompanyMember.findOne({ inviteToken: token, status: "invited" });
    if (!invite) {
      return res.status(404).json({ error: "This invite link is invalid or has already been used." });
    }

    const currentUser = await User.findById(req.userId).select("email").lean();
    if (!currentUser || currentUser.email !== invite.invitedEmail) {
      return res.status(403).json({ error: "This invite was sent to a different email address." });
    }

    invite.status = "declined";
    invite.inviteToken = undefined;
    await invite.save();

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerCompany,
  getMyCompany,
  inviteTeammate,
  getInviteInfo,
  acceptInvite,
  listMyInvites,
  declineInvite,
};

