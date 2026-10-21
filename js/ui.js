/* Shared dialog lifecycle: keep focus inside, make the background inert, restore the opener. */
(function () {
  const layers = [];
  function focusables(root) {
    return [...root.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
      .filter(el => !el.disabled && el.tabIndex >= 0 && !el.closest('[inert]') && el.getClientRects().length);
  }
  function open(root, initial, dismiss) {
    if (layers.some(layer => layer.root === root)) return;
    const layer = { root, opener: document.activeElement, inert: [], dismiss, overflow: document.body.style.overflow };
    root.hidden = false;
    root.inert = false;
    // Also works for a drawer nested inside the application shell.
    let node = root;
    while (node.parentElement) {
      [...node.parentElement.children].filter(el => el !== node).forEach(el => {
        layer.inert.push([el, el.inert]); el.inert = true;
      });
      node = node.parentElement;
      if (node === document.body) break;
    }
    document.body.style.overflow = "hidden";
    layers.push(layer);
    const target = initial || focusables(root)[0] || root;
    if (!target.hasAttribute("tabindex") && !target.matches("button,input,select,textarea,a")) target.tabIndex = -1;
    target.focus({ preventScroll: true });
  }
  function close(root) {
    const i = layers.findIndex(layer => layer.root === root);
    if (i < 0) return;
    const layer = layers.splice(i, 1)[0];
    layer.inert.forEach(([el, was]) => { el.inert = was; });
    document.body.style.overflow = layer.overflow;
    const target = layer.opener?.isConnected && !layer.opener.closest("[inert]") ? layer.opener : document.querySelector("#view");
    target?.focus({ preventScroll: true });
  }
  document.addEventListener("keydown", e => {
    const layer = layers[layers.length - 1];
    if (!layer) return;
    if (e.key === "Escape") {
      e.preventDefault(); e.stopImmediatePropagation(); layer.dismiss?.(); return;
    }
    if (e.key !== "Tab") return;
    const items = focusables(layer.root), first = items[0], last = items[items.length - 1];
    if (!first) { e.preventDefault(); return; }
    if (e.shiftKey && (document.activeElement === first || !items.includes(document.activeElement))) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !items.includes(document.activeElement))) {
      e.preventDefault(); first.focus();
    }
  }, true);
  window.CCUI = { open, close };
})();
