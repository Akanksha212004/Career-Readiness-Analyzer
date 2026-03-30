/**
 * Centralized Express error handler.
 * Catches errors from all routes and returns a consistent JSON shape.
 */
function errorHandler(err, req, res, next) {
  // Multer-specific errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: `File too large. Maximum allowed size is ${process.env.MAX_FILE_SIZE_MB || 10}MB.`,
    });
  }

  if (err.message?.includes('Only PDF and DOCX')) {
    return res.status(415).json({ error: err.message });
  }

  // Axios / network errors when calling ML API
  if (err.isAxiosError) {
    const status = err.response?.status;
    const detail = err.response?.data?.detail || err.message;
    console.error('[Axios Error]', status, detail);
    return res.status(502).json({
      error: 'ML service error',
      detail,
    });
  }

  // Generic server error
  console.error('[Unhandled Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
}

module.exports = { errorHandler };
