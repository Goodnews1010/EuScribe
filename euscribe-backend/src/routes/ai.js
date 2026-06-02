const express = require('express');
const router = express.Router();

// POST /api/ai/complete
router.post('/complete', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt)
      return res.status(400).json({ message: 'Prompt is required' });

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000
      })
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    res.json({ result: text });

  } catch (err) {
    res.status(500).json({ message: 'AI request failed', error: err.message });
  }
});

module.exports = router;