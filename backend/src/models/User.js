const mongoose = require("mongoose");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A registered user account. Passwords are never stored in plaintext -
 * `passwordHash` holds a bcrypt hash only, and is excluded from query
 * results by default (`select: false`) so it can never accidentally leak
 * into an API response.
 */
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) => EMAIL_REGEX.test(v),
        message: "Please provide a valid email address.",
      },
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Coarse-grained access role. 'student' is the default for everyone who
    // signs up through the normal flow; 'hr' and 'super_admin' are granted
    // out-of-band (no public self-signup path for elevated roles yet).
    role: {
      type: String,
      enum: ["student", "hr", "super_admin"],
      default: "student",
    },
    // Which company this user belongs to. Only meaningful for 'hr' users
    // (scopes which company's analyses they can see via /api/admin/analyses);
    // left unset for students.
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: false,
    },
  },
  { timestamps: true }
);

// toJSON transform is a second line of defense: even if a caller forgets to
// `.select("-passwordHash")` somewhere, it can never leave the process.
userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);

