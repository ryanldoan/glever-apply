export function toast(msg: string): void {
  let t = document.getElementById("__glever-apply_toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "__glever-apply_toast";
    Object.assign(t.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      background: "#0d3377",
      color: "#81bbf4",
      padding: "8px 12px",
      borderRadius: "8px",
      zIndex: "2147483647",
      opacity: "0.95",
    } as CSSStyleDeclaration);
    document.body.appendChild(t);
  }
  t.textContent = msg;
  window.setTimeout(() => {
    t?.remove();
  }, 2500);
}

