const axios = require('axios');

const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000';

/**
 * Sends a chat message (and optional context) to the FastAPI chatbot endpoint.
 *
 * FastAPI expected POST /chat body:
 * {
 *   message: string,
 *   role: string,          // target role for context
 *   history: [             // optional conversation history
 *     { role: 'user' | 'assistant', content: string }
 *   ]
 * }
 *
 * FastAPI expected response:
 * { reply: string }
 */
async function getChatReply(message, role, history = []) {
  const response = await axios.post(
    `${ML_API_URL}/chat`,
    { message, role, history },
    {
      timeout: 20000,
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const reply = response.data?.reply || response.data?.message || '';
  if (!reply) throw new Error('Empty reply from ML chatbot');
  return reply;
}

/**
 * Fallback static responses for common career questions
 * Used when the ML chatbot is unavailable.
 */
const fallbackReplies = [
  'Focus on building real-world projects and contributing to open source to strengthen your resume.',
  'Make sure your resume is ATS-friendly: use standard section headings, avoid tables, and include keywords from the job description.',
  'A strong GitHub profile with regular commits and documented projects can significantly boost your application.',
  'Tailor your resume for each role by highlighting the most relevant skills and experiences.',
  'Practice coding problems on LeetCode and HackerRank alongside your technical skill development.',
];

function getFallbackReply() {
  return fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
}

module.exports = { getChatReply, getFallbackReply };
