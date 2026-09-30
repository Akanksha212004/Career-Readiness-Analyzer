const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

/**
 * Lightweight text preview extraction, used only for a fast sanity check
 * (is this actually a parseable resume?) and an optional UI preview. The
 * authoritative extraction + ATS structural analysis happens in ai-service
 * via pdfplumber/python-docx, since that's the layer that needs raw file
 * structure, not just plain text.
 */
async function extractPreviewText(fileBuffer, mimetype) {
  try {
    if (mimetype === "application/pdf") {
      const result = await pdfParse(fileBuffer);
      return result.text.trim();
    }
    if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return result.value.trim();
    }
    return "";
  } catch (err) {
    console.warn("[textPreview] extraction failed:", err.message);
    return "";
  }
}

module.exports = { extractPreviewText };
