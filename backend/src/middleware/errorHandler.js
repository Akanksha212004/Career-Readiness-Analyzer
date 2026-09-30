const multer = require("multer");

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File too large. Max upload size exceeded." });
    }
    return res.status(400).json({ error: err.message });
  }

  if (err.message && err.message.includes("Only PDF and DOCX")) {
    return res.status(400).json({ error: err.message });
  }

  if (err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT") {
    console.error("[error] ai-service unreachable:", err.message);
    return res.status(503).json({ error: "The analysis engine is temporarily unavailable. Please try again shortly." });
  }

  console.error("[error]", err);
  res.status(500).json({ error: "Internal server error." });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

module.exports = { errorHandler, notFoundHandler };
