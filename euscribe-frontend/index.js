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
const typingDelay = 1000; // 1 second after user stops typing

content.addEventListener("input", () => {

  // User is typing
  saveStatus.textContent = "Saving...";
  saveStatus.classList.add("saving");

  // Clear old timer
  clearTimeout(typingTimer);

  // Start new timer
  typingTimer = setTimeout(() => {

    // User stopped typing
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
    html2pdf()
  .set({
    margin: 10,
    filename: `${topFileTitle.value}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: {
      unit: "mm",
      format: "a4",
      orientation: "portrait"
    }
  })
  .from(content)
  .save();
  }
}

/* ===================================================
   AUTO SAVE
=================================================== */
content.addEventListener("input", () => {
  saveCurrentDocument();
  updateDocStats(); // ← add this
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
      /* Desktop: push layout */
      sidebarOpen = !sidebarOpen;
      if (sidebarOpen) {
        sidebar.classList.remove("closed");
        mainContent.classList.remove("full");
      } else {
        sidebar.classList.add("closed");
        mainContent.classList.add("full");
      }
    }
    /* Mobile: handled by the mobile controller below */
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
    /* Tablet/mobile: handled by the mobile controller below */
  });
})();

/* ============================================================
   MOBILE CONTROLLER
   Full rewrite — bottom nav, drawers, overlay
   ============================================================ */
(function () {

  const MOBILE_BP  = 640;
  const TABLET_BP  = 900;

  /* Elements */
  const menuBtn    = document.getElementById("menuBtn");
  const aiBtn      = document.getElementById("aiBtn");
  const sidebar    = document.querySelector(".sidebar");
  const aiPanel    = document.getElementById("aiPanel");
  const overlay    = document.getElementById("mobileOverlay");
  const bottomNav  = document.getElementById("mobileBottomNav");
  const fileListEl = document.getElementById("fileList");
  const actionsRow = document.querySelector(".toolbar-actions");

  /* State */
  let sidebarOpen = false;
  let aiOpen      = false;

  /* ── Inject compact format select for mobile ── */
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

  /* ── Close all drawers ── */
  function closeAll() {
    /* Sidebar */
    sidebar.classList.remove("open");
    sidebarOpen = false;

    /* AI panel */
    aiPanel.classList.remove("open");
    aiOpen = false;

    /* Overlay */
    overlay.classList.remove("visible");

    /* Reset bottom nav to "write" */
    if (bottomNav) {
      bottomNav.querySelectorAll(".mob-nav-btn").forEach((b) =>
        b.classList.toggle("active", b.dataset.view === "write")
      );
    }
  }

  /* ── Open sidebar ── */
  function openSidebar() {
    aiPanel.classList.remove("open");
    aiOpen = false;
    sidebar.classList.add("open");
    sidebarOpen = true;
    overlay.classList.add("visible");
  }

  /* ── Open AI panel ── */
  function openAI() {
    sidebar.classList.remove("open");
    sidebarOpen = false;
    /* Remove desktop closed class so the open transition works */
    aiPanel.classList.remove("closed");
    aiPanel.classList.add("open");
    aiOpen = true;
    overlay.classList.add("visible");
  }

  /* ── Overlay tap → close ── */
  overlay.addEventListener("click", closeAll);

  /* ── Bottom nav ── */
  if (bottomNav) {
    bottomNav.addEventListener("click", function (e) {
      const btn = e.target.closest(".mob-nav-btn");
      if (!btn) return;
      const view = btn.dataset.view;

      /* Update active state */
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

  /* ── Mobile hamburger → sidebar drawer ── */
  menuBtn.addEventListener("click", function (e) {
    if (window.innerWidth <= MOBILE_BP) {
      e.stopImmediatePropagation();
      if (sidebarOpen) { closeAll(); }
      else             { openSidebar(); }
    }
  }, true);

  /* ── Tablet AI btn → drawer ── */
  aiBtn.addEventListener("click", function (e) {
    if (window.innerWidth <= TABLET_BP) {
      e.stopImmediatePropagation();
      if (aiOpen) { closeAll(); }
      else        { openAI(); }
    }
  }, true);

  /* ── Pick a doc → close sidebar ── */
  fileListEl.addEventListener("click", function () {
    if (window.innerWidth <= MOBILE_BP && sidebarOpen) {
      setTimeout(closeAll, 160);
    }
  });

  /* ── Resize cleanup ── */
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

  /* ── Prevent scroll-through on overlay touch ── */
  overlay.addEventListener("touchmove", function (e) {
    e.preventDefault();
  }, { passive: false });

  /* ── Init ── */
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
  const chars = text.length; // ← add this
  const minutes = Math.ceil(words / 200);

  document.getElementById("wordCount").textContent =
    words === 1 ? "1 word" : `${words.toLocaleString()} words`;

  document.getElementById("charCount").textContent = // ← add this
    `${chars.toLocaleString()} chars`;

  document.getElementById("readTime").textContent =
    minutes <= 1 ? "< 1 min read" : `${minutes} min read`;
}

// Handle Google OAuth redirect
(function handleGoogleAuth() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const name = params.get('name');
  const email = params.get('email');

  if (token) {
    localStorage.setItem('euscribe_token', token);
    localStorage.setItem('euscribe_user_name', name);
    localStorage.setItem('euscribe_user_email', email);
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
})();