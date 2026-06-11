/* ============================================================
   EUSCRIBE — BACKEND API CONNECTOR
   ============================================================ */

const API = "https://euscribe.onrender.com";

function getToken() {
  return localStorage.getItem("euscribe_token");
}

/* ── AUTH GUARD ── */
(function authGuard() {
  if (!getToken()) window.location.href = "euscribe-auth.html";
})();

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
        body: JSON.stringify({ title: localDoc.name, content: localDoc.content }),
      });
    } else {
      const res = await fetch(`${API}/api/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: localDoc.name, content: localDoc.content }),
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
      let localId = Object.keys(idMap).find((k) => idMap[k] === doc._id) || doc._id;
      idMap[localId] = doc._id;
      return { id: localId, name: doc.title || "Untitled Document", content: doc.content || "" };
    });

    localStorage.setItem("euscribe_id_map", JSON.stringify(idMap));
    localStorage.setItem("euscribeDocuments", JSON.stringify(localDocs));

    clearTimeout(window._mongoLoadFallback);
    window.documents = localDocs;
    documents = localDocs;

    if (typeof renderDocuments === "function") renderDocuments();

    // Only auto-open a doc if nothing is open yet
    if (!currentDocId) {
      if (localDocs.length > 0 && typeof loadDocument === "function") {
        loadDocument(localDocs[0].id);
      } else if (localDocs.length === 0 && typeof createNewDocument === "function") {
        createNewDocument();
      }
    }
  } catch (err) {
    console.warn("Could not load documents from backend:", err.message);
  }
}

/* ============================================================
   DOM READY
   ============================================================ */
document.addEventListener("DOMContentLoaded", function () {

  /* ── User info ── */
  const name = localStorage.getItem("euscribe_user_name") || "User";
  const avatar = document.querySelector(".avatar");
  if (avatar) {
    const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    avatar.textContent = initials;
  }
  const userInfoP = document.querySelector(".user-info p");
  if (userInfoP) userInfoP.textContent = name;

  /* ── Logout with confirmation ── */
  const logoutBtn = document.querySelector(".dropdown button");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async function () {
      const confirmed = await euConfirm("You'll need to sign in again to access your documents.", {
        title: "Log out of EuScribe?",
        confirmText: "Log out",
        cancelText: "Stay",
        type: "warning",
      });
      if (!confirmed) return;
      localStorage.removeItem("euscribe_token");
      localStorage.removeItem("euscribe_user_name");
      localStorage.removeItem("euscribe_user_email");
      window.location.href = "euscribe-auth.html";
    });
  }

  loadDocumentsFromBackend();
  loadAnnouncement();

  /* ── AI Action Cards ── */
  const prompts = {
    "Fix Grammar & Spelling": (text) => `Fix all grammar and spelling errors in this text. Return only the corrected text, nothing else:\n\n${text}`,
    "Rewrite for Clarity": (text) => `Rewrite the following text for better clarity and readability. Return only the rewritten text:\n\n${text}`,
    Summarize: (text) => `Summarize the following text into concise key points. Return only the summary:\n\n${text}`,
    "Expand & Elaborate": (text) => `Expand and elaborate on the following text with more detail and depth. Return only the expanded text:\n\n${text}`,
    Formal: (text) => `Rewrite the following text in a formal, professional tone. Return only the rewritten text:\n\n${text}`,
    Casual: (text) => `Rewrite the following text in a casual, relaxed tone. Return only the rewritten text:\n\n${text}`,
    Academic: (text) => `Rewrite the following text in an academic, scholarly style. Return only the rewritten text:\n\n${text}`,
    Friendly: (text) => `Rewrite the following text in a warm, friendly and conversational tone. Return only the rewritten text:\n\n${text}`,
    Persuasive: (text) => `Rewrite the following text to be more persuasive and convincing. Return only the rewritten text:\n\n${text}`,
    Creative: (text) => `Rewrite the following text in a creative, expressive and imaginative style. Return only the rewritten text:\n\n${text}`,
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
          showAIResult("Please select some text in the editor first, or type something.", true);
          return;
        }
        const aiPanel = document.getElementById("aiPanel");
        if (aiPanel && !aiPanel.classList.contains("open") && window.innerWidth <= 900) {
          aiPanel.classList.add("open");
        }
        callAI(prompts[title](selectedText));
      });
    }
  });

  /* ── Ask Anything ── */
  const sendBtn = document.querySelector(".ai-send-btn");
  const aiInput = document.getElementById("aiInput");
  if (sendBtn && aiInput) {
    sendBtn.addEventListener("click", function () {
      const userPrompt = aiInput.value.trim();
      const selectedText = getSelectedText();
      if (!userPrompt) return;
      const fullPrompt = selectedText
        ? `${userPrompt}\n\nHere is the text to work with:\n\n${selectedText}`
        : userPrompt;
      callAI(fullPrompt);
      aiInput.value = "";
    });
    aiInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    });
  }

}); // ← end DOMContentLoaded

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
    if (!res.ok) { setTimeout(loadAnnouncement, 55000); return; }
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
  document.body.style.paddingTop = (parseInt(document.body.style.paddingTop) || 0) + banner.offsetHeight + "px";
}

function dismissAnnouncement(id) {
  localStorage.setItem("euscribe_dismissed_ann", id);
  const banner = document.getElementById("euscribe-announcement");
  if (banner) {
    banner.style.transition = "opacity 0.2s, transform 0.2s";
    banner.style.opacity = "0";
    banner.style.transform = "translateY(-100%)";
    setTimeout(() => { document.body.style.paddingTop = ""; banner.remove(); }, 200);
  }
}

/* ============================================================
   AI CALL
   ============================================================ */
let savedRange = null;

async function callAI(prompt) {
  const token = getToken();
  showAILoading(true);
  hideAIResult();
  try {
    const res = await fetch(`${API}/api/ai/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("euscribe_token");
        window.location.href = "euscribe-auth.html";
        return;
      }
      throw new Error(data.message || "AI request failed");
    }
    showAIResult(data.result);
  } catch (err) {
    showAIResult(`Error: ${err.message}`, true);
  } finally {
    showAILoading(false);
  }
}

/* ============================================================
   GET SELECTED TEXT
   ============================================================ */
function getSelectedText() {
  const editor = document.getElementById("content");
  const sel = window.getSelection();
  if (sel && sel.toString().trim().length > 0) {
    savedRange = sel.getRangeAt(0).cloneRange();
    return sel.toString().trim();
  }
  savedRange = null;
  return editor ? editor.innerText.trim() : "";
}

/* ============================================================
   AI RESULT UI
   ============================================================ */
function injectResultBox() {
  if (document.getElementById("ai-result-box")) return;
  const box = document.createElement("div");
  box.id = "ai-result-box";
  box.style.cssText = `
    margin-top:16px;padding:14px;
    background:rgba(79,140,255,0.06);border:1px solid rgba(79,140,255,0.2);
    border-radius:10px;display:none;flex-direction:column;gap:10px;
  `;
  box.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
      <span style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--blue,#4f8cff)">AI Result</span>
      <button id="ai-result-close" style="background:none;border:none;color:var(--text-muted,#8898b4);cursor:pointer;font-size:16px;line-height:1;padding:0">×</button>
    </div>
    <div id="ai-result-text" style="font-size:13px;line-height:1.7;color:var(--text,#e6edf3);white-space:pre-wrap;max-height:220px;overflow-y:auto"></div>
    <div id="ai-result-error" style="font-size:13px;color:#ff6b6b;display:none"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button id="ai-insert-btn" style="flex:1;padding:8px 12px;background:linear-gradient(135deg,#4f8cff,#3a7de8);border:none;border-radius:7px;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">Copy</button>
      <button id="ai-replace-btn" style="flex:1;padding:8px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:7px;color:#e6edf3;font-size:12px;cursor:pointer;">Replace selection</button>
    </div>
  `;
  const header = document.querySelector(".ai-panel-header");
  if (header) header.after(box);

  const spinner = document.createElement("div");
  spinner.id = "ai-loading";
  spinner.style.cssText = `display:none;align-items:center;gap:10px;padding:14px;margin-top:8px;font-size:13px;color:var(--text-muted,#8898b4);`;
  spinner.innerHTML = `<div style="width:14px;height:14px;flex-shrink:0;border:2px solid rgba(79,140,255,0.2);border-top-color:#4f8cff;border-radius:50%;animation:spin 0.5s linear infinite;"></div><span>AI is thinking...</span>`;
  box.before(spinner);

  document.getElementById("ai-result-close").addEventListener("click", hideAIResult);

  document.getElementById("ai-insert-btn").addEventListener("click", function () {
    const text = document.getElementById("ai-result-text").textContent;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById("ai-insert-btn");
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = "Copy"; }, 2000);
    });
  });

  document.getElementById("ai-replace-btn").addEventListener("click", function () {
    const text = document.getElementById("ai-result-text").textContent;
    const editor = document.getElementById("content");
    editor.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.toString().trim()) {
      sel.getRangeAt(0).deleteContents();
      sel.getRangeAt(0).insertNode(document.createTextNode(text));
    } else {
      document.execCommand("insertText", false, text);
    }
    hideAIResult();
    if (typeof window.saveCurrentDocument === "function") window.saveCurrentDocument();
  });
}

function showAILoading(on) {
  injectResultBox();
  const el = document.getElementById("ai-loading");
  if (el) el.style.display = on ? "flex" : "none";
}

function showAIResult(text, isError = false) {
  injectResultBox();
  const box = document.getElementById("ai-result-box");
  const textEl = document.getElementById("ai-result-text");
  const errEl = document.getElementById("ai-result-error");
  if (!box) return;
  if (isError) {
    textEl.style.display = "none";
    errEl.style.display = "block";
    errEl.textContent = text;
    document.getElementById("ai-insert-btn").style.display = "none";
    document.getElementById("ai-replace-btn").style.display = "none";
  } else {
    textEl.style.display = "block";
    errEl.style.display = "none";
    textEl.textContent = text;
    document.getElementById("ai-insert-btn").style.display = "";
    document.getElementById("ai-replace-btn").style.display = "";
  }
  box.style.display = "flex";
}

function hideAIResult() {
  const box = document.getElementById("ai-result-box");
  if (box) box.style.display = "none";
}