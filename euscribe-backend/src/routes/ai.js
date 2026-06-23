const express = require('express');
const router = express.Router();

// POST /api/ai/complete  (non-streaming — kept for backward compatibility)
router.post('/complete', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ message: 'Prompt is required' });

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

// POST /api/ai/stream  (streaming — used by the new chat UI)
// Accepts: { messages: [{ role, content }] }  — full conversation history
// Returns: SSE stream (text/event-stream) forwarded directly from Groq
router.post('/stream', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: 'messages array is required' });
    }

    // Set SSE headers before touching the body
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if behind proxy

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,           // full history — enables multi-turn context
        max_tokens: 1000,
        stream: true        // enables SSE from Groq
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      res.write(`data: ${JSON.stringify({ error: errText })}\n\n`);
      res.end();
      return;
    }

    // Pipe Groq's SSE stream straight through to the client
    const reader = groqRes.body.getReader();
    const decoder = new TextDecoder();

    // If client disconnects, stop reading
    req.on('close', () => reader.cancel());

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk); // already formatted as SSE lines by Groq
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err) {
    // If headers already sent, can't send JSON error — just end stream
    if (!res.headersSent) {
      res.status(500).json({ message: 'Streaming failed', error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

module.exports = router;