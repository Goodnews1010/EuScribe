/* ============================================================
   EUSCRIBE — NOTIFICATION & MODAL SYSTEM
   Replaces: confirm(), prompt(), alert()
   Exports:  euConfirm(message, options) → Promise<boolean>
             euPrompt(message, options)  → Promise<string|null>
             euToast(message, type)      → void
   ============================================================ */

(function () {

  /* ── Inject styles once ── */
  const style = document.createElement("style");
  style.textContent = `
    .eu-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 99998;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      animation: euFadeIn 0.15s ease;
    }
    .eu-modal {
      background: #1a1a1c;
      border: 0.5px solid #2e2e30;
      border-radius: 14px;
      padding: 1.5rem;
      width: 100%;
      max-width: 380px;
      font-family: 'DM Sans', sans-serif;
      animation: euSlideUp 0.18s ease;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
    }
    .eu-modal-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      margin-bottom: 1rem;
    }
    .eu-modal-icon.danger  { background: rgba(255, 92, 92, 0.1); }
    .eu-modal-icon.info    { background: rgba(79, 140, 255, 0.1); }
    .eu-modal-icon.warning { background: rgba(255, 180, 0, 0.1); }
    .eu-modal-title {
      font-family: 'Syne', sans-serif;
      font-size: 16px;
      font-weight: 600;
      color: #f0f0f0;
      margin-bottom: 6px;
    }
    .eu-modal-message {
      font-size: 13.5px;
      color: #888;
      line-height: 1.6;
      margin-bottom: 1.25rem;
    }
    .eu-modal-input {
      width: 100%;
      background: #111113;
      border: 0.5px solid #2e2e30;
      border-radius: 8px;
      padding: 10px 13px;
      color: #e0e0e0;
      font-size: 14px;
      font-family: 'DM Sans', sans-serif;
      outline: none;
      margin-bottom: 1.25rem;
      transition: border-color 0.15s;
    }
    .eu-modal-input:focus { border-color: #4f8cff; }
    .eu-modal-input::placeholder { color: #3e3e40; }
    .eu-modal-btns {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .eu-modal-btn {
      padding: 9px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
      border: none;
    }
    .eu-modal-btn:active { transform: scale(0.97); }
    .eu-modal-btn.cancel {
      background: #232325;
      border: 0.5px solid #2e2e30;
      color: #888;
    }
    .eu-modal-btn.cancel:hover { background: #2a2a2d; color: #ccc; }
    .eu-modal-btn.confirm-danger {
      background: rgba(255, 92, 92, 0.15);
      border: 0.5px solid rgba(255, 92, 92, 0.3);
      color: #ff7070;
    }
    .eu-modal-btn.confirm-danger:hover { background: rgba(255, 92, 92, 0.25); }
    .eu-modal-btn.confirm-primary {
      background: #161b22;
      border: 1px solid #9aa4b2;
      color: #4f8cff;
    }
    .eu-modal-btn.confirm-primary:hover { background: #4f8cff; color: #fff; border-color: #4f8cff; }

    /* Toast */
    #eu-toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    }
    .eu-toast {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 11px 16px;
      border-radius: 10px;
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      font-weight: 500;
      pointer-events: all;
      animation: euSlideLeft 0.25s ease;
      max-width: 320px;
    }
    .eu-toast.success { background: rgba(61,214,140,0.1); border: 1px solid rgba(61,214,140,0.25); color: #3dd68c; }
    .eu-toast.error   { background: rgba(255,92,92,0.08);  border: 1px solid rgba(255,92,92,0.25);  color: #ff7070; }
    .eu-toast.info    { background: rgba(79,140,255,0.08); border: 1px solid rgba(79,140,255,0.25); color: #4f8cff; }
    .eu-toast.warning { background: rgba(255,180,0,0.08);  border: 1px solid rgba(255,180,0,0.25);  color: #ffb400; }
    .eu-toast-icon { font-size: 15px; flex-shrink: 0; }
    .eu-toast-msg  { flex: 1; line-height: 1.4; }

    @keyframes euFadeIn    { from { opacity: 0; }                        to { opacity: 1; } }
    @keyframes euSlideUp   { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes euSlideLeft { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes euFadeOut   { from { opacity: 1; }                        to { opacity: 0; } }

    @media (max-width: 480px) {
      .eu-modal { padding: 1.25rem; }
      #eu-toast-container { bottom: 80px; right: 12px; left: 12px; }
      .eu-toast { max-width: 100%; }
    }
  `;
  document.head.appendChild(style);

  /* ── Toast container ── */
  const toastContainer = document.createElement("div");
  toastContainer.id = "eu-toast-container";
  document.body.appendChild(toastContainer);

  /* ============================================================
     euToast(message, type)
     type: 'success' | 'error' | 'info' | 'warning'
  ============================================================ */
  const toastIcons = { success: "✓", error: "✕", info: "ℹ", warning: "⚠" };

  window.euToast = function (message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `eu-toast ${type}`;
    toast.innerHTML = `
      <span class="eu-toast-icon">${toastIcons[type] || "ℹ"}</span>
      <span class="eu-toast-msg">${message}</span>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = "euFadeOut 0.25s ease forwards";
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  };

  /* ============================================================
     euConfirm(message, options) → Promise<boolean>
     options: { title, confirmText, cancelText, type }
  ============================================================ */
  window.euConfirm = function (message, options = {}) {
    const {
      title       = "Are you sure?",
      confirmText = "Confirm",
      cancelText  = "Cancel",
      type        = "danger",
    } = options;

    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "eu-modal-backdrop";

      const iconMap = { danger: "🗑️", warning: "⚠️", info: "ℹ️" };

      backdrop.innerHTML = `
        <div class="eu-modal" role="dialog" aria-modal="true">
          <div class="eu-modal-icon ${type}">${iconMap[type] || "⚠️"}</div>
          <div class="eu-modal-title">${title}</div>
          <div class="eu-modal-message">${message}</div>
          <div class="eu-modal-btns">
            <button class="eu-modal-btn cancel" id="eu-cancel-btn">${cancelText}</button>
            <button class="eu-modal-btn confirm-${type === "danger" ? "danger" : "primary"}" id="eu-confirm-btn">${confirmText}</button>
          </div>
        </div>
      `;

      document.body.appendChild(backdrop);
      setTimeout(() => backdrop.querySelector("#eu-confirm-btn").focus(), 50);

      function close(result) {
        backdrop.style.animation = "euFadeOut 0.15s ease forwards";
        setTimeout(() => backdrop.remove(), 150);
        resolve(result);
      }

      backdrop.querySelector("#eu-confirm-btn").addEventListener("click", () => close(true));
      backdrop.querySelector("#eu-cancel-btn").addEventListener("click",  () => close(false));
      backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(false); });

      function onKey(e) {
        if (e.key === "Escape") { document.removeEventListener("keydown", onKey); close(false); }
        if (e.key === "Enter")  { document.removeEventListener("keydown", onKey); close(true); }
      }
      document.addEventListener("keydown", onKey);
    });
  };

  /* ============================================================
     euPrompt(message, options) → Promise<string|null>
     options: { title, placeholder, defaultValue, confirmText, cancelText }
  ============================================================ */
  window.euPrompt = function (message, options = {}) {
    const {
      title        = "Enter value",
      placeholder  = "",
      defaultValue = "",
      confirmText  = "OK",
      cancelText   = "Cancel",
    } = options;

    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "eu-modal-backdrop";

      backdrop.innerHTML = `
        <div class="eu-modal" role="dialog" aria-modal="true">
          <div class="eu-modal-icon info">🔗</div>
          <div class="eu-modal-title">${title}</div>
          <div class="eu-modal-message">${message}</div>
          <input class="eu-modal-input" id="eu-prompt-input" type="text"
                 placeholder="${placeholder}" value="${defaultValue}" />
          <div class="eu-modal-btns">
            <button class="eu-modal-btn cancel" id="eu-cancel-btn">${cancelText}</button>
            <button class="eu-modal-btn confirm-primary" id="eu-confirm-btn">${confirmText}</button>
          </div>
        </div>
      `;

      document.body.appendChild(backdrop);

      const input = backdrop.querySelector("#eu-prompt-input");
      setTimeout(() => { input.focus(); input.select(); }, 50);

      function close(result) {
        backdrop.style.animation = "euFadeOut 0.15s ease forwards";
        setTimeout(() => backdrop.remove(), 150);
        resolve(result);
      }

      backdrop.querySelector("#eu-confirm-btn").addEventListener("click", () => close(input.value.trim() || null));
      backdrop.querySelector("#eu-cancel-btn").addEventListener("click",  () => close(null));
      backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(null); });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter")  { e.preventDefault(); close(input.value.trim() || null); }
        if (e.key === "Escape") close(null);
      });
    });
  };

})();