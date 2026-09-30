const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const routes = require("./routes");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const aiServiceClient = require("./utils/aiServiceClient");

function createApp() {
  const app = express();

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((o) => o.trim());

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  const limiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  });
  app.use("/api", limiter);

  app.get("/health", async (req, res) => {
    let aiServiceStatus = "unknown";
    try {
      await aiServiceClient.checkHealth();
      aiServiceStatus = "ok";
    } catch {
      aiServiceStatus = "unreachable";
    }
    res.json({ status: "ok", service: "backend", aiService: aiServiceStatus });
  });

  app.use("/api", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
