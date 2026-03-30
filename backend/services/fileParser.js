const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extracts raw text from an uploaded resume file (PDF or DOCX).
 * @param {string} filePath - Absolute path to the uploaded file
 * @returns {Promise<string>} - Extracted plain text
 */
async function extractTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    const dataBuffer = fs.readFileSync(filePath);
    const parsed = await pdfParse(dataBuffer);
    return parsed.text;
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

/**
 * Safely deletes a temp uploaded file after processing.
 */
function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn(`[Cleanup] Could not delete temp file: ${filePath}`, err.message);
  }
}

module.exports = { extractTextFromFile, cleanupFile };
