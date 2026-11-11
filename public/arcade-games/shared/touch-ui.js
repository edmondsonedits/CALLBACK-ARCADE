"use strict";
(() => {
  // lib/arcade/touch-ui.ts
  var ARCADE_TOUCH_SCOPE = "[data-arcade-touch],.online-phone,.online-host,.arcade-host,.arcade-practice-page,.full-arcade-game";
  var EDITABLE = 'input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]),textarea,select,[contenteditable]:not([contenteditable="false"])';
  var SIZE_KEY = "callback.arcade.touch-size";
  function suppressArcadeCallout(target) {
    const raw = target, element = raw?.closest ? raw : raw?.parentElement;
    return !!element?.closest(ARCADE_TOUCH_SCOPE) && !element.closest(EDITABLE);
  }
  function installArcadeTouchPolicy(doc) {
    const pressed = /* @__PURE__ */ new Map();
    const suppress = (e) => {
      if (suppressArcadeCallout(e.target)) e.preventDefault();
    };
    const protectEditing = (e) => {
      const target = e.target;
      if (target?.closest?.(ARCADE_TOUCH_SCOPE) && (target.closest(EDITABLE) || target.closest("[data-arcade-tool]"))) e.stopPropagation();
    };
    const down = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0 || !suppressArcadeCallout(e.target)) return;
      const button = e.target?.closest("button");
      if (!button || button.hasAttribute("disabled")) return;
      pressed.set(e.pointerId, button);
      button.dataset.touchPressed = "true";
    };
    const up = (e) => {
      const button = pressed.get(e.pointerId);
      pressed.delete(e.pointerId);
      if (button && ![...pressed.values()].includes(button)) delete button.dataset.touchPressed;
    };
    const clear = () => {
      for (const button of pressed.values()) delete button.dataset.touchPressed;
      pressed.clear();
    };
    const visibility = () => {
      if (doc.hidden) clear();
    };
    const reset = () => {
      clear();
      doc.defaultView?.dispatchEvent(new Event("arcade:controls-reset"));
    };
    for (const name of ["contextmenu", "selectstart", "dragstart"]) doc.addEventListener(name, suppress, { capture: true });
    doc.addEventListener("keydown", protectEditing, { capture: true });
    doc.addEventListener("pointerdown", down, { capture: true });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) doc.addEventListener(name, up, { capture: true });
    doc.addEventListener("visibilitychange", visibility);
    doc.defaultView?.addEventListener("blur", clear);
    doc.defaultView?.addEventListener("arcade:controls-reset", clear);
    doc.defaultView?.addEventListener("resize", reset);
    doc.defaultView?.addEventListener("pagehide", reset);
    return () => {
      clear();
      for (const name of ["contextmenu", "selectstart", "dragstart"]) doc.removeEventListener(name, suppress, true);
      doc.removeEventListener("keydown", protectEditing, true);
      doc.removeEventListener("pointerdown", down, true);
      for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) doc.removeEventListener(name, up, true);
      doc.removeEventListener("visibilitychange", visibility);
      doc.defaultView?.removeEventListener("blur", clear);
      doc.defaultView?.removeEventListener("arcade:controls-reset", clear);
      doc.defaultView?.removeEventListener("resize", reset);
      doc.defaultView?.removeEventListener("pagehide", reset);
    };
  }
  function installControlSizeToggle(button, root) {
    const win = root.ownerDocument.defaultView;
    let large = false;
    const apply = () => {
      root.dataset.arcadeControls = large ? "large" : "standard";
      button.setAttribute("aria-pressed", String(large));
      button.textContent = large ? "Standard controls" : "Larger controls";
    };
    const restore = () => {
      try {
        large = win.localStorage.getItem(SIZE_KEY) === "large";
      } catch {
        large = false;
      }
      apply();
    };
    const storage = (e) => {
      if (e.key === SIZE_KEY) {
        win.dispatchEvent(new Event("arcade:controls-reset"));
        restore();
      }
    };
    const click = () => {
      win.dispatchEvent(new Event("arcade:controls-reset"));
      large = !large;
      try {
        win.localStorage.setItem(SIZE_KEY, large ? "large" : "standard");
      } catch {
        button.title = "This control size applies to the current game.";
      }
      apply();
    };
    button.classList.add("arcade-touch-size");
    button.dataset.arcadeTool = "";
    button.type = "button";
    button.setAttribute("aria-label", "Toggle larger touch controls");
    restore();
    button.addEventListener("click", click);
    win.addEventListener("storage", storage);
    return () => {
      button.removeEventListener("click", click);
      win.removeEventListener("storage", storage);
    };
  }

  // lib/arcade/touch-bootstrap.ts
  document.body.dataset.arcadeTouch = "";
  installArcadeTouchPolicy(document);
  if (new URLSearchParams(location.search).get("online") !== "1") {
    const button = document.createElement("button");
    installControlSizeToggle(button, document.body);
    const place = () => {
      if (button.isConnected) return;
      const menu = [".cp-controller-header", ".arcade-title-buttons", ".su-scroll", "#setupOverlay .setup-actions", "#setupModal .modal-buttons", "#setup .modalBtns", "#menuOv .menu-actions", "#menu .actions", "#settingsDialog .dialogFoot", "#modal .modalBtns", "#settingsModal .modal-buttons"].map((selector) => document.querySelector(selector)).find(Boolean);
      if (menu) menu.appendChild(button);
    };
    const observer = new MutationObserver(place);
    observer.observe(document.body, { childList: true, subtree: true });
    place();
    window.addEventListener("pagehide", (e) => {
      if (!e.persisted) observer.disconnect();
    });
  }
})();
