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
// Returns: SSE stream (text/event-stream), reformatted from Gemini into
// OpenAI-style delta chunks so the frontend parser doesn't need to change
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

    // Convert OpenAI-style messages into Gemini's "contents" format.
    // Gemini uses "model" instead of "assistant" for the AI role.
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      res.write(`data: ${JSON.stringify({ error: errText })}\n\n`);
      res.end();
      return;
    }

    // Stream and reformat Gemini's chunks into the shape the frontend expects
    const reader = geminiRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // If client disconnects, stop reading
    req.on('close', () => reader.cancel());

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop(); // last piece may be incomplete — save for next read

      for (const line of parts) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.replace('data: ', '').trim();
        if (!jsonStr) continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const token = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`);
        } catch (_) {
          // skip malformed line
        }
      }
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