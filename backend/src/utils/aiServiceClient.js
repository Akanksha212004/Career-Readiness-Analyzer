const axios = require("axios");
const FormData = require("form-data");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

const client = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: 60000, // semantic model inference can take a few seconds on first load
});

async function getRoles() {
  const { data } = await client.get("/api/roles");
  return data;
}

async function analyzeResume({ fileBuffer, filename, mimetype, roleId, jobDescription }) {
  const form = new FormData();
  form.append("file", fileBuffer, { filename, contentType: mimetype });
  if (roleId) form.append("role_id", roleId);
  if (jobDescription) form.append("job_description", jobDescription);

  const { data } = await client.post("/api/analyze", form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return data;
}

async function checkJdQuality({ jobDescription, seniority }) {
  const { data } = await client.post("/api/jd-quality", {
    job_description: jobDescription,
    seniority: seniority || undefined,
  });
  return data;
}

async function checkHealth() {
  const { data } = await client.get("/health", { timeout: 5000 });
  return data;
}

module.exports = { getRoles, analyzeResume, checkJdQuality, checkHealth };


