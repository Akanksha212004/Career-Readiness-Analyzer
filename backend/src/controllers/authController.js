const User = require("../models/User");
const {
  AUTH_COOKIE_NAME,
  MIN_PASSWORD_LENGTH,
  isValidPassword,
  hashPassword,
  verifyPassword,
  signToken,
  authCookieOptions,
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

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Name is required." });
    }
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required." });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await hashPassword(password);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
    });

    const token = signToken(user);
    res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());

    res.status(201).json({ user: toPublicUser(user) });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: "Invalid registration details." });
    }
    if (err.code === 11000) {
      // Race condition on the unique index - same outcome as the pre-check above.
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Same generic error for "no such user" and "wrong password" so we
    // never leak which one was incorrect.
    const genericError = { error: "Invalid email or password." };

    const user = await User.findOne({ email: normalizedEmail }).select("+passwordHash");
    if (!user) {
      return res.status(401).json(genericError);
    }

    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json(genericError);
    }

    const token = signToken(user);
    res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());

    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

async function logout(_req, res) {
  res.clearCookie(AUTH_COOKIE_NAME, { ...authCookieOptions(), maxAge: undefined });
  res.json({ success: true });
}

async function me(req, res, next) {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) {
      return res.status(401).json({ error: "Not authenticated." });
    }
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, logout, me };


