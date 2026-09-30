require("dotenv").config();

const createApp = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB();
  } catch (err) {
    console.error("[startup] Failed to connect to MongoDB:", err.message);
    console.error("[startup] Check MONGODB_URI in your .env file. Exiting.");
    process.exit(1);
  }

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[server] Career Readiness Analyzer backend running on port ${PORT}`);
  });
}

start();
