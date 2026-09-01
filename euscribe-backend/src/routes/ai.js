const express = require("express");
const router = express.Router();

/**
 * Strips Markdown syntax from AI-generated text so it renders as clean
 * plain text in EuScribe's editor.
 */
function sanitizeMarkdown(text) {
  if (!text) return text;

  let clean = text;

  clean = clean.replace(/^#{1,6}\s*(.+)$/gm, (match, content) => {
    return content.trim().toUpperCase();
  });

  clean = clean.replace(/\*\*(.+?)\*\*/g, "$1");
  clean = clean.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "$1");
  clean = clean.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, "$1");
  clean = clean.replace(/^[\*\-]\s+/gm, "• ");
  clean = clean.replace(/`([^`]+)`/g, "$1");
  clean = clean.replace(/```[a-zA-Z]*\n?/g, "");
  clean = clean.replace(/^([\-\*_]){3,}$/gm, "=".repeat(40));
  clean = clean.replace(/\n{3,}/g, "\n\n");

  return clean.trim();
}

function isTransientError(status, bodyText) {
  if (status === 503 || status === 429) return true;
  if (bodyText && /UNAVAILABLE|overloaded|rate.?limit/i.test(bodyText)) return true;
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchGeminiWithRetry(geminiUrl, body, maxRetries = 2) {
  let lastErrText = "";
  let lastStatus = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) return res;

    lastStatus = res.status;
    lastErrText = await res.text();

    // LOGGING: show exactly what Gemini returned on each attempt
    console.error(
      `[ai.js] Gemini attempt ${attempt + 1}/${maxRetries + 1} failed — status ${lastStatus}:`,
      lastErrText.slice(0, 500),
    );

    const transient = isTransientError(res.status, lastErrText);
    const isLastAttempt = attempt === maxRetries;

    if (!transient || isLastAttempt) {
      const err = new Error("Gemini request failed");
      err.transient = transient;
      err.status = lastStatus;
      err.body = lastErrText;
      throw err;
    }

    await sleep(1000 * Math.pow(2, attempt));
  }
}

async function fallbackToGroq(messages, res) {
  console.log("[ai.js] Attempting Groq fallback...");

  if (!process.env.GROQ_API_KEY) {
    console.error("[ai.js] GROQ_API_KEY is missing from environment!");
    throw new Error("GROQ_API_KEY not configured");
  }

  const groqRes = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages,
        max_tokens: 1000,
      }),
    },
  );

  if (!groqRes.ok) {
    const errText = await groqRes.text();
    console.error(`[ai.js] Groq fallback failed — status ${groqRes.status}:`, errText.slice(0, 500));
    throw new Error(`Groq fallback also failed (${groqRes.status})`);
  }

  const data = await groqRes.json();
  const text = data.choices?.[0]?.message?.content || "";
  const cleaned = sanitizeMarkdown(text);

  console.log("[ai.js] Groq fallback succeeded.");

  res.write(
    `data: ${JSON.stringify({ choices: [{ delta: { content: cleaned } }] })}\n\n`,
  );
  res.write(`data: ${JSON.stringify({ final: true, cleaned })}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
}

// POST /api/ai/complete  (non-streaming — kept for backward compatibility)
router.post("/complete", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ message: "Prompt is required" });

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1000,
        }),
      },
    );

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    res.json({ result: sanitizeMarkdown(text) });
  } catch (err) {
    console.error("[ai.js] /complete failed:", err.message);
    res.status(500).json({ message: "AI request failed", error: err.message });
  }
});

// POST /api/ai/stream  (streaming — used by the new chat UI)
router.post("/stream", async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ message: "messages array is required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`;

  let geminiRes;
  try {
    geminiRes = await fetchGeminiWithRetry(geminiUrl, { contents }, 2);
  } catch (err) {
    console.error("[ai.js] Gemini failed after all retries:", err.status, err.body?.slice(0, 500));

    if (err.transient) {
      try {
        await fallbackToGroq(messages, res);
        return;
      } catch (fallbackErr) {
        console.error("[ai.js] Fallback to Groq also failed:", fallbackErr.message);
        res.write(
          `data: ${JSON.stringify({
            error: "AI is currently unavailable. Please try again shortly.",
          })}\n\n`,
        );
        res.end();
        return;
      }
    }

    res.write(
      `data: ${JSON.stringify({
        error: "AI request failed. Please try again.",
      })}\n\n`,
    );
    res.end();
    return;
  }

  try {
    const reader = geminiRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    req.on("close", () => reader.cancel());

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop();

      for (const line of parts) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.replace("data: ", "").trim();
        if (!jsonStr) continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const token = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
          fullText += token;
          res.write(
            `data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`,
          );
        } catch (_) {
          // skip malformed line
        }
      }
    }

    const cleanedFullText = sanitizeMarkdown(fullText);
    res.write(
      `data: ${JSON.stringify({ final: true, cleaned: cleanedFullText })}\n\n`,
    );
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("[ai.js] Error while reading Gemini stream:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ message: "Streaming failed", error: err.message });
    } else {
      res.write(
        `data: ${JSON.stringify({
          error: "AI is currently unavailable. Please try again shortly.",
        })}\n\n`,
      );
      res.end();
    }
  }
});

module.exports = router;