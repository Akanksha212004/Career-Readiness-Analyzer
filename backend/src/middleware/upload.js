const multer = require("multer");
const path = require("path");

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
]);
const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx"]);

const maxSize = Number(process.env.MAX_UPLOAD_SIZE_BYTES) || 5 * 1024 * 1024;

const storage = multer.memoryStorage(); // no need to persist raw files to disk; we forward bytes to ai-service and discard

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  // Extension is the primary signal: browsers/tools don't always set a precise
  // mimetype for docx (some send generic application/octet-stream). If the
  // extension is right but the mimetype looks totally unrelated, still allow
  // it through - the ai-service's own parser is the real gatekeeper and will
  // fail cleanly on a genuinely bad file.
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error("Only PDF and DOCX files are supported."));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxSize },
});

module.exports = upload;
