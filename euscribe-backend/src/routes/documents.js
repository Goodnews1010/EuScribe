const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Document = require('../models/Document');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// Memory storage = file never touches disk, just lives in RAM during the request.

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});;

// GET /api/documents
router.get('/', auth, async (req, res) => {
  try {
    const docs = await Document.find({ userId: req.user.id }).sort({ updatedAt: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/documents
router.post('/', auth, async (req, res) => {
  try {
    const { title, content } = req.body;
    const doc = await Document.create({ userId: req.user.id, title, content });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/documents/upload
// Accepts a single PDF or DOCX file, extracts its text, and saves it as a new document.
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { originalname, mimetype, buffer } = req.file;
    let extractedText = '';

    if (mimetype === 'application/pdf') {
  const pdfParseFunc = typeof pdfParse === 'function' ? pdfParse : pdfParse.default;
  const parsed = await pdfParseFunc(buffer, { max: 0 });
  extractedText = parsed.text
    .split(/\n{2,}/)
    .map(block => block.replace(/\n/g, ' ').trim())
    .filter(Boolean)
    .map(block => `<p>${block}</p>`)
    .join('');
} else if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      const result = await mammoth.convertToHtml({ buffer });
      extractedText = result.value;
    } else {
      return res.status(400).json({
        message: 'Unsupported file type. Please upload a PDF or DOCX file.',
      });
    }

    // Strip the extension for a cleaner default title
    const title = originalname.replace(/\.(pdf|docx)$/i, '');

    const doc = await Document.create({
      userId: req.user.id,
      title,
      content: extractedText,
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error('Upload parse error:', err);
    res.status(500).json({ message: 'Failed to process the uploaded file' });
  }
});
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    // ... rest of your existing code
  } catch (err) {
    console.error('Upload parse error:', err);
    res.status(500).json({ message: 'Failed to process the uploaded file' });
  }
});

//Express error-handling middleware needs 4 args
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'File is too large. Max size is 25MB.' });
    }
    return res.status(400).json({ message: err.message });
  }
  next(err);
});
// PUT /api/documents/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const doc = await Document.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { ...req.body },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/documents/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const doc = await Document.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    res.json({ message: 'Document deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;