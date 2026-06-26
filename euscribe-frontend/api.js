/* ============================================================
   EUSCRIBE — BACKEND API CONNECTOR
   ============================================================ */

const isDev =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";
const API = isDev ? "http://localhost:5000" : "https://euscribe.onrender.com";

function getToken() {
  return localStorage.getItem("euscribe_token");
}

/* ── AUTH GUARD ── */
(function authGuard() {
  if (!getToken()) window.location.href = "euscribe-auth.html";
})();

/* ── User info ── */
(function setUserInfo() {
  const name = localStorage.getItem("euscribe_user_name") || "User";
  const avatar = document.querySelector(".avatar");
  if (avatar) {
    const initials = name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    avatar.textContent = initials;
  }
  const userInfoP = document.querySelector(".user-info p");
  if (userInfoP) userInfoP.textContent = name;
})();

/* ── Logout ── */
document.body.addEventListener("click", async function (e) {
  const btn = e.target.closest(".dropdown button");
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();

  const profileToggle = document.getElementById("profileToggle");
  if (profileToggle) profileToggle.checked = false;

  const confirmed = await euConfirm(
    "You'll need to sign in again to access your documents.",
    {
      title: "Log out of EuScribe?",
      confirmText: "Log out",
      cancelText: "Stay",
      type: "warning",
    },
  );
  if (!confirmed) return;
  localStorage.removeItem("euscribe_token");
  localStorage.removeItem("euscribe_user_name");
  localStorage.removeItem("euscribe_user_email");
  window.location.href = "euscribe-auth.html";
});

/* ── GLOBAL: sync a single doc to MongoDB ── */
async function syncToBackend(localDoc) {
  const token = getToken();
  if (!token || !localDoc) return;
  const idMap = JSON.parse(localStorage.getItem("euscribe_id_map") || "{}");
  try {
    const backendId = idMap[localDoc.id];
    if (backendId) {
      await fetch(`${API}/api/documents/${backendId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: localDoc.name,
          content: localDoc.content,
        }),
      });
    } else {
      const res = await fetch(`${API}/api/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: localDoc.name,
          content: localDoc.content,
        }),
      });
      const data = await res.json();
      if (data._id) {
        idMap[localDoc.id] = data._id;
        localStorage.setItem("euscribe_id_map", JSON.stringify(idMap));
      }
    }
  } catch (err) {
    console.warn("Backend sync failed:", err.message);
  }
}

/* ── GLOBAL: delete a doc from MongoDB ── */
async function deleteFromBackend(localId) {
  const token = getToken();
  if (!token) return;
  const idMap = JSON.parse(localStorage.getItem("euscribe_id_map") || "{}");
  const backendId = idMap[localId];
  if (!backendId) return;
  try {
    await fetch(`${API}/api/documents/${backendId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    delete idMap[localId];
    localStorage.setItem("euscribe_id_map", JSON.stringify(idMap));
  } catch (err) {
    console.warn("Backend delete failed:", err.message);
  }
}

/* ── GLOBAL: load all docs from MongoDB on startup ── */
async function loadDocumentsFromBackend() {
  const token = getToken();
  if (!token) return;
  try {
    const res = await fetch(`${API}/api/documents`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const backendDocs = await res.json();

    const idMap = JSON.parse(localStorage.getItem("euscribe_id_map") || "{}");
    const localDocs = backendDocs.map((doc) => {
      let localId =
        Object.keys(idMap).find((k) => idMap[k] === doc._id) || doc._id;
      idMap[localId] = doc._id;
      return {
        id: localId,
        name: doc.title || "Untitled Document",
        content: doc.content || "",
      };
    });

    localStorage.setItem("euscribe_id_map", JSON.stringify(idMap));
    localStorage.setItem("euscribeDocuments", JSON.stringify(localDocs));

    clearTimeout(window._mongoLoadFallback);

    documents.length = 0;
    localDocs.forEach((d) => documents.push(d));

    if (typeof renderDocuments === "function") renderDocuments();
    if (localDocs.length === 0) {
      if (typeof createNewDocument === "function") createNewDocument();
    } else if (!currentDocId) {
      if (typeof loadDocument === "function") loadDocument(localDocs[0].id);
    }
  } catch (err) {
    console.warn("Could not load documents from backend:", err.message);
  }
}

/* ── Kick off backend load and announcement ── */
loadDocumentsFromBackend();
loadAnnouncement();

/* ============================================================
   AI CONVERSATION HISTORY
   ============================================================ */

// In-memory conversation — persists for the session, cleared on page load.
// Shape: [{ role: "user"|"assistant", content: string }]
let aiConversationHistory = [];
let _currentChatDocId = null; // tracks which doc the chat belongs to

/* ── Save current chat to localStorage ── */
function saveChatHistory(docId) {
  if (!docId) return;
  // Only save last 20 messages to avoid bloat
  const trimmed = aiConversationHistory.slice(-20);
  localStorage.setItem(`euscribe_chat_${docId}`, JSON.stringify(trimmed));
}

/* ── Load chat for a specific document ── */
function loadChatHistory(docId) {
  if (!docId) return;
  _currentChatDocId = docId;

  // Make sure the chat UI exists before we try to render into it
  if (typeof ensureChatUI === "function") ensureChatUI();

  const thread = document.getElementById("ai-chat-thread");

  // Clear the visible thread
  if (thread) thread.innerHTML = "";
  const emptyState = document.getElementById("ai-chat-empty");

  // Load this doc's history from localStorage
  try {
    const stored = localStorage.getItem(`euscribe_chat_${docId}`);
    aiConversationHistory = stored ? JSON.parse(stored) : [];
  } catch {
    aiConversationHistory = [];
  }

  // Rebuild the visible thread from history
  if (aiConversationHistory.length === 0) {
    if (emptyState) emptyState.style.display = "flex";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  // Only render display messages (skip ones with full doc context injected)
  aiConversationHistory.forEach((msg) => {
    if (msg.role === "user") {
      // Show a clean label — strip the doc context block we appended
      const cleanLabel = msg.content
        .replace(/\n\n\[Context:[\s\S]*?\]$/, "")
        .trim();
      appendAIMessage(
        "user",
        cleanLabel.slice(0, 120) + (cleanLabel.length > 120 ? "…" : ""),
      );
    } else {
      const { el } = appendAIMessage("assistant", msg.content);
      if (el) addBubbleActions(el, msg.content);
    }
  });
}

function clearAIHistory() {
  aiConversationHistory = [];
  if (_currentChatDocId) {
    localStorage.removeItem(`euscribe_chat_${_currentChatDocId}`);
  }
  const thread = document.getElementById("ai-chat-thread");
  if (thread) thread.innerHTML = "";
  const emptyState = document.getElementById("ai-chat-empty");
  if (emptyState) emptyState.style.display = "flex";
}
/* ============================================================
   DOCUMENT CONTEXT — gives AI awareness of the current doc
   ============================================================ */

function getDocumentContext() {
  const editor = document.getElementById("content");
  const titleEl = document.querySelector(".file-title");
  if (!editor) return "";

  const title = titleEl ? titleEl.value.trim() : "Untitled Document";
  const text = editor.innerText.trim();

  if (!text) return "";

  // Truncate to ~1500 words to stay within token budget
  const words = text.split(/\s+/);
  const truncated =
    words.length > 1500
      ? words.slice(0, 1500).join(" ") + "\n\n[Document continues…]"
      : text;

  return `\n\n---\nCurrent document: "${title}"\n\n${truncated}\n---`;
}

/* ============================================================
   AI ACTION CARDS
   ============================================================ */
(function setupAICards() {
  const prompts = {
    "Fix Grammar & Spelling": (text) =>
      `Fix all grammar and spelling errors in this text. Return only the corrected text, nothing else:\n\n${text}`,
    "Rewrite for Clarity": (text) =>
      `Rewrite the following text for better clarity and readability. Return only the rewritten text:\n\n${text}`,
    Summarize: (text) =>
      `Summarize the following text into concise key points. Return only the summary:\n\n${text}`,
    "Expand & Elaborate": (text) =>
      `Expand and elaborate on the following text with more detail and depth. Return only the expanded text:\n\n${text}`,
    Formal: (text) =>
      `Rewrite the following text in a formal, professional tone. Return only the rewritten text:\n\n${text}`,
    Casual: (text) =>
      `Rewrite the following text in a casual, relaxed tone. Return only the rewritten text:\n\n${text}`,
    Academic: (text) =>
      `Rewrite the following text in an academic, scholarly style. Return only the rewritten text:\n\n${text}`,
    Friendly: (text) =>
      `Rewrite the following text in a warm, friendly and conversational tone. Return only the rewritten text:\n\n${text}`,
    Persuasive: (text) =>
      `Rewrite the following text to be more persuasive and convincing. Return only the rewritten text:\n\n${text}`,
    Creative: (text) =>
      `Rewrite the following text in a creative, expressive and imaginative style. Return only the rewritten text:\n\n${text}`,
  };

  document.querySelectorAll(".ai-action-card").forEach((card) => {
    const titleEl = card.querySelector(".ai-action-title");
    if (!titleEl) return;
    const title = titleEl.textContent.trim();
    if (title === "Ask Anything") return;
    if (prompts[title]) {
      card.addEventListener("click", function () {
        const selectedText = getSelectedText();
        if (!selectedText) {
          appendAIMessage(
            "assistant",
            "Please select some text in the editor first, then try again.",
            true,
          );
          return;
        }
        const aiPanel = document.getElementById("aiPanel");
        if (
          aiPanel &&
          !aiPanel.classList.contains("open") &&
          window.innerWidth <= 900
        ) {
          aiPanel.classList.add("open");
        }
        callAI(prompts[title](selectedText), title);
      });
    }
  });

  /* ── Ask Anything ── */
  const sendBtn = document.querySelector(".ai-send-btn");
  const aiInput = document.getElementById("aiInput");
  if (sendBtn && aiInput) {
    sendBtn.addEventListener("click", function () {
      const userPrompt = aiInput.value.trim();
      if (!userPrompt) return;
      const selectedText = getSelectedText();
      const fullPrompt = selectedText
        ? `${userPrompt}\n\nHere is the text to work with:\n\n${selectedText}`
        : userPrompt;
      callAI(fullPrompt, userPrompt);
      aiInput.value = "";
    });
    aiInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    });
  }

  /* ── Clear history button ── */
  const clearBtn = document.getElementById("ai-clear-history");
  if (clearBtn) clearBtn.addEventListener("click", clearAIHistory);
})();

/* ============================================================
   ANNOUNCEMENT BANNER
   ============================================================ */
async function loadAnnouncement() {
  const token = getToken();
  if (!token) return;
  try {
    const res = await fetch(`${API}/api/announcement`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setTimeout(loadAnnouncement, 55000);
      return;
    }
    const ann = await res.json();
    if (!ann) return;
    const dismissed = localStorage.getItem("euscribe_dismissed_ann");
    if (dismissed === ann._id) return;
    showAnnouncementBanner(ann);
  } catch (err) {
    setTimeout(loadAnnouncement, 55000);
  }
}

function showAnnouncementBanner(ann) {
  const existing = document.getElementById("euscribe-announcement");
  if (existing) existing.remove();
  const banner = document.createElement("div");
  banner.id = "euscribe-announcement";
  banner.style.cssText = `
    position:fixed;top:0;left:0;right:0;z-index:9999;
    background:linear-gradient(135deg,#1a2a4a,#0d1a30);
    border-bottom:1px solid rgba(79,140,255,0.3);
    padding:10px 20px;display:flex;align-items:center;gap:12px;
    font-family:'DM Sans',sans-serif;font-size:13px;color:#e6edf3;
    box-shadow:0 2px 20px rgba(0,0,0,0.4);animation:slideDown 0.3s ease;
  `;
  banner.innerHTML = `
    <style>@keyframes slideDown{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}</style>
    <span style="font-size:16px;flex-shrink:0">📢</span>
    <span style="flex:1;line-height:1.5">${ann.message}</span>
    <button onclick="dismissAnnouncement('${ann._id}')" style="
      background:none;border:1px solid rgba(255,255,255,0.15);border-radius:6px;
      color:#8898b4;cursor:pointer;font-size:12px;padding:4px 10px;
      font-family:inherit;flex-shrink:0;transition:all 0.15s;
    ">Dismiss</button>
  `;
  document.body.prepend(banner);
  document.body.style.paddingTop =
    (parseInt(document.body.style.paddingTop) || 0) +
    banner.offsetHeight +
    "px";
}

function dismissAnnouncement(id) {
  localStorage.setItem("euscribe_dismissed_ann", id);
  const banner = document.getElementById("euscribe-announcement");
  if (banner) {
    banner.style.transition = "opacity 0.2s, transform 0.2s";
    banner.style.opacity = "0";
    banner.style.transform = "translateY(-100%)";
    setTimeout(() => {
      document.body.style.paddingTop = "";
      banner.remove();
    }, 200);
  }
}

/* ============================================================
   AI CALL — streaming, with conversation history + doc context
   ============================================================ */
async function callAI(prompt, displayLabel = null) {
  const token = getToken();

  // Build the user-facing label shown in the chat thread
  const userLabel =
    displayLabel || prompt.slice(0, 80) + (prompt.length > 80 ? "…" : "");

  // Append document context to the actual prompt sent to AI (invisible to chat UI)
  const docContext = getDocumentContext();
  const fullPrompt = docContext
    ? `${prompt}\n\n[Context: you are assisting a writer. Here is the document they are currently working on for reference:${docContext}]`
    : prompt;

  // Push to history (use fullPrompt for AI accuracy, userLabel for display)
  aiConversationHistory.push({ role: "user", content: fullPrompt });

  // Show user bubble in chat thread
  ensureChatUI();
  appendAIMessage("user", userLabel);

  // Create the AI bubble and get a handle to stream text into it
  const { el: aiBubble, textEl } = appendAIMessage(
    "assistant",
    "",
    false,
    true,
  );

  try {
    const res = await fetch(`${API}/api/ai/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ messages: aiConversationHistory }),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("euscribe_token");
        window.location.href = "euscribe-auth.html";
        return;
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "AI request failed");
    }

    // Stream the response token by token
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    // Remove typing indicator now that stream has started
    const typingIndicator = aiBubble.querySelector(".ai-typing");
    if (typingIndicator) typingIndicator.remove();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      // Groq streams SSE lines: "data: {...}\n\n"
      const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
      for (const line of lines) {
        const jsonStr = line.replace("data: ", "").trim();
        if (jsonStr === "[DONE]") break;
        try {
          const parsed = JSON.parse(jsonStr);
          const token = parsed.choices?.[0]?.delta?.content || "";
          fullResponse += token;
          textEl.textContent = fullResponse;
          scrollChatToBottom();
        } catch (_) {
          /* partial JSON chunk, skip */
        }
      }
    }

    // Save completed response to history for follow-up context
    aiConversationHistory.push({ role: "assistant", content: fullResponse });

    saveChatHistory(_currentChatDocId);

    // Add copy / insert buttons to the completed bubble
    addBubbleActions(aiBubble, fullResponse);
  } catch (err) {
    textEl.textContent = `Error: ${err.message}`;
    aiBubble.style.borderColor = "rgba(255,107,107,0.3)";
    aiBubble.style.background = "rgba(255,107,107,0.06)";
    const typingIndicator = aiBubble.querySelector(".ai-typing");
    if (typingIndicator) typingIndicator.remove();
  }
}

/* ============================================================
   GET SELECTED TEXT
   ============================================================ */
function getSelectedText() {
  const editor = document.getElementById("content");
  const sel = window.getSelection();
  if (sel && sel.toString().trim().length > 0) {
    return sel.toString().trim();
  }
  return editor ? editor.innerText.trim() : "";
}

/* ============================================================
   CHAT THREAD UI
   ============================================================ */

function ensureChatUI() {
  if (document.getElementById("ai-chat-thread")) return;

  // Remove legacy single-result box if present
  const legacy = document.getElementById("ai-result-box");
  if (legacy) legacy.remove();
  const legacySpinner = document.getElementById("ai-loading");
  if (legacySpinner) legacySpinner.remove();

  const header = document.querySelector(".ai-panel-header");
  if (!header) return;

  // Chat thread container
  const thread = document.createElement("div");
  thread.id = "ai-chat-thread";
  thread.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px 14px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    max-height: 420px;
    scroll-behavior: smooth;
  `;

  // Empty state
  const emptyState = document.createElement("div");
  emptyState.id = "ai-chat-empty";
  emptyState.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 32px 16px;
    color: var(--text-muted, #8898b4);
    font-size: 13px;
    text-align: center;
  `;
  emptyState.innerHTML = `
    <span style="font-size:28px;opacity:0.4">✦</span>
    <span>Ask anything, or select text and use an action above.</span>
  `;
  thread.appendChild(emptyState);

  // Clear history button — injected into panel header
  if (!document.getElementById("ai-clear-history")) {
    const clearBtn = document.createElement("button");
    clearBtn.id = "ai-clear-history";
    clearBtn.title = "Clear conversation";
    clearBtn.style.cssText = `
      background: none;
      border: none;
      color: var(--text-muted, #8898b4);
      cursor: pointer;
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 5px;
      transition: color 0.15s, background 0.15s;
      font-family: 'DM Sans', sans-serif;
      white-space: nowrap;
    `;
    clearBtn.textContent = "Clear chat";
    clearBtn.addEventListener("mouseenter", () => {
      clearBtn.style.color = "#e6edf3";
      clearBtn.style.background = "rgba(255,255,255,0.06)";
    });
    clearBtn.addEventListener("mouseleave", () => {
      clearBtn.style.color = "";
      clearBtn.style.background = "";
    });
    clearBtn.addEventListener("click", clearAIHistory);
    header.appendChild(clearBtn);
  }

  header.after(thread);
}

function appendAIMessage(role, text, isError = false, isStreaming = false) {
  const thread = document.getElementById("ai-chat-thread");
  if (!thread) return {};

  // Hide empty state
  const emptyState = document.getElementById("ai-chat-empty");
  if (emptyState) emptyState.style.display = "none";

  const bubble = document.createElement("div");
  const isUser = role === "user";

  bubble.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-self: ${isUser ? "flex-end" : "flex-start"};
    max-width: 88%;
  `;

  const inner = document.createElement("div");
  inner.style.cssText = `
    padding: 10px 13px;
    border-radius: ${isUser ? "12px 12px 3px 12px" : "12px 12px 12px 3px"};
    font-size: 13px;
    line-height: 1.65;
    white-space: pre-wrap;
    word-break: break-word;
    ${
      isUser
        ? "background: rgba(79,140,255,0.15); border: 1px solid rgba(79,140,255,0.25); color: #e6edf3;"
        : isError
          ? "background: rgba(255,107,107,0.08); border: 1px solid rgba(255,107,107,0.2); color: #ff6b6b;"
          : "background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #e6edf3;"
    }
  `;

  const textEl = document.createElement("span");
  textEl.textContent = text;
  inner.appendChild(textEl);

  // Typing indicator (three animated dots) while waiting for stream to start
  if (isStreaming && !text) {
    const typing = document.createElement("span");
    typing.className = "ai-typing";
    typing.style.cssText = `display:inline-flex;gap:3px;align-items:center;padding:2px 0;`;
    typing.innerHTML = `
      <style>
        @keyframes blink{0%,80%,100%{opacity:0.15}40%{opacity:1}}
        .ai-dot{width:5px;height:5px;border-radius:50%;background:currentColor;animation:blink 1.2s infinite;}
        .ai-dot:nth-child(2){animation-delay:0.2s}
        .ai-dot:nth-child(3){animation-delay:0.4s}
      </style>
      <span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span>
    `;
    inner.appendChild(typing);
  }

  bubble.appendChild(inner);
  thread.appendChild(bubble);
  scrollChatToBottom();

  return { el: bubble, textEl };
}

function addBubbleActions(bubbleEl, text) {
  const actions = document.createElement("div");
  actions.style.cssText = `display:flex;gap:6px;flex-wrap:wrap;padding:0 2px;`;

  const copyBtn = document.createElement("button");
  copyBtn.textContent = "Copy";
  styleActionBtn(copyBtn);
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 2000);
    });
  });

  const replaceBtn = document.createElement("button");
  replaceBtn.textContent = "Replace selection";
  styleActionBtn(replaceBtn, true);
  replaceBtn.addEventListener("click", () => {
    const editor = document.getElementById("content");
    editor.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.toString().trim()) {
      sel.getRangeAt(0).deleteContents();
      sel.getRangeAt(0).insertNode(document.createTextNode(text));
    } else {
      document.execCommand("insertText", false, text);
    }
    if (typeof saveCurrentDocument === "function") saveCurrentDocument();
  });

  actions.appendChild(copyBtn);
  actions.appendChild(replaceBtn);
  bubbleEl.appendChild(actions);
}

function styleActionBtn(btn, ghost = false) {
  btn.style.cssText = `
    padding: 5px 11px;
    font-size: 11px;
    font-weight: 600;
    font-family: 'DM Sans', sans-serif;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    ${
      ghost
        ? "background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #8898b4;"
        : "background: linear-gradient(135deg,#4f8cff,#3a7de8); border: none; color: #fff;"
    }
  `;
  btn.addEventListener("mouseenter", () => {
    btn.style.opacity = "0.85";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.opacity = "1";
  });
}

function scrollChatToBottom() {
  const thread = document.getElementById("ai-chat-thread");
  if (thread) thread.scrollTop = thread.scrollHeight;
}

/* ============================================================
   LEGACY SHIMS — keep old showAIResult / showAILoading calls
   working in case anything else in the codebase calls them
   ============================================================ */
function showAILoading(on) {
  // no-op — streaming replaces loading spinner
}
function showAIResult(text, isError = false) {
  ensureChatUI();
  appendAIMessage("assistant", text, isError);
}
function hideAIResult() {
  // no-op — individual bubbles are dismissed via clear chat
}
