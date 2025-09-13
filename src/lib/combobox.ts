import { norm, getAccessibleName, wait } from "./utils";
import type { SavedCell } from "./storage";

export function isCombobox(el: HTMLElement): el is HTMLInputElement {
  return (el.getAttribute("role") || "").toLowerCase() === "combobox";
}

export function getComboboxSelectedText(el: HTMLInputElement): string | undefined {
  const container = el.closest('[class*="select__control" i]')?.querySelector('[class*="value-container" i]') as HTMLElement | null;
  if (!container) return undefined;
  const single = container.querySelector('[class*="single-value" i]') as HTMLElement | null;
  if (single && single.textContent) return norm(single.textContent);
  const multi = Array.from(container.querySelectorAll<HTMLElement>('[class*="multi-value__label" i]'))
    .map((n) => norm(n.textContent || ""))
    .filter(Boolean);
  if (multi.length) return multi.join(", ");
  return undefined;
}

export function getComboboxOptions(): Array<{ el: HTMLElement; text: string }> {
  const options = Array.from(document.querySelectorAll<HTMLElement>('[role="listbox"] [role="option"]'));
  return options.map((o) => ({ el: o, text: norm(o.textContent || "") })).filter((o) => !!o.text);
}

export async function applyComboboxBySaved(el: HTMLInputElement, table: Record<string, SavedCell>): Promise<boolean> {
  const ensureOpen = async (): Promise<boolean> => {
    const container = el.closest('[class*="select__control" i]') as HTMLElement | null;
    const indicators = container?.querySelector('[class*="indicators" i]') as HTMLElement | null;
    for (let attempt = 0; attempt < 5; attempt++) {
      el.scrollIntoView({ block: "center" });
      el.focus();
      if (container) {
        container.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
        container.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
        container.click();
      } else {
        el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
        el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
        el.click();
      }
      indicators?.click?.();
      el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
      el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
      await wait(80);
      if (getComboboxOptions().length) return true;
    }
    return getComboboxOptions().length > 0;
  };

  const label = norm(getAccessibleName(el));
  const candidates = Object.values(table).filter((s) => !!s && !!s.selectedText && norm(s.accessibleName || "") === label);
  if (!candidates.length) return false;

  await ensureOpen();
  let options = getComboboxOptions();
  if (!options.length) {
    el.dispatchEvent(new Event("focus", { bubbles: true }));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(50);
    options = getComboboxOptions();
  }
  if (!options.length) return false;

  for (const s of candidates) {
    const target = norm(s.selectedText || "");
    try {
      el.value = target;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      await wait(50);
      options = getComboboxOptions();
    } catch {}
    const match = options.find((o) => o.text === target);
    if (match) {
      match.el.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
      match.el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      match.el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      match.el.click();
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
      return true;
    }
  }
  return false;
}

