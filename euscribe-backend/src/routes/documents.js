const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Document = require("../models/Document");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const sanitizeHtml = require("sanitize-html");

// Memory storage = file never touches disk, just lives in RAM during the request.

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// Strips dangerous tags/attributes (script, onerror, etc.) while keeping
// the formatting tags the editor actually uses.
function cleanContent(html) {
  return sanitizeHtml(html || "", {
    allowedTags: [
      "p", "br", "b", "strong", "i", "em", "u", "s", "strike",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li", "blockquote", "a", "span", "div",
      "table", "thead", "tbody", "tr", "th", "td",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      span: ["style"],
      div: ["style"],
      table: ["style"],
      td: ["style", "colspan", "rowspan"],
      th: ["style", "colspan", "rowspan"],
    },
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{3,6}$/i, /^rgb/],
        "background-color": [/^#[0-9a-f]{3,6}$/i, /^rgb/],
        "text-align": [/^left$|^right$|^center$/],
        "font-weight": [/^bold$|^normal$|^\d+$/],
      },
    },
  });
}

// Counts words in HTML content by stripping tags first
function countWords(html) {
  const text = String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

// GET /api/documents  (list only — no content, keeps this fast)
router.get("/", auth, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const docs = await Document.find({ userId: req.user.id })
      .select('title createdAt updatedAt wordCount')
      .sort({ updatedAt: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/documents/:id  (fetch one document's full content, on demand)
router.get("/:id", auth, async (req, res) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, userId: req.user.id });
    if (!doc) return res.status(404).json({ message: "Document not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/documents
router.post("/", auth, async (req, res) => {
  try {
    const { title, content } = req.body;
    const cleanedContent = cleanContent(content);
    const doc = await Document.create({
      userId: req.user.id,
      title,
      content: cleanedContent,
      wordCount: countWords(cleanedContent),
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/documents/upload
// Accepts a single PDF or DOCX file, extracts its text, and saves it as a new document.
router.post("/upload", auth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { originalname, mimetype, buffer } = req.file;
    let extractedText = "";

    if (mimetype === "application/pdf") {
      const parsed = await pdfParse(buffer, { max: 0 });

      // Split into raw lines first
      const rawLines = parsed.text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const paragraphs = [];
      let paraBuffer = "";

      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];

        if (/^(page\s*)?\d+(\s*of\s*\d+)?$/i.test(line)) continue;

        if (!paraBuffer) {
          paraBuffer = line;
          continue;
        }

        const buffEndsSentence = /[.!?:]$/.test(paraBuffer);
        const lineStartsCapital = /^[A-Z0-9"“]/.test(line);
        const looksLikeHeading =
          line.length < 60 && /^[A-Z0-9][^.]*$/.test(line) && !buffEndsSentence;

        if (buffEndsSentence && lineStartsCapital) {
          paragraphs.push(paraBuffer);
          paraBuffer = line;
        } else if (looksLikeHeading) {
          paragraphs.push(paraBuffer);
          paragraphs.push(line);
          paraBuffer = "";
        } else {
          paraBuffer += " " + line;
        }
      }
      if (paraBuffer) paragraphs.push(paraBuffer);

      extractedText = paragraphs
        .map((block) => `<p>${block.trim()}</p>`)
        .join("");
    } else if (
      mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.convertToHtml({
        buffer,
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Heading 4'] => h4:fresh",
          "p[style-name='Heading 5'] => h5:fresh",
          "p[style-name='Heading 6'] => h6:fresh",
        ],
      });
      extractedText = result.value;
    } else {
      return res.status(400).json({
        message: "Unsupported file type. Please upload a PDF or DOCX file.",
      });
    }

    const cleanedContent = cleanContent(extractedText);

    // Strip the extension for a cleaner default title
    const title = originalname.replace(/\.(pdf|docx)$/i, "");

    const doc = await Document.create({
      userId: req.user.id,
      title,
      content: cleanedContent,
      wordCount: countWords(cleanedContent),
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error("Upload parse error:", err);
    res.status(500).json({ message: "Failed to process the uploaded file" });
  }
});

//Express error-handling middleware needs 4 args
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(413)
        .json({ message: "File is too large. Max size is 25MB." });
    }
    return res.status(400).json({ message: err.message });
  }
  next(err);
});

// PUT /api/documents/:id
router.put("/:id", auth, async (req, res) => {
  try {
    const updates = { ...req.body };
    if (typeof updates.content === "string") {
      updates.content = cleanContent(updates.content);
      updates.wordCount = countWords(updates.content);
    }
    const doc = await Document.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      updates,
      { new: true },
    );
    if (!doc) return res.status(404).json({ message: "Document not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/documents/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    const doc = await Document.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!doc) return res.status(404).json({ message: "Document not found" });
    res.json({ message: "Document deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;