const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const BCRYPT_COST_FACTOR = 12; // >= 10 as required; 12 is a solid modern default
const MIN_PASSWORD_LENGTH = 8;

const AUTH_COOKIE_NAME = "auth_token";

function isValidPassword(password) {
  return typeof password === "string" && password.trim().length >= MIN_PASSWORD_LENGTH;
}

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, BCRYPT_COST_FACTOR);
}

async function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

/**
 * Signs a JWT for the given user. Embeds role and companyId alongside the
 * subject id so authMiddleware/requireRole can authorize requests without an
 * extra DB lookup on every call - `user` should be a User document (or
 * plain object) with `_id`, `role`, and `companyId`.
 */
function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set. Add it to your .env file.");
  }
  return jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
      companyId: user.companyId ? String(user.companyId) : null,
    },
    secret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );
}

function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set. Add it to your .env file.");
  }
  return jwt.verify(token, secret);
}

/**
 * Cookie options for the auth cookie.
 *
 * - httpOnly: JS on the page can never read the token, which is the main
 *   defense against token theft via XSS.
 * - sameSite: "lax" allows normal top-level navigation but blocks the
 *   cookie being sent on most cross-site requests (CSRF mitigation).
 * - secure: cookies marked `secure` are only sent over HTTPS. Locally,
 *   http://localhost is plain HTTP, so this MUST be false in local dev or
 *   the browser will silently refuse to store/send the cookie. Set
 *   COOKIE_SECURE=true in any real (HTTPS) deployment.
 */
function authCookieOptions() {
  const maxAgeDays = Number(process.env.JWT_EXPIRES_IN_DAYS) || 7;
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: maxAgeDays * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

module.exports = {
  AUTH_COOKIE_NAME,
  MIN_PASSWORD_LENGTH,
  isValidPassword,
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  authCookieOptions,
};

