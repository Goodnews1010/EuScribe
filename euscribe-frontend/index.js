function formatDoc(cmd, value = null) {
  document.execCommand(cmd, false, value);
  saveCurrentDocument();
}

function addLink() {
  const url = prompt("Insert url");
  if (url) formatDoc("createLink", url);
}

const content      = document.getElementById("content");
const filename     = document.getElementById("filename");
const topFileTitle = document.querySelector(".file-title");
const fileList     = document.getElementById("fileList");
const newDocBtn    = document.getElementById("newDocBtn");
const searchInput  = document.getElementById("searchInput");

/* ===================================================
   LINK HOVER FIX
=================================================== */
content.addEventListener("mouseenter", function () {
  content.querySelectorAll("a").forEach((item) => {
    item.addEventListener("mouseenter", function () {
      content.setAttribute("contenteditable", false);
      item.target = "_blank";
    });
    item.addEventListener("mouseleave", function () {
      content.setAttribute("contenteditable", true);
      item.target = "_blank";
    });
  });
});

/* ===================================================
   DOCUMENT STORAGE
=================================================== */
let documents   = JSON.parse(localStorage.getItem("euscribeDocuments")) || [];
let currentDocId = null;

function saveToStorage() {
  localStorage.setItem("euscribeDocuments", JSON.stringify(documents));
}

/* ===================================================
   CREATE NEW DOCUMENT
=================================================== */
function createNewDocument() {
  const newDoc = {
    id:      Date.now(),
    name:    `Untitled Document ${documents.length + 1}`,
    content: ""
  };
  documents.unshift(newDoc);
  currentDocId = newDoc.id;
  content.innerHTML      = "";
  filename.value         = newDoc.name;
  topFileTitle.value     = newDoc.name;
  saveToStorage();
  renderDocuments();
}

/* ===================================================
   LOAD DOCUMENT
=================================================== */
function loadDocument(id) {
  const doc = documents.find((item) => item.id === id);
  if (!doc) return;
  currentDocId       = id;
  content.innerHTML  = doc.content;
  filename.value     = doc.name;
  topFileTitle.value = doc.name;
  renderDocuments();
  updateDocStats();
}

/* ===================================================
   SAVE CURRENT DOCUMENT
=================================================== */
function saveCurrentDocument() {
  if (!currentDocId) return;
  const doc = documents.find((item) => item.id === currentDocId);
  if (!doc) return;
  doc.content    = content.innerHTML;
  doc.name       = topFileTitle.value.trim() || "Untitled Document";
  filename.value = doc.name;
  saveToStorage();

/* ===================================================
  SAVED OR SAVING
=================================================== */
const saveStatus = document.getElementById("saveStatus");

let typingTimer;
const typingDelay = 1000;

content.addEventListener("input", () => {
  saveStatus.textContent = "Saving...";
  saveStatus.classList.add("saving");
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    saveCurrentDocument();
    saveStatus.textContent = "Saved";
    saveStatus.classList.remove("saving");
  }, typingDelay);
});

}

/* ===================================================
   RENAME DOCUMENT
=================================================== */
function renameCurrentDocument(newName) {
  if (!currentDocId) return;
  const doc = documents.find((item) => item.id === currentDocId);
  if (!doc) return;
  doc.name           = newName.trim() || "Untitled Document";
  filename.value     = doc.name;
  topFileTitle.value = doc.name;
  saveToStorage();
  renderDocuments();
}

/* ===================================================
   DELETE DOCUMENT
=================================================== */
function deleteDocument(id) {
  if (!confirm("Delete this document?")) return;
  documents = documents.filter((doc) => doc.id !== id);
  if (documents.length === 0) { createNewDocument(); return; }
  if (currentDocId === id) loadDocument(documents[0].id);
  saveToStorage();
  renderDocuments();
}

/* ===================================================
   RENDER SIDEBAR FILES
=================================================== */
function renderDocuments() {
  fileList.innerHTML = "";
  const searchValue  = searchInput.value.toLowerCase();
  const filteredDocs = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchValue)
  );
  filteredDocs.forEach((doc) => {
    const fileItem = document.createElement("div");
    fileItem.classList.add("file-item");
    if (doc.id === currentDocId) fileItem.style.border = "1px solid #4f8cff";
    fileItem.innerHTML = `
      <input type="text" class="file-name" value="${doc.name}" readonly />
      <i class='bx bx-trash delete'></i>
    `;
    fileItem.querySelector(".file-name").addEventListener("click", () => loadDocument(doc.id));
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
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href  = url;
    link.download = `${topFileTitle.value}.txt`;
    link.click();
  } else if (value === "pdf") {

  const exportContent = content.cloneNode(true);

  exportContent.style.background = "#ffffff";
  exportContent.style.color = "#000000";
  exportContent.style.padding = "56px 64px";
  exportContent.style.width = "100%";

  document.body.appendChild(exportContent);

  html2pdf()
    .set({
      margin: 10,
      filename: `${topFileTitle.value}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        backgroundColor: "#ffffff"
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait"
      }
    })
    .from(exportContent)
    .save()
    .then(() => {
      document.body.removeChild(exportContent);
    });
}
}

/* ===================================================
   AUTO SAVE
=================================================== */
content.addEventListener("input", () => {
  saveCurrentDocument();
  updateDocStats();
});

/* ===================================================
   TITLE EDITING
=================================================== */
topFileTitle.addEventListener("input", function () { renameCurrentDocument(this.value); });
filename.addEventListener("input",     function () { renameCurrentDocument(this.value); });

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
if (documents.length === 0) {
  createNewDocument();
} else {
  loadDocument(documents[0].id);
}
renderDocuments();

/*=========================================
    ACTIVE BUTTONS
  =========================================*/
document.querySelectorAll(".tool-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    btn.classList.toggle("active");
  });
});

/* ============================================================
   AI TABS
   ============================================================ */
document.querySelectorAll(".ai-tab").forEach((tab) => {
  tab.addEventListener("click", function () {
    document.querySelectorAll(".ai-tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
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
  themeToggle.checked = true;
}

themeToggle.addEventListener("change", function () {
  if (this.checked) {
    document.body.classList.add("light");
    localStorage.setItem("euscribe-theme", "light");
  } else {
    document.body.classList.remove("light");
    localStorage.setItem("euscribe-theme", "dark");
  }
});

/* ============================================================
   CLEAN PASTE (strip background & color bleed)
   ============================================================ */
content.addEventListener("paste", function (e) {
  e.preventDefault();
  let html  = e.clipboardData.getData("text/html");
  let plain = e.clipboardData.getData("text/plain");

  if (html) {
    const parser = new DOMParser();
    const doc    = parser.parseFromString(html, "text/html");

    doc.querySelectorAll("*").forEach((el) => {
      const style = el.getAttribute("style");
      if (style) {
        const cleaned = style.split(";").filter((rule) => {
          const prop = rule.split(":")[0].trim().toLowerCase();
          const blocked = ["background","background-color","color","font-family","font-size","line-height","mso-","-webkit-"];
          return !blocked.some((b) => prop.startsWith(b));
        }).join(";");
        if (cleaned.trim()) { el.setAttribute("style", cleaned); }
        else                { el.removeAttribute("style"); }
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
  const menuBtn     = document.getElementById("menuBtn");
  const sidebar     = document.querySelector(".sidebar");
  const mainContent = document.querySelector(".main-content");
  const appShell    = document.getElementById("appShell");
  let   sidebarOpen = true;

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
  const aiBtn   = document.getElementById("aiBtn");
  const aiPanel = document.getElementById("aiPanel");
  const appShell = document.getElementById("appShell");
  let   aiOpen  = true;

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

  const MOBILE_BP  = 640;
  const TABLET_BP  = 900;

  const menuBtn    = document.getElementById("menuBtn");
  const aiBtn      = document.getElementById("aiBtn");
  const sidebar    = document.querySelector(".sidebar");
  const aiPanel    = document.getElementById("aiPanel");
  const overlay    = document.getElementById("mobileOverlay");
  const bottomNav  = document.getElementById("mobileBottomNav");
  const fileListEl = document.getElementById("fileList");
  const actionsRow = document.querySelector(".toolbar-actions");

  let sidebarOpen = false;
  let aiOpen      = false;

  let formatSelectInjected = false;
  function ensureFormatSelect() {
    if (formatSelectInjected || !actionsRow) return;
    if (actionsRow.querySelector(".mobile-format-select")) return;
    const sel = document.createElement("select");
    sel.className = "mobile-format-select";
    sel.innerHTML = `
      <option value="p"  selected>Paragraph</option>
      <option value="h1">Heading 1</option>
      <option value="h2">Heading 2</option>
      <option value="h3">Heading 3</option>
      <option value="h4">Heading 4</option>
    `;
    sel.addEventListener("change", function () {
      document.execCommand("formatBlock", false, this.value);
    });
    actionsRow.prepend(sel);
    formatSelectInjected = true;
  }

  function closeAll() {
    sidebar.classList.remove("open");
    sidebarOpen = false;
    aiPanel.classList.remove("open");
    aiOpen = false;
    overlay.classList.remove("visible");
    if (bottomNav) {
      bottomNav.querySelectorAll(".mob-nav-btn").forEach((b) =>
        b.classList.toggle("active", b.dataset.view === "write")
      );
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
      bottomNav.querySelectorAll(".mob-nav-btn").forEach((b) =>
        b.classList.toggle("active", b === btn)
      );
      if (view === "docs") {
        if (sidebarOpen) { closeAll(); }
        else             { openSidebar(); }
      } else if (view === "write") {
        closeAll();
      } else if (view === "ai") {
        if (aiOpen) { closeAll(); }
        else        { openAI(); }
      }
    });
  }

  menuBtn.addEventListener("click", function (e) {
    if (window.innerWidth <= MOBILE_BP) {
      e.stopImmediatePropagation();
      if (sidebarOpen) { closeAll(); }
      else             { openSidebar(); }
    }
  }, true);

  aiBtn.addEventListener("click", function (e) {
    if (window.innerWidth <= TABLET_BP) {
      e.stopImmediatePropagation();
      if (aiOpen) { closeAll(); }
      else        { openAI(); }
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

  if (window.innerWidth <= MOBILE_BP) {
    ensureFormatSelect();
  }

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
  const token = params.get('token');
  const name = params.get('name');
  const email = params.get('email');

  if (token) {
    localStorage.removeItem("euscribeDocuments");
    localStorage.removeItem("euscribe_id_map");
    localStorage.setItem('euscribe_token', token);
    localStorage.setItem('euscribe_user_name', name);
    localStorage.setItem('euscribe_user_email', email);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
})();

/* ============================================================
   FEATURE 1 — ONBOARDING DOCUMENT (first time users only)
   Shows a welcome doc with full explanation on first login
   ============================================================ */
(function showOnboardingIfFirstTime() {
  const hasSeenOnboarding = localStorage.getItem("euscribe_onboarded");
  if (hasSeenOnboarding) return;

  // Mark as onboarded so it never shows again
  localStorage.setItem("euscribe_onboarded", "true");

  const onboardingContent = `
<h2 style="color:#4f8cff;margin-bottom:12px">Welcome to EuScribe ✦</h2>
<p style="margin-bottom:16px">EuScribe is your AI-powered writing assistant. Here's everything you need to know to get started:</p>

<h3 style="margin-bottom:8px">✦ The Toolbar</h3>
<p style="margin-bottom:8px">The toolbar at the top lets you format your writing:</p>
<ul style="margin-left:20px;margin-bottom:16px;line-height:2">
  <li><strong>Undo / Redo</strong> — go back or forward on your changes</li>
  <li><strong>Bold, Underline, Italic, Strikethrough</strong> — style your text</li>
  <li><strong>Align Left, Center, Right</strong> — control text alignment</li>
  <li><strong>Ordered &amp; Unordered Lists</strong> — create bullet or numbered lists</li>
  <li><strong>Add Link / Remove Link</strong> — insert or remove hyperlinks</li>
  <li><strong>Format</strong> — switch between Heading 1–6 and Paragraph</li>
  <li><strong>Font Size</strong> — change text size</li>
  <li><strong>Color &amp; Highlight</strong> — change text color or highlight it</li>
</ul>

<h3 style="margin-bottom:8px">✦ AI Assistant</h3>
<p style="margin-bottom:8px">The AI panel on the right is your writing partner. Here's how to use it:</p>
<ul style="margin-left:20px;margin-bottom:16px;line-height:2">
  <li>Select any text in the editor</li>
  <li>Click an action like <strong>Fix Grammar</strong>, <strong>Rewrite for Clarity</strong>, <strong>Summarize</strong>, or <strong>Expand</strong></li>
  <li>The AI result appears — you can <strong>Copy</strong> it or <strong>Replace</strong> your selection</li>
  <li>Use the <strong>Tone</strong> tab to change writing style to Formal, Casual, Academic, and more</li>
  <li>Use the <strong>Custom</strong> tab to ask the AI anything you want</li>
</ul>

<h3 style="margin-bottom:8px">✦ Documents</h3>
<p style="margin-bottom:16px">All your documents are saved automatically and synced to your account. Access them from any device by logging in. Use the sidebar to create, search, and switch between documents.</p>

<h3 style="margin-bottom:8px">✦ Export</h3>
<p style="margin-bottom:16px">Use the <strong>File</strong> menu to save your document as a <strong>PDF</strong> or <strong>TXT</strong> file at any time.</p>

<h3 style="margin-bottom:8px">✦ Quick Tip</h3>
<p style="margin-bottom:16px">When you copy any text in the editor, a quick action bar appears — use it to instantly fix, rewrite, summarize or expand your copied text with one click.</p>

<p style="color:#4f8cff;font-weight:600">You're all set. Start writing! ✦</p>
`;

  // Create the onboarding document
  const onboardingDoc = {
    id: Date.now(),
    name: "Getting Started with EuScribe",
    content: onboardingContent
  };

  documents.unshift(onboardingDoc);
  currentDocId = onboardingDoc.id;
  content.innerHTML = onboardingContent;
  filename.value = onboardingDoc.name;
  topFileTitle.value = onboardingDoc.name;
  saveToStorage();
  renderDocuments();
})();

/* ============================================================
   FEATURE 2 — COPY QUICK ACTION POPUP
   Shows Fix | Rewrite | Summarize | Expand when user copies text
   ============================================================ */
(function setupCopyPopup() {
  // Create the popup element
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
    { label: "Fix", prompt: (t) => `Fix all grammar and spelling errors in this text. Return only the corrected text:\n\n${t}` },
    { label: "Rewrite", prompt: (t) => `Rewrite the following text for better clarity and readability. Return only the rewritten text:\n\n${t}` },
    { label: "Summarize", prompt: (t) => `Summarize the following text into concise key points. Return only the summary:\n\n${t}` },
    { label: "Expand", prompt: (t) => `Expand and elaborate on the following text with more detail. Return only the expanded text:\n\n${t}` },
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

      // Open AI panel on mobile
      const aiPanel = document.getElementById("aiPanel");
      if (aiPanel && !aiPanel.classList.contains("open") && window.innerWidth <= 900) {
        aiPanel.classList.add("open");
      }

      // Call AI with the copied text
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

    // Position below cursor, keep within viewport
    const popupW = 280;
    const popupH = 36;
    let left = x - popupW / 2;
    let top  = y + 12;

    if (left < 8) left = 8;
    if (left + popupW > window.innerWidth - 8) left = window.innerWidth - popupW - 8;
    if (top + popupH > window.innerHeight - 8) top = y - popupH - 12;

    popup.style.left = left + "px";
    popup.style.top  = top + "px";

    // Auto hide after 4 seconds
    hideTimer = setTimeout(hidePopup, 4000);
  }

  function hidePopup() {
    popup.style.display = "none";
    clearTimeout(hideTimer);
  }

  // Listen for copy events inside the editor
  content.addEventListener("copy", function () {
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      if (!text || text.length < 3) return;

      // Get position from selection
      const range = sel.getRangeAt(0);
      const rect  = range.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.bottom + window.scrollY;

      showPopup(x, y, text);
    }, 50);
  });

  // Hide popup when clicking outside
  document.addEventListener("click", function (e) {
    if (!popup.contains(e.target)) hidePopup();
  });

  // Hide popup when user starts typing
  content.addEventListener("keydown", hidePopup);

})();