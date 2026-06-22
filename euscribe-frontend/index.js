function formatDoc(cmd, value = null) {
  document.execCommand(cmd, false, value);
  saveCurrentDocument();
}

async function addLink() {
  const url = await euPrompt("Enter the URL you want to link to:", {
    title: "Insert Link",
    placeholder: "https://example.com",
    confirmText: "Insert",
  });
  if (url) formatDoc("createLink", url);
}

const content = document.getElementById("content");
const filename = document.getElementById("filename");
const topFileTitle = document.querySelector(".file-title");
const fileList = document.getElementById("fileList");
const newDocBtn = document.getElementById("newDocBtn");
const searchInput = document.getElementById("searchInput");

/* ===================================================
   LINK HOVER FIX
=================================================== */
content.addEventListener("mouseover", (e) => {
  if (e.target.tagName === "A") {
    content.setAttribute("contenteditable", false);
    e.target.target = "_blank";
  }
});

content.addEventListener("mouseout", (e) => {
  if (e.target.tagName === "A") {
    content.setAttribute("contenteditable", true);
  }
});

/* ===================================================
   DOCUMENT STORAGE
=================================================== */
let documents = JSON.parse(localStorage.getItem("euscribeDocuments")) || [];
let currentDocId = null;

function saveToStorage() {
  localStorage.setItem("euscribeDocuments", JSON.stringify(documents));
}

/* ===================================================
   METADATA HELPERS (word count + relative timestamps)
=================================================== */
function countWords(htmlOrText) {
  const text = String(htmlOrText || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function formatTimeAgo(isoString) {
  if (!isoString) return "";
  const then = new Date(isoString).getTime();
  const diffSec = Math.floor((Date.now() - then) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 30) return "Just now";
  if (diffMin < 1) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;

  const date = new Date(isoString);
  const options = { month: "short", day: "numeric" };
  if (date.getFullYear() !== new Date().getFullYear()) options.year = "numeric";
  return date.toLocaleDateString(undefined, options);
}

// Re-render relative "X mins ago" labels every 60s without a full reload
setInterval(() => {
  document.querySelectorAll(".file-meta[data-updated-at]").forEach((el) => {
    const wordLabel = el.dataset.wordLabel || "";
    el.textContent = `${wordLabel} • Edited ${formatTimeAgo(el.dataset.updatedAt)}`;
  });
}, 60000);

/* ===================================================
   CREATE NEW DOCUMENT
=================================================== */
function createNewDocument() {
  const now = new Date().toISOString();
  const newDoc = {
    id: Date.now(),
    name: `Untitled Document ${documents.length + 1}`,
    content: "",
    createdAt: now,
    updatedAt: now,
  };
  documents.unshift(newDoc);
  currentDocId = newDoc.id;
  content.innerHTML = "";
  filename.value = newDoc.name;
  topFileTitle.value = newDoc.name;
  saveToStorage();
  renderDocuments();
}

/* ===================================================
   LOAD DOCUMENT
=================================================== */
function loadDocument(id) {
  const doc = documents.find((item) => String(item.id) === String(id));
  if (!doc) return;
  currentDocId = doc.id;
  content.innerHTML = doc.content;
  filename.value = doc.name;
  topFileTitle.value = doc.name;
  renderDocuments();
  updateDocStats();
}

/* ===================================================
   SAVE CURRENT DOCUMENT
=================================================== */
const saveStatus = document.getElementById("saveStatus");

let typingTimer;
const typingDelay = 1000;

function saveCurrentDocument() {
  if (!currentDocId) return;

  const doc = documents.find((item) => String(item.id) === String(currentDocId));
  if (!doc) return;

  doc.content = content.innerHTML;
  doc.name = topFileTitle.value.trim() || "Untitled Document";
  doc.updatedAt = new Date().toISOString();

  filename.value = doc.name;

  saveToStorage();
  renderDocuments();

  // Sync to MongoDB
  if (typeof syncToBackend === "function") syncToBackend(doc);
}
function normalizeEmptyContent() {
  const text = content.innerText.replace(/\u200B/g, "").trim();
  if (text === "") {
    content.innerHTML = "";
  }
}
content.addEventListener("input", () => {
  saveStatus.textContent = "Saving...";
  saveStatus.classList.add("saving");

  clearTimeout(typingTimer);

  typingTimer = setTimeout(() => {
    saveCurrentDocument();

    saveStatus.textContent = "Saved";
    saveStatus.classList.remove("saving");
  }, typingDelay);
  updateDocStats();
  normalizeEmptyContent();
});

/* ===================================================
   RENAME DOCUMENT
=================================================== */
function renameCurrentDocument(newName, sourceEl) {
  if (!currentDocId) return;
  const doc = documents.find((item) => String(item.id) === String(currentDocId));
  if (!doc) return;
  doc.name = newName; // allow empty while typing — no forced fallback here
  if (sourceEl !== topFileTitle) topFileTitle.value = newName;
  if (sourceEl !== filename) filename.value = newName;
  saveToStorage();
  renderDocuments();
}

function finalizeDocumentName() {
  if (!currentDocId) return;
  const doc = documents.find((item) => String(item.id) === String(currentDocId));
  if (!doc) return;
  if (!doc.name || !doc.name.trim()) {
    doc.name = "Untitled Document";
  }
  filename.value = doc.name;
  topFileTitle.value = doc.name;
  saveToStorage();
  renderDocuments();
}

/* ===================================================
   DELETE DOCUMENT
=================================================== */
async function deleteDocument(id) {
  const doc = documents.find((d) => String(d.id) === String(id));
  const docName = doc ? doc.name : "this document";

  const confirmed = await euConfirm(`"${docName}" will be permanently deleted.`, {
    title: "Delete document?",
    confirmText: "Delete",
    cancelText: "Cancel",
    type: "danger",
  });

  if (!confirmed) return;

  // Also delete from backend if available
  if (typeof deleteFromBackend === "function") deleteFromBackend(id);

  documents = documents.filter((d) => String(d.id) !== String(id));

  if (documents.length === 0) {
    saveToStorage();
    createNewDocument();
    return;
  }

  if (String(currentDocId) === String(id)) {
    loadDocument(documents[0].id);
  }

  saveToStorage();
  renderDocuments();
  euToast("Document deleted.", "error");
}

/* ===================================================
   RENDER SIDEBAR FILES
=================================================== */
function renderDocuments() {
  fileList.innerHTML = "";
  const searchValue = searchInput.value.toLowerCase();
  const filteredDocs = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchValue),
  );
  filteredDocs.forEach((doc) => {
    const fileItem = document.createElement("div");
    fileItem.classList.add("file-item");
    if (String(doc.id) === String(currentDocId)) fileItem.style.border = "1px solid #4f8cff";

    const wordCount = countWords(doc.content);
    const wordLabel = wordCount === 1 ? "1 word" : `${wordCount.toLocaleString()} words`;
    const metaText = `${wordLabel} • Edited ${formatTimeAgo(doc.updatedAt)}`;

    fileItem.innerHTML = `
      <div class="file-item-main">
        <input type="text" class="file-name" value="${doc.name}" readonly />
        <div class="file-meta" data-updated-at="${doc.updatedAt || ""}" data-word-label="${wordLabel}">${metaText}</div>
      </div>
      <i class='bx bx-trash delete'></i>
    `;
    fileItem
      .querySelector(".file-name")
      .addEventListener("click", () => loadDocument(doc.id));
    fileItem
      .querySelector(".file-meta")
      .addEventListener("click", () => loadDocument(doc.id));
    fileItem.querySelector(".delete").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteDocument(doc.id);
    });
    fileList.appendChild(fileItem);
  });
}

/* ===================================================
   FILE HANDLE
=================================================== */
function fileHandle(value) {
  if (value === "new") {
    createNewDocument();
  } else if (value === "txt") {
    const blob = new Blob([content.innerText]);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${topFileTitle.value}.txt`;
    link.click();
  } else if (value === "pdf") {
    const exportContent = content.cloneNode(true);
    exportContent.style.cssText = `
      background: #ffffff !important;
      color: #000000 !important;
      padding: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
      min-height: unset !important;
      border: none !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      outline: none !important;
      caret-color: transparent !important;
      font-family: Georgia, serif !important;
      font-size: 16px !important;
      line-height: 1.85 !important;
    `;
    document.body.appendChild(exportContent);

    html2pdf()
      .set({
        margin: 10,
        filename: `${topFileTitle.value}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          backgroundColor: "#ffffff",
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },
      })
      .from(exportContent)
      .save()
      .then(() => {
        document.body.removeChild(exportContent);
      });
  } else if (value === "upload") {
    uploadInput.click();
  }
}

/* ===================================================
   UPLOAD PDF / DOCX
=================================================== */
const API_BASE_URL = window.API_BASE_URL || "https://your-backend.onrender.com";
const uploadInput = document.createElement('input');
uploadInput.type = 'file';
uploadInput.accept = '.pdf,.docx';
uploadInput.style.display = 'none';
document.body.appendChild(uploadInput);

uploadInput.addEventListener('change', async function () {
  const file = this.files[0];
  if (!file) return;
  this.value = ''; // reset so the same file can be re-uploaded if needed

  const token = localStorage.getItem('euscribe_token');
  if (!token) {
    euToast('Please log in to upload documents.', 'error');
    return;
  }

  euToast('Uploading...', 'info');

  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API}/api/documents/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Upload failed');
    }

    const newDoc = await res.json();

    // Normalise the id field (backend returns _id)
    newDoc.id = newDoc._id || newDoc.id;
    newDoc.name = newDoc.title || newDoc.name;

    documents.unshift(newDoc);
    saveToStorage();
    renderDocuments();
    loadDocument(newDoc.id);
    euToast('Document uploaded successfully!', 'success');
  } catch (err) {
    console.error('Upload error:', err);
    euToast(err.message || 'Failed to upload document.', 'error');
  }
});

/* ===================================================
   TITLE EDITING
=================================================== */
topFileTitle.addEventListener("input", function () {
  renameCurrentDocument(this.value, topFileTitle);
});
filename.addEventListener("input", function () {
  renameCurrentDocument(this.value, filename);
});

topFileTitle.addEventListener("blur", finalizeDocumentName);
filename.addEventListener("blur", finalizeDocumentName);
/* ===================================================
   SEARCH
=================================================== */
searchInput.addEventListener("input", renderDocuments);

/* ===================================================
   NEW DOCUMENT BUTTON
=================================================== */
newDocBtn.addEventListener("click", createNewDocument);

/* ===================================================
   INITIAL LOAD
=================================================== */
// Remove empty untitled docs from previous sessions on startup
documents = documents.filter((d) => d.content && d.content.trim() !== "");
saveToStorage();
renderDocuments();
if (documents.length === 0) {
  createNewDocument();
}

// Fallback: 60s to account for Render cold start (~50s)
window._mongoLoadFallback = setTimeout(() => {
  if (currentDocId) return; // MongoDB already loaded
  if (documents.length === 0) {
    createNewDocument();
  } else {
    loadDocument(documents[0].id);
  }
}, 60000);

/* ============================================================
   AI TABS
   ============================================================ */
document.querySelectorAll(".ai-tab").forEach((tab) => {
  tab.addEventListener("click", function () {
    document
      .querySelectorAll(".ai-tab")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.remove("active"));
    this.classList.add("active");
    const target = document.getElementById(`${this.dataset.tab}-tab`);
    if (target) target.classList.add("active");
  });
});

/* ============================================================
   THEME TOGGLE
   ============================================================ */
const themeToggle = document.getElementById("themeToggle");

if (localStorage.getItem("euscribe-theme") === "light") {
  document.body.classList.add("light");
}

themeToggle.addEventListener("click", function () {
  document.body.classList.toggle("light");
  const isLight = document.body.classList.contains("light");
  localStorage.setItem("euscribe-theme", isLight ? "light" : "dark");
});

/* ============================================================
   CLEAN PASTE (strip background & color bleed)
   ============================================================ */
content.addEventListener("paste", function (e) {
  e.preventDefault();
  let html = e.clipboardData.getData("text/html");
  let plain = e.clipboardData.getData("text/plain");

  if (html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    doc.querySelectorAll("*").forEach((el) => {
      const style = el.getAttribute("style");
      if (style) {
        const cleaned = style
          .split(";")
          .filter((rule) => {
            const prop = rule.split(":")[0].trim().toLowerCase();
            const blocked = [
              "background",
              "background-color",
              "color",
              "font-family",
              "font-size",
              "line-height",
              "mso-",
              "-webkit-",
            ];
            return !blocked.some((b) => prop.startsWith(b));
          })
          .join(";");
        if (cleaned.trim()) {
          el.setAttribute("style", cleaned);
        } else {
          el.removeAttribute("style");
        }
      }
      el.removeAttribute("bgcolor");
      el.removeAttribute("color");
    });

    doc.querySelectorAll("style, meta, link").forEach((el) => el.remove());
    document.execCommand("insertHTML", false, doc.body.innerHTML);
  } else {
    document.execCommand("insertText", false, plain);
  }
  saveCurrentDocument();
});

/* ============================================================
   DESKTOP — SIDEBAR TOGGLE (hamburger)
   ============================================================ */
(function () {
  const menuBtn = document.getElementById("menuBtn");
  const sidebar = document.querySelector(".sidebar");
  const mainContent = document.querySelector(".main-content");
  let sidebarOpen = true;

  menuBtn.addEventListener("click", function () {
    if (window.innerWidth > 640) {
      sidebarOpen = !sidebarOpen;
      if (sidebarOpen) {
        sidebar.classList.remove("closed");
        mainContent.classList.remove("full");
      } else {
        sidebar.classList.add("closed");
        mainContent.classList.add("full");
      }
    }
  });
})();

/* ============================================================
   DESKTOP — AI PANEL TOGGLE
   ============================================================ */
(function () {
  const aiBtn = document.getElementById("aiBtn");
  const aiPanel = document.getElementById("aiPanel");
  const appShell = document.getElementById("appShell");
  let aiOpen = true;

  aiBtn.addEventListener("click", function () {
    if (window.innerWidth > 900) {
      aiOpen = !aiOpen;
      if (aiOpen) {
        aiPanel.classList.remove("closed");
        appShell.classList.remove("ai-closed");
      } else {
        aiPanel.classList.add("closed");
        appShell.classList.add("ai-closed");
      }
    }
  });
})();

/* ============================================================
   MOBILE CONTROLLER
   ============================================================ */
(function () {
  const MOBILE_BP = 640;
  const TABLET_BP = 900;

  const menuBtn = document.getElementById("menuBtn");
  const aiBtn = document.getElementById("aiBtn");
  const sidebar = document.querySelector(".sidebar");
  const aiPanel = document.getElementById("aiPanel");
  const overlay = document.getElementById("mobileOverlay");
  const bottomNav = document.getElementById("mobileBottomNav");
  const fileListEl = document.getElementById("fileList");
  const actionsRow = document.querySelector(".toolbar-actions");

  let sidebarOpen = false;
  let aiOpen = false;

  let formatSelectInjected = false;
  function ensureFormatSelect() {
    if (formatSelectInjected || !actionsRow) return;
    if (actionsRow.querySelector(".mobile-format-select")) return;

    const sel = document.createElement("select");
    sel.className = "mobile-format-select";
    sel.innerHTML = `
      <option value="p" selected>Paragraph</option>
      <option value="h1">Heading 1</option>
      <option value="h2">Heading 2</option>
      <option value="h3">Heading 3</option>
      <option value="h4">Heading 4</option>
    `;
    sel.addEventListener("change", function () {
      document.execCommand("formatBlock", false, this.value);
    });
    actionsRow.prepend(sel);

    const fileSelect = document.createElement("select");
    fileSelect.className = "mobile-format-select";
    fileSelect.innerHTML = `
        <option value="" selected hidden disabled>File</option>
        <option value="new">New File</option>
        <option value="upload">Upload PDF / DOCX</option>
        <option value="txt">Save as .txt</option>
        <option value="pdf">Save as .pdf</option>
      `;
    fileSelect.addEventListener("change", function () {
      fileHandle(this.value);
      this.selectedIndex = 0;
    });
    actionsRow.prepend(fileSelect);

    const colorLabel = document.createElement("label");
    colorLabel.className = "color-picker";
    colorLabel.style.flexShrink = "0";
    colorLabel.innerHTML = `<span>Color</span><input type="color" value="#e6edf3" />`;
    colorLabel.querySelector("input").addEventListener("input", function () {
      document.execCommand("foreColor", false, this.value);
    });
    actionsRow.appendChild(colorLabel);

    const highlightLabel = document.createElement("label");
    highlightLabel.className = "color-picker";
    highlightLabel.style.flexShrink = "0";
    highlightLabel.innerHTML = `<span>Highlight</span><input type="color" value="#ffff00" />`;
    highlightLabel.querySelector("input").addEventListener("input", function () {
      document.execCommand("hiliteColor", false, this.value);
    });
    actionsRow.appendChild(highlightLabel);

    formatSelectInjected = true;
  }

  function closeAll() {
    sidebar.classList.remove("open");
    sidebarOpen = false;
    aiPanel.classList.remove("open");
    aiOpen = false;
    overlay.classList.remove("visible");
    if (bottomNav) {
      bottomNav
        .querySelectorAll(".mob-nav-btn")
        .forEach((b) => b.classList.toggle("active", b.dataset.view === "write"));
    }
  }

  function openSidebar() {
    aiPanel.classList.remove("open");
    aiOpen = false;
    sidebar.classList.add("open");
    sidebarOpen = true;
    overlay.classList.add("visible");
  }

  function openAI() {
    sidebar.classList.remove("open");
    sidebarOpen = false;
    aiPanel.classList.remove("closed");
    aiPanel.classList.add("open");
    aiOpen = true;
    overlay.classList.add("visible");
  }

  overlay.addEventListener("click", closeAll);

  if (bottomNav) {
    bottomNav.addEventListener("click", function (e) {
      const btn = e.target.closest(".mob-nav-btn");
      if (!btn) return;
      const view = btn.dataset.view;
      bottomNav
        .querySelectorAll(".mob-nav-btn")
        .forEach((b) => b.classList.toggle("active", b === btn));
      if (view === "docs") {
        if (sidebarOpen) closeAll(); else openSidebar();
      } else if (view === "write") {
        closeAll();
      } else if (view === "ai") {
        if (aiOpen) closeAll(); else openAI();
      }
    });
  }

  menuBtn.addEventListener("click", function (e) {
    if (window.innerWidth <= MOBILE_BP) {
      e.stopImmediatePropagation();
      if (sidebarOpen) closeAll(); else openSidebar();
    }
  }, true);

  aiBtn.addEventListener("click", function (e) {
    if (window.innerWidth <= TABLET_BP) {
      e.stopImmediatePropagation();
      if (aiOpen) closeAll(); else openAI();
    }
  }, true);

  fileListEl.addEventListener("click", function () {
    if (window.innerWidth <= MOBILE_BP && sidebarOpen) {
      setTimeout(closeAll, 160);
    }
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > MOBILE_BP) {
      sidebar.classList.remove("open");
      overlay.classList.remove("visible");
      sidebarOpen = false;
    }
    if (window.innerWidth > TABLET_BP) {
      aiPanel.classList.remove("open");
      overlay.classList.remove("visible");
      aiOpen = false;
    }
  });

  overlay.addEventListener("touchmove", function (e) {
    e.preventDefault();
  }, { passive: false });

  if (window.innerWidth <= MOBILE_BP) ensureFormatSelect();

  window.addEventListener("resize", function () {
    if (window.innerWidth <= MOBILE_BP) ensureFormatSelect();
  });
})();

/* ============================================================
   WORD COUNT
   ============================================================ */
function updateDocStats() {
  const text = content.innerText.trim();
  const words = text === "" ? 0 : text.split(/\s+/).filter(Boolean).length;
  const chars = text.length;
  const minutes = Math.ceil(words / 200);

  document.getElementById("wordCount").textContent =
    words === 1 ? "1 word" : `${words.toLocaleString()} words`;

  document.getElementById("charCount").textContent =
    `${chars.toLocaleString()} chars`;

  document.getElementById("readTime").textContent =
    minutes <= 1 ? "< 1 min read" : `${minutes} min read`;
}

// Handle Google/GitHub OAuth redirect
(function handleOAuthRedirect() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const name = params.get("name");
  const email = params.get("email");

  if (token) {
    localStorage.removeItem("euscribeDocuments");
    localStorage.removeItem("euscribe_id_map");
    localStorage.setItem("euscribe_token", token);
    localStorage.setItem("euscribe_user_name", name);
    localStorage.setItem("euscribe_user_email", email);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
})();

/* ============================================================
   COPY QUICK ACTION POPUP
   ============================================================ */
(function setupCopyPopup() {
  const popup = document.createElement("div");
  popup.id = "copy-action-popup";
  popup.style.cssText = `
    position: fixed;
    display: none;
    align-items: center;
    gap: 0;
    background: #1a1a1c;
    border: 0.5px solid #2e2e30;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    z-index: 9999;
    overflow: hidden;
    font-family: 'DM Sans', sans-serif;
  `;

  const actions = [
    {
      label: "Fix",
      prompt: (t) => `Fix all grammar and spelling errors in this text. Return only the corrected text:\n\n${t}`,
    },
    {
      label: "Rewrite",
      prompt: (t) => `Rewrite the following text for better clarity and readability. Return only the rewritten text:\n\n${t}`,
    },
    {
      label: "Summarize",
      prompt: (t) => `Summarize the following text into concise key points. Return only the summary:\n\n${t}`,
    },
    {
      label: "Expand",
      prompt: (t) => `Expand and elaborate on the following text with more detail. Return only the expanded text:\n\n${t}`,
    },
  ];

  actions.forEach((action, i) => {
    const btn = document.createElement("button");
    btn.textContent = action.label;
    btn.style.cssText = `
      padding: 7px 14px;
      background: none;
      border: none;
      border-right: ${i < actions.length - 1 ? "0.5px solid #2e2e30" : "none"};
      color: #b0b0b0;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      font-family: 'DM Sans', sans-serif;
      transition: background 0.15s, color 0.15s;
      white-space: nowrap;
    `;
    btn.addEventListener("mouseenter", () => {
      btn.style.background = "rgba(79,140,255,0.1)";
      btn.style.color = "#4f8cff";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "none";
      btn.style.color = "#b0b0b0";
    });
    btn.addEventListener("click", function () {
      const copiedText = popup.dataset.copiedText;
      if (!copiedText) return;
      hidePopup();

      const aiPanel = document.getElementById("aiPanel");
      if (aiPanel && !aiPanel.classList.contains("open") && window.innerWidth <= 900) {
        aiPanel.classList.add("open");
      }

      if (typeof callAI === "function") {
        callAI(action.prompt(copiedText));
      }
    });
    popup.appendChild(btn);
  });

  document.body.appendChild(popup);

  let hideTimer;

  function showPopup(x, y, text) {
    clearTimeout(hideTimer);
    popup.dataset.copiedText = text;
    popup.style.display = "flex";

    const editorRect = content.getBoundingClientRect();
    const popupW = 280;
    let left = editorRect.left + editorRect.width / 2 - popupW / 2;
    let top = editorRect.bottom - 50;

    if (left < 8) left = 8;
    if (left + popupW > window.innerWidth - 8) left = window.innerWidth - popupW - 8;

    popup.style.left = left + "px";
    popup.style.top = top + "px";

    hideTimer = setTimeout(hidePopup, 10000);
  }

  function hidePopup() {
    popup.style.display = "none";
    clearTimeout(hideTimer);
  }

  document.addEventListener("mouseup", function () {
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      if (!text || text.length < 3) { hidePopup(); return; }
      if (!content.contains(sel.anchorNode)) return;

      const editorRect = content.getBoundingClientRect();
      showPopup(editorRect.left + editorRect.width / 2, editorRect.bottom - 60, text);
    }, 50);
  });

  document.addEventListener("mousedown", function (e) {
    if (!popup.contains(e.target) && !content.contains(e.target)) hidePopup();
  });

  content.addEventListener("keydown", hidePopup);
})();