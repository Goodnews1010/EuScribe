/* ============================================================
   EUSCRIBE ONBOARDING TOUR  v1.1
   Drop this file alongside index.js and api.js,
   then add  <script src="onboarding.js"></script>
   at the bottom of index.html (after api.js).
   ============================================================ */

(function () {
  "use strict";

  /* ── Guard: once per account, not per browser session ── */
  //
  // Strategy: key the "seen" flag to the logged-in user's
  // email (or token prefix).  That way:
  //   • New account on any device  → tour shows
  //   • Same account after logout/login → tour never shows again
  //   • Guest / no token yet       → falls back to device key
  //
  function getTourKey() {
    const email = localStorage.getItem("euscribe_user_email");
    const token = localStorage.getItem("euscribe_token");
    if (email) return "euscribe_tour_v1__" + email.toLowerCase().trim();
    if (token) return "euscribe_tour_v1__" + token.slice(0, 16);
    return "euscribe_tour_v1__guest";
  }

  // If the OAuth redirect just landed, the token is written by
  // handleOAuthRedirect() in index.js *before* this script runs,
  // so getTourKey() will already see the correct email.
  const STORAGE_KEY = getTourKey();
  if (localStorage.getItem(STORAGE_KEY)) return;

  /* ── Detect viewport ─────────────────────────────────── */
  const isMobile = () => window.innerWidth <= 640;

  /* ── Step definitions ────────────────────────────────── */
  // Each step: { title, body, target?, pos?, icon, mobileOnly?, desktopOnly? }
  // target = CSS selector of element to spotlight
  // pos    = "top" | "bottom" | "left" | "right" | "center"
  function buildSteps() {
    const mobile = isMobile();
    const all = [
      /* 0 — Welcome */
      {
        title: "Welcome to EuScribe ✦",
        body: "Your AI-powered writing assistant. This quick tour will show you everything in about 30 seconds.",
        target: null,
        pos: "center",
        icon: "✦",
      },
      /* 1 — Sidebar / Docs nav */
      mobile
        ? {
            title: "Your Documents",
            body: "Tap the <strong>Docs</strong> tab at the bottom to open your document list. Create, search, and switch between documents anytime.",
            target: '[data-view="docs"]',
            pos: "top",
            icon: "📄",
          }
        : {
            title: "Document Sidebar",
            body: "All your documents live here. Hit <strong>+ New Document</strong> to start fresh, or search through existing ones. Click the hamburger menu to hide/show this panel.",
            target: ".sidebar",
            pos: "right",
            icon: "📄",
          },
      /* 2 — Toolbar */
      {
        title: "Formatting Toolbar",
        body: "Bold, italic, underline, headings, lists, alignment, colours — everything you need to shape your writing. On mobile it scrolls horizontally.",
        target: ".subbar",
        pos: "bottom",
        icon: "🖊️",
      },
      /* 3 — Editor */
      {
        title: "The Writing Canvas",
        body: "Click anywhere here and start typing. Your work is saved automatically every second as you write — watch for the <em>Saving…</em> indicator up top.",
        target: ".text-editor",
        pos: "top",
        icon: "✍️",
      },
      /* 4 — AI panel trigger */
      mobile
        ? {
            title: "AI Assistant",
            body: "Tap <strong>AI</strong> in the bottom nav to open your writing partner. Select text in the editor first, then choose an action.",
            target: '[data-view="ai"]',
            pos: "top",
            icon: "✦",
          }
        : {
            title: "AI Assistant Panel",
            body: "The panel on the right is your writing partner. Select text, then pick an action. Hit the <strong>✦ AI</strong> button in the top bar to toggle it.",
            target: ".ai-panel",
            pos: "left",
            icon: "✦",
          },
      /* 5 — AI tabs */
      {
        title: "Three AI Modes",
        body: "<strong>Improve</strong> — Fix grammar, rewrite, summarise, expand.<br><strong>Tone</strong> — Shift to Formal, Academic, Casual, Creative and more.<br><strong>Custom</strong> — Type any instruction and let AI do it.",
        target: ".ai-tabs",
        pos: mobile ? "top" : "left",
        icon: "🎛️",
      },
      /* 6 — Copy popup */
      {
        title: "Quick-Action Popup",
        body: "Select any text in the editor and a small popup appears at the bottom of the page — <strong>Fix · Rewrite · Summarise · Expand</strong> — one click, instant AI magic.",
        target: ".text-editor",
        pos: "top",
        icon: "⚡",
      },
      /* 7 — Export */
      {
        title: "Export Anywhere",
        body: "Open the <strong>File</strong> menu in the toolbar to save your document as a polished <strong>PDF</strong> or plain <strong>.txt</strong> file at any time.",
        target: mobile ? null : ".toolbar-top",
        pos: "bottom",
        icon: "📤",
      },
      /* 8 — Theme toggle */
      {
        title: "Light & Dark Mode",
        body: "Use the toggle in the top-right corner to switch between dark and light themes. Your preference is remembered.",
        target: ".switch",
        pos: "bottom",
        icon: "🌓",
      },
      /* 9 — Welcome note (final, full-width card) */
      {
        isWelcomeNote: true,
        target: null,
        pos: "center",
        icon: null,
        title: null,
        body: null,
      },
    ];

    return all.filter((s) => {
      if (s.mobileOnly && !mobile) return false;
      if (s.desktopOnly && mobile) return false;
      return true;
    });
  }

  /* ── Inject CSS ──────────────────────────────────────── */
  const style = document.createElement("style");
  style.textContent = `
    /* ── Overlay backdrop ── */
    #eu-tour-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9990;
      background: rgba(0,0,0,0.72);
      pointer-events: all;
      transition: opacity 0.3s;
    }
    #eu-tour-backdrop.done {
      pointer-events: none;
      opacity: 0;
    }

    /* ── Spotlight cutout ── */
    #eu-tour-spotlight {
      position: fixed;
      z-index: 9991;
      border-radius: 10px;
      pointer-events: none;
      transition: all 0.35s cubic-bezier(0.4,0,0.2,1);
      border: 1.5px solid rgba(79,140,255,0.5);
      background: transparent;
      box-shadow: 0 0 0 9999px rgba(0,0,0,0.72);
    }
    #eu-tour-spotlight.done {
      opacity: 0;
      pointer-events: none;
    }

    /* ── Tooltip card ── */
    #eu-tour-card {
      position: fixed;
      z-index: 9995;
      width: 300px;
      background: #161b22;
      border: 1px solid #2a3444;
      border-radius: 14px;
      padding: 20px 20px 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(79,140,255,0.12);
      font-family: Georgia, serif;
      color: #e6edf3;
      transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
      opacity: 0;
      transform: translateY(6px) scale(0.97);
    }
    #eu-tour-card.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }

    .eu-tour-icon {
      font-size: 22px;
      margin-bottom: 8px;
      display: block;
    }
    .eu-tour-step-label {
      font-family: Arial, sans-serif;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: #4f8cff;
      margin-bottom: 4px;
    }
    .eu-tour-title {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 8px;
      line-height: 1.4;
      color: #f0f6ff;
    }
    .eu-tour-body {
      font-size: 13px;
      line-height: 1.7;
      color: #9aa4b2;
      font-family: Arial, sans-serif;
      margin-bottom: 16px;
    }
    .eu-tour-body strong { color: #e6edf3; }
    .eu-tour-body em { color: #c9d1d9; }

    /* Progress dots */
    .eu-tour-dots {
      display: flex;
      gap: 5px;
      align-items: center;
      margin-bottom: 14px;
    }
    .eu-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #2a3444;
      transition: all 0.25s;
      flex-shrink: 0;
    }
    .eu-dot.active {
      background: #4f8cff;
      width: 18px;
      border-radius: 3px;
    }
    .eu-dot.done {
      background: #2f4a80;
    }

    /* Buttons row */
    .eu-tour-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .eu-tour-skip {
      background: none;
      border: none;
      color: #4a5568;
      font-size: 12px;
      cursor: pointer;
      padding: 0;
      font-family: Arial, sans-serif;
      transition: color 0.2s;
      margin-right: auto;
    }
    .eu-tour-skip:hover { color: #9aa4b2; }
    .eu-tour-back {
      padding: 8px 14px;
      background: #1e2633;
      border: 1px solid #2a3444;
      border-radius: 8px;
      color: #9aa4b2;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: Arial, sans-serif;
      transition: all 0.2s;
    }
    .eu-tour-back:hover { background: #232c3d; color: #e6edf3; }
    .eu-tour-back:disabled { opacity: 0.3; cursor: default; }
    .eu-tour-next {
      padding: 8px 18px;
      background: #4f8cff;
      border: none;
      border-radius: 8px;
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      font-family: Arial, sans-serif;
      transition: all 0.2s;
      letter-spacing: 0.2px;
    }
    .eu-tour-next:hover { background: #3a7aff; transform: translateY(-1px); }

    /* Arrow pointer */
    #eu-tour-arrow {
      position: fixed;
      z-index: 9994;
      width: 12px;
      height: 12px;
      background: #161b22;
      border: 1px solid #2a3444;
      transform: rotate(45deg);
      transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
      pointer-events: none;
    }

    /* Mobile — card full-width bottom sheet style */
    @media (max-width: 640px) {
      #eu-tour-card {
        width: calc(100vw - 32px);
        left: 16px !important;
        right: 16px !important;
      }
    }
  `;
  document.head.appendChild(style);

  /* ── Build DOM ───────────────────────────────────────── */
  const backdrop = document.createElement("div");
  backdrop.id = "eu-tour-backdrop";
  document.body.appendChild(backdrop);

  const spotlight = document.createElement("div");
  spotlight.id = "eu-tour-spotlight";
  document.body.appendChild(spotlight);

  const arrow = document.createElement("div");
  arrow.id = "eu-tour-arrow";
  document.body.appendChild(arrow);

  const card = document.createElement("div");
  card.id = "eu-tour-card";
  document.body.appendChild(card);

  /* ── State ───────────────────────────────────────────── */
  let steps = buildSteps();
  let current = 0;

  /* ── Spotlight a target element ─────────────────────── */
  function spotlightEl(selector) {
    if (!selector) {
      spotlight.style.opacity = "0";
      arrow.style.opacity = "0";
      return;
    }
    const el = document.querySelector(selector);
    if (!el) {
      spotlight.style.opacity = "0";
      arrow.style.opacity = "0";
      return;
    }
    spotlight.style.opacity = "1";
    const r = el.getBoundingClientRect();
    const PAD = 6;
    spotlight.style.top    = (r.top    - PAD) + "px";
    spotlight.style.left   = (r.left   - PAD) + "px";
    spotlight.style.width  = (r.width  + PAD * 2) + "px";
    spotlight.style.height = (r.height + PAD * 2) + "px";
  }

  /* ── Position card relative to target ───────────────── */
  function positionCard(step) {
    const MARGIN = 16;
    const cardW = isMobile() ? window.innerWidth - 32 : 300;
    const cardEl = card;

    // Wait for card to have dimensions
    const cardH = cardEl.offsetHeight || 220;

    let top, left;

    if (!step.target || step.pos === "center") {
      top  = window.innerHeight / 2 - cardH / 2;
      left = window.innerWidth  / 2 - cardW  / 2;
      arrow.style.opacity = "0";
      cardEl.style.top  = Math.max(MARGIN, top)  + "px";
      cardEl.style.left = Math.max(MARGIN, left) + "px";
      return;
    }

    const el = document.querySelector(step.target);
    if (!el) {
      top  = window.innerHeight / 2 - cardH / 2;
      left = window.innerWidth  / 2 - cardW  / 2;
      arrow.style.opacity = "0";
      cardEl.style.top  = Math.max(MARGIN, top)  + "px";
      cardEl.style.left = Math.max(MARGIN, left) + "px";
      return;
    }

    const r   = el.getBoundingClientRect();
    const elCX = r.left + r.width  / 2;
    const elCY = r.top  + r.height / 2;
    arrow.style.opacity = "1";

    switch (step.pos) {
      case "bottom":
        top  = r.bottom + MARGIN + 6;
        left = elCX - cardW / 2;
        arrow.style.top  = (r.bottom + MARGIN - 1) + "px";
        arrow.style.left = (elCX - 6) + "px";
        arrow.style.borderTop = "none"; arrow.style.borderRight = "none";
        break;
      case "top":
        top  = r.top - cardH - MARGIN - 6;
        left = elCX - cardW / 2;
        arrow.style.top  = (r.top - MARGIN - 7) + "px";
        arrow.style.left = (elCX - 6) + "px";
        arrow.style.borderBottom = "none"; arrow.style.borderLeft = "none";
        break;
      case "right":
        top  = elCY - cardH / 2;
        left = r.right + MARGIN + 6;
        arrow.style.top  = (elCY - 6) + "px";
        arrow.style.left = (r.right + MARGIN - 1) + "px";
        break;
      case "left":
      default:
        top  = elCY - cardH / 2;
        left = r.left - cardW - MARGIN - 6;
        arrow.style.top  = (elCY - 6) + "px";
        arrow.style.left = (r.left - MARGIN - 7) + "px";
        break;
    }

    // Clamp to viewport
    top  = Math.max(MARGIN, Math.min(top,  window.innerHeight - cardH - MARGIN));
    left = Math.max(MARGIN, Math.min(left, window.innerWidth  - cardW - MARGIN));

    if (isMobile()) left = 16;

    cardEl.style.top  = top  + "px";
    cardEl.style.left = left + "px";
  }

  /* ── Render a step ───────────────────────────────────── */
  function render(idx) {
    const step = steps[idx];
    card.classList.remove("visible");

    // Build dots
    const dots = steps.map((_, i) => {
      let cls = "eu-dot";
      if (i < idx)  cls += " done";
      if (i === idx) cls += " active";
      return `<span class="${cls}"></span>`;
    }).join("");

    const isLast = idx === steps.length - 1;
    const userName = localStorage.getItem("euscribe_user_name") || "there";
    const firstName = userName.split(" ")[0];

    if (step.isWelcomeNote) {
      // ── Final welcome note card ──────────────────────────
      card.style.width = isMobile() ? "" : "380px";
      card.innerHTML = `
        <div style="text-align:center;padding:4px 0 18px">
          <div style="font-size:36px;margin-bottom:10px">✦</div>
          <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#f0f6ff;margin-bottom:6px;line-height:1.3">
            Welcome, ${firstName}!
          </div>
          <div style="font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#4f8cff;margin-bottom:18px">
            You're officially in ✦
          </div>
          <div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.85;color:#9aa4b2;text-align:left;background:#0f1117;border:1px solid #2a3444;border-radius:10px;padding:16px 18px;margin-bottom:18px">
            <p style="margin-bottom:10px">EuScribe is your personal AI writing assistant — built to help you write faster, think clearer, and sound better.</p>
            <p style="margin-bottom:10px">Everything saves automatically. Your documents follow you across devices. The AI panel is always one tap away.</p>
            <p style="color:#4f8cff;font-weight:600;margin:0">Now go write something great. ✦</p>
          </div>
          <div style="display:flex;gap:8px;justify-content:center">
            <button class="eu-tour-back" style="flex:1;max-width:100px">← Back</button>
            <button class="eu-tour-next" style="flex:2">Start writing ✦</button>
          </div>
        </div>
      `;
    } else {
      card.style.width = "";
      card.innerHTML = `
        <span class="eu-tour-icon">${step.icon}</span>
        <div class="eu-tour-step-label">Step ${idx + 1} of ${steps.length - 1}</div>
        <div class="eu-tour-title">${step.title}</div>
        <div class="eu-tour-body">${step.body}</div>
        <div class="eu-tour-dots">${dots}</div>
        <div class="eu-tour-actions">
          <button class="eu-tour-skip">Skip tour</button>
          <button class="eu-tour-back" ${idx === 0 ? "disabled" : ""}>← Back</button>
          <button class="eu-tour-next">${isLast ? "Finish →" : "Next →"}</button>
        </div>
      `;
    }

    // Wire buttons (skip only exists on non-welcome-note steps)
    const skipBtn = card.querySelector(".eu-tour-skip");
    if (skipBtn) skipBtn.addEventListener("click", endTour);
    card.querySelector(".eu-tour-back").addEventListener("click", () => {
      if (current > 0) { current--; render(current); }
    });
    card.querySelector(".eu-tour-next").addEventListener("click", () => {
      if (isLast) { endTour(); } else { current++; render(current); }
    });

    // Spotlight
    spotlightEl(step.target);

    // Position card after a tick (needs layout)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        positionCard(step);
        card.classList.add("visible");
      });
    });
  }

  /* ── End tour ────────────────────────────────────────── */
  function endTour() {
    localStorage.setItem(STORAGE_KEY, "1");

    // Immediately stop blocking interaction
    backdrop.classList.add("done");
    spotlight.classList.add("done");
    card.style.pointerEvents = "none";
    arrow.style.opacity = "0";
    card.classList.remove("visible");

    // Clean up DOM after fade
    setTimeout(() => {
      backdrop.remove();
      spotlight.remove();
      arrow.remove();
      card.remove();
    }, 400);
  }

  /* ── Keyboard nav ────────────────────────────────────── */
  document.addEventListener("keydown", function onKey(e) {
    if (e.key === "Escape")     { endTour(); document.removeEventListener("keydown", onKey); }
    if (e.key === "ArrowRight") { if (current < steps.length - 1) { current++; render(current); } }
    if (e.key === "ArrowLeft")  { if (current > 0) { current--; render(current); } }
  });

  /* ── Re-position on resize ───────────────────────────── */
  window.addEventListener("resize", () => {
    steps = buildSteps();
    spotlightEl(steps[current].target);
    positionCard(steps[current]);
  });

  /* ── Kick off ────────────────────────────────────────── */
  // Small delay so the app finishes rendering first
  setTimeout(() => render(0), 600);

})();