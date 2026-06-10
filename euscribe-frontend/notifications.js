/* ============================================================
   EUSCRIBE — CUSTOM NOTIFICATION SYSTEM
   Replaces: alert(), confirm(), prompt()
   Usage:
     EuNotify.toast("Message")
     EuNotify.toast("Message", "success" | "error" | "warning" | "info")
     EuNotify.confirm("Are you sure?").then(yes => { if (yes) doThing() })
     EuNotify.prompt("Enter URL", "https://").then(val => { if (val) doThing(val) })
   ============================================================ */

const EuNotify = (function () {

  /* ── inject base styles once ── */
  const STYLE_ID = "eu-notify-styles";
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* ── Toast ── */
      #eu-toast-container {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      }
      .eu-toast {
        pointer-events: all;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        border-radius: 10px;
        font-family: 'DM Sans', sans-serif;
        font-size: 13px;
        font-weight: 500;
        color: #e6edf3;
        background: #1a1a1c;
        border: 1px solid #2e2e30;
        box-shadow: 0 8px 32px rgba(0,0,0,0.45);
        max-width: 340px;
        min-width: 220px;
        animation: eu-slide-in 0.25s cubic-bezier(0.34,1.56,0.64,1) forwards;
        cursor: pointer;
        user-select: none;
      }
      .eu-toast.eu-hiding {
        animation: eu-slide-out 0.2s ease forwards;
      }
      .eu-toast-icon {
        font-size: 16px;
        flex-shrink: 0;
        width: 20px;
        text-align: center;
      }
      .eu-toast-msg { flex: 1; line-height: 1.5; }
      .eu-toast-close {
        background: none; border: none; color: #8898b4;
        cursor: pointer; font-size: 15px; padding: 0; line-height: 1;
        flex-shrink: 0; transition: color 0.15s;
      }
      .eu-toast-close:hover { color: #e6edf3; }

      /* toast variants */
      .eu-toast.success { border-color: rgba(34,197,94,0.35); }
      .eu-toast.success .eu-toast-icon { color: #22c55e; }
      .eu-toast.error   { border-color: rgba(239,68,68,0.35); }
      .eu-toast.error   .eu-toast-icon { color: #ef4444; }
      .eu-toast.warning { border-color: rgba(234,179,8,0.35); }
      .eu-toast.warning .eu-toast-icon { color: #eab308; }
      .eu-toast.info    { border-color: rgba(79,140,255,0.35); }
      .eu-toast.info    .eu-toast-icon { color: #4f8cff; }

      /* ── Modal backdrop ── */
      .eu-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 99998;
        background: rgba(0,0,0,0.6);
        backdrop-filter: blur(2px);
        display: flex;
        align-items: center;
        justify-content: center;
        animation: eu-fade-in 0.15s ease forwards;
      }
      .eu-modal-backdrop.eu-hiding {
        animation: eu-fade-out 0.15s ease forwards;
      }

      /* ── Modal box ── */
      .eu-modal {
        background: #16161a;
        border: 1px solid #2a2a2e;
        border-radius: 14px;
        padding: 28px 28px 22px;
        width: 100%;
        max-width: 380px;
        box-shadow: 0 24px 64px rgba(0,0,0,0.6);
        font-family: 'DM Sans', sans-serif;
        color: #e6edf3;
        animation: eu-pop-in 0.2s cubic-bezier(0.34,1.56,0.64,1) forwards;
      }
      .eu-modal-backdrop.eu-hiding .eu-modal {
        animation: eu-pop-out 0.15s ease forwards;
      }
      .eu-modal-icon {
        width: 40px; height: 40px;
        border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        font-size: 20px;
        margin-bottom: 14px;
      }
      .eu-modal-icon.warning { background: rgba(234,179,8,0.12); }
      .eu-modal-icon.error   { background: rgba(239,68,68,0.12); }
      .eu-modal-icon.info    { background: rgba(79,140,255,0.12); }
      .eu-modal-icon.success { background: rgba(34,197,94,0.12); }
      .eu-modal-title {
        font-size: 15px;
        font-weight: 600;
        margin-bottom: 6px;
        color: #f0f0f0;
      }
      .eu-modal-body {
        font-size: 13px;
        color: #8898b4;
        line-height: 1.6;
        margin-bottom: 20px;
      }
      .eu-modal-input {
        width: 100%;
        background: #0e0e10;
        border: 1px solid #2a2a2e;
        border-radius: 8px;
        padding: 10px 12px;
        font-size: 13px;
        font-family: 'DM Sans', sans-serif;
        color: #e6edf3;
        outline: none;
        box-sizing: border-box;
        margin-bottom: 20px;
        transition: border-color 0.15s;
      }
      .eu-modal-input:focus { border-color: #4f8cff; }
      .eu-modal-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
      .eu-btn {
        padding: 8px 18px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        font-family: 'DM Sans', sans-serif;
        cursor: pointer;
        border: none;
        transition: opacity 0.15s, transform 0.1s;
      }
      .eu-btn:active { transform: scale(0.97); }
      .eu-btn-cancel {
        background: rgba(255,255,255,0.06);
        border: 1px solid #2a2a2e;
        color: #8898b4;
      }
      .eu-btn-cancel:hover { color: #e6edf3; border-color: #3a3a3e; }
      .eu-btn-confirm {
        background: linear-gradient(135deg, #4f8cff, #3a7de8);
        color: #fff;
      }
      .eu-btn-confirm:hover { opacity: 0.9; }
      .eu-btn-danger {
        background: linear-gradient(135deg, #ef4444, #dc2626);
        color: #fff;
      }
      .eu-btn-danger:hover { opacity: 0.9; }

      /* ── Keyframes ── */
      @keyframes eu-slide-in {
        from { opacity: 0; transform: translateX(20px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes eu-slide-out {
        from { opacity: 1; transform: translateX(0); }
        to   { opacity: 0; transform: translateX(20px); }
      }
      @keyframes eu-fade-in {
        from { opacity: 0; } to { opacity: 1; }
      }
      @keyframes eu-fade-out {
        from { opacity: 1; } to { opacity: 0; }
      }
      @keyframes eu-pop-in {
        from { opacity: 0; transform: scale(0.93); }
        to   { opacity: 1; transform: scale(1); }
      }
      @keyframes eu-pop-out {
        from { opacity: 1; transform: scale(1); }
        to   { opacity: 0; transform: scale(0.93); }
      }

      @media (max-width: 480px) {
        #eu-toast-container { bottom: 80px; right: 12px; left: 12px; }
        .eu-toast { max-width: 100%; }
        .eu-modal { margin: 16px; max-width: 100%; }
      }
    `;
    document.head.appendChild(style);
  }

  /* ── Toast container ── */
  function getToastContainer() {
    let el = document.getElementById("eu-toast-container");
    if (!el) {
      el = document.createElement("div");
      el.id = "eu-toast-container";
      document.body.appendChild(el);
    }
    return el;
  }

  /* ── Icon map ── */
  const ICONS = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
    confirm: "⚠",
    prompt: "✎",
  };

  /* ============================================================
     TOAST
     EuNotify.toast("Saved!", "success")
     EuNotify.toast("Something went wrong", "error")
     EuNotify.toast("Are you sure?", "warning")
     EuNotify.toast("Tip: select text first", "info")
     Default type = "info"
  ============================================================ */
  function toast(message, type = "info", duration = 3500) {
    injectStyles();
    const container = getToastContainer();

    const el = document.createElement("div");
    el.className = `eu-toast ${type}`;
    el.innerHTML = `
      <span class="eu-toast-icon">${ICONS[type] || ICONS.info}</span>
      <span class="eu-toast-msg">${message}</span>
      <button class="eu-toast-close" aria-label="Dismiss">×</button>
    `;

    const dismiss = () => {
      el.classList.add("eu-hiding");
      el.addEventListener("animationend", () => el.remove(), { once: true });
    };

    el.querySelector(".eu-toast-close").addEventListener("click", dismiss);
    el.addEventListener("click", dismiss);
    container.appendChild(el);

    setTimeout(dismiss, duration);
  }

  /* ============================================================
     MODAL (base) — internal helper
  ============================================================ */
  function createModal({ icon, iconType = "info", title, body, actions }) {
    injectStyles();
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "eu-modal-backdrop";

      const actionsHTML = actions
        .map(
          (a, i) =>
            `<button class="eu-btn ${a.style}" data-idx="${i}">${a.label}</button>`,
        )
        .join("");

      backdrop.innerHTML = `
        <div class="eu-modal" role="dialog" aria-modal="true">
          <div class="eu-modal-icon ${iconType}">${icon}</div>
          <div class="eu-modal-title">${title}</div>
          <div class="eu-modal-body">${body}</div>
          ${actionsHTML}
        </div>
      `;

      // Wrap actions inside .eu-modal-actions
      const modal = backdrop.querySelector(".eu-modal");
      const btns = [...modal.querySelectorAll(".eu-btn")];
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "eu-modal-actions";
      btns.forEach((b) => actionsDiv.appendChild(b));
      modal.appendChild(actionsDiv);

      const close = (value) => {
        backdrop.classList.add("eu-hiding");
        backdrop.addEventListener("animationend", () => {
          backdrop.remove();
          resolve(value);
        }, { once: true });
      };

      btns.forEach((btn, i) => {
        btn.addEventListener("click", () => close(actions[i].value));
      });

      // Close on backdrop click
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) close(actions[actions.length - 1].value);
      });

      // Close on Escape
      const onKey = (e) => {
        if (e.key === "Escape") {
          document.removeEventListener("keydown", onKey);
          close(actions[actions.length - 1].value);
        }
        if (e.key === "Enter") {
          document.removeEventListener("keydown", onKey);
          close(actions[0].value);
        }
      };
      document.addEventListener("keydown", onKey);

      document.body.appendChild(backdrop);

      // Focus first button
      setTimeout(() => btns[0]?.focus(), 50);
    });
  }

  /* ============================================================
     CONFIRM
     Replaces: confirm("Delete this document?")
     Usage: EuNotify.confirm("Delete this document?").then(yes => { if (yes) deleteDoc() })
     Optional: EuNotify.confirm("msg", { title, confirmLabel, danger })
  ============================================================ */
  function confirm(
    message,
    {
      title = "Are you sure?",
      confirmLabel = "Confirm",
      cancelLabel = "Cancel",
      danger = false,
    } = {},
  ) {
    return createModal({
      icon: ICONS.confirm,
      iconType: danger ? "error" : "warning",
      title,
      body: message,
      actions: [
        {
          label: confirmLabel,
          style: danger ? "eu-btn-danger" : "eu-btn-confirm",
          value: true,
        },
        { label: cancelLabel, style: "eu-btn-cancel", value: false },
      ],
    });
  }

  /* ============================================================
     PROMPT
     Replaces: prompt("Enter URL", "https://")
     Usage: EuNotify.prompt("Enter URL", "https://").then(val => { if (val) addLink(val) })
  ============================================================ */
  function prompt(
    message,
    defaultValue = "",
    {
      title = "Enter value",
      confirmLabel = "OK",
      cancelLabel = "Cancel",
    } = {},
  ) {
    injectStyles();
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "eu-modal-backdrop";
      backdrop.innerHTML = `
        <div class="eu-modal" role="dialog" aria-modal="true">
          <div class="eu-modal-icon info">${ICONS.prompt}</div>
          <div class="eu-modal-title">${title}</div>
          <div class="eu-modal-body">${message}</div>
          <input class="eu-modal-input" type="text" value="${defaultValue}" />
          <div class="eu-modal-actions">
            <button class="eu-btn eu-btn-cancel">${cancelLabel}</button>
            <button class="eu-btn eu-btn-confirm">${confirmLabel}</button>
          </div>
        </div>
      `;

      const input = backdrop.querySelector(".eu-modal-input");
      const [cancelBtn, confirmBtn] = backdrop.querySelectorAll(".eu-btn");

      const close = (value) => {
        backdrop.classList.add("eu-hiding");
        backdrop.addEventListener("animationend", () => {
          backdrop.remove();
          resolve(value);
        }, { once: true });
      };

      confirmBtn.addEventListener("click", () => close(input.value.trim() || null));
      cancelBtn.addEventListener("click", () => close(null));

      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) close(null);
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") close(input.value.trim() || null);
        if (e.key === "Escape") close(null);
      });

      document.body.appendChild(backdrop);
      setTimeout(() => {
        input.focus();
        input.select();
      }, 50);
    });
  }

  return { toast, confirm, prompt };
})();
