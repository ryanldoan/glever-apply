// Shared utilities and DOM helpers

export const SELECTOR_FORM_CONTROLS = "input, textarea, select";

export const norm = (s?: string | null): string => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

// Derive an accessible/visible label for a control.
export function getAccessibleName(el: HTMLElement): string {
  const aria = el.getAttribute?.("aria-label");
  if (aria) return aria;

  const labelledBy = el.getAttribute?.("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent || "")
      .join(" ");
    if (text.trim()) return text;
  }

  const id = (el as HTMLInputElement).id;
  if (id) {
    const lab = document.querySelector(`label[for='${CSS.escape(id)}']`) as HTMLLabelElement | null;
    if (lab?.textContent?.trim()) return lab.textContent;
  }

  const wrap = el.closest("label");
  if (wrap?.textContent?.trim()) return wrap.textContent!;

  const group = el.closest("fieldset, .form-group, section, div") as HTMLElement | null;
  const header = group?.querySelector?.("legend,h1,h2,h3,h4,label,p,span") as HTMLElement | null;
  if (header?.textContent?.trim()) return header.textContent;

  const ph = (el as HTMLInputElement).getAttribute?.("placeholder");
  return ph || "";
}

// Produce a stable signature for option sets (for <select> and radio groups).
export function optionSetSignature(el: HTMLElement): string | undefined {
  const tag = el.tagName.toLowerCase();
  if (tag === "select") {
    const sel = el as HTMLSelectElement;
    const opts = Array.from(sel.options).map((o) => norm(o.text));
    return btoa(unescape(encodeURIComponent(opts.join("|"))));
  }
  if (tag === "input" && (el as HTMLInputElement).type === "radio") {
    const name = (el as HTMLInputElement).name;
    if (!name) return undefined;
    const group = document.querySelectorAll<HTMLInputElement>(`input[type=radio][name="${CSS.escape(name)}"]`);
    const labels = Array.from(group).map((r) => norm(getAccessibleName(r as unknown as HTMLElement)));
    return btoa(unescape(encodeURIComponent(labels.join("|"))));
  }
  return undefined;
}

export function decodeOptionSig(sig?: string): string[] {
  if (!sig) return [];
  try {
    // reverse of btoa(unescape(encodeURIComponent(...)))
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - escape is deprecated but fine for this controlled use
    const decoded = decodeURIComponent(escape(atob(sig)));
    return decoded.split("|").map((s) => norm(s)).filter(Boolean);
  } catch {
    return [];
  }
}

export function sameOptionSet(a?: string, b?: string): boolean {
  const A = decodeOptionSig(a).sort();
  const B = decodeOptionSig(b).sort();
  if (A.length !== B.length) return false;
  for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) return false;
  return true;
}

export function isCombobox(el: HTMLElement): el is HTMLInputElement {
  return (el.getAttribute("role") || "").toLowerCase() === "combobox";
}

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

