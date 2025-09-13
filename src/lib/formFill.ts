import { detectATS, type ATS } from "./ats";
import { storage, type SavedCell } from "./storage";
import { SELECTOR_FORM_CONTROLS, norm, getAccessibleName, optionSetSignature, sameOptionSet } from "./utils";
import { isCombobox, getComboboxSelectedText, applyComboboxBySaved } from "./combobox";
import { toast } from "./toast";

export function readValue(el: HTMLElement): string | boolean | null {
  const tag = el.tagName.toLowerCase();
  if (tag === "input") {
    const inp = el as HTMLInputElement;
    const t = (inp.type || "").toLowerCase();
    if (t === "checkbox") return !!inp.checked;
    if (t === "radio") return inp.checked ? inp.value : null;
    return inp.value;
  }
  if (tag === "textarea") return (el as HTMLTextAreaElement).value;
  if (tag === "select") return (el as HTMLSelectElement).value;
  return null;
}

export function dispatchValueEvents(el: HTMLElement): void {
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
}

export function setValue(el: HTMLElement, v: unknown): void {
  const tag = el.tagName.toLowerCase();
  if (tag === "input") {
    const inp = el as HTMLInputElement;
    const t = (inp.type || "").toLowerCase();
    if (t === "file") return;
    if (t === "checkbox") inp.checked = !!v;
    else if (t === "radio") {
      if (String(inp.value).toLowerCase() === String(v).toLowerCase()) inp.checked = true;
    } else {
      inp.value = String(v ?? "");
    }
  } else if (tag === "textarea") {
    (el as HTMLTextAreaElement).value = String(v ?? "");
  } else if (tag === "select") {
    (el as HTMLSelectElement).value = String(v ?? "");
  }
  dispatchValueEvents(el);
}

export function controlKey(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const type = (el.getAttribute("type") || "").toLowerCase();
  const name = (el.getAttribute("name") || "").toLowerCase();
  const ac = (el.getAttribute("autocomplete") || "").toLowerCase();
  const label = norm(getAccessibleName(el));
  const opt = optionSetSignature(el) || "";
  return JSON.stringify({ tag, type, name, ac, label, opt });
}

export function findSavedForSelectFallback(el: HTMLSelectElement, table: Record<string, SavedCell>): SavedCell | undefined {
  const label = norm(getAccessibleName(el));
  const curSig = optionSetSignature(el as unknown as HTMLElement) || "";
  let preferred: SavedCell | undefined;
  for (const saved of Object.values(table)) {
    if (!saved || saved.tag !== "select") continue;
    if ((saved.accessibleName || "") !== label) continue;
    if (!sameOptionSet(saved.optionSig, curSig) && saved.optionSig !== curSig) continue;
    if ((saved.name || "") === (el.getAttribute("name") || "").toLowerCase()) return saved;
    preferred ||= saved;
  }
  return preferred;
}

export async function captureAndSave(): Promise<void> {
  const ats = detectATS();
  const inputs = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR_FORM_CONTROLS));
  const touched = inputs.filter((el) => {
    if (el instanceof HTMLInputElement) {
      const inputEl = el as HTMLInputElement;
      if (inputEl.type === "checkbox") return inputEl.checked;
      if (inputEl.type === "radio") return inputEl.checked || !!inputEl.value;
      if (isCombobox(inputEl)) {
        const selText = getComboboxSelectedText(inputEl);
        return !!(selText || inputEl.value);
      }
      return String(inputEl.value || "").length > 0;
    }
    if (el instanceof HTMLTextAreaElement) return !!el.value;
    if (el instanceof HTMLSelectElement) return !!el.value;
    return false;
  });

  const current = await storage.get();
  const table = current[ats] || {};
  for (const el of touched) {
    let val = readValue(el);
    if (el.tagName.toLowerCase() === "input" && isCombobox(el as HTMLInputElement)) {
      const text = getComboboxSelectedText(el as HTMLInputElement);
      if ((val === null || val === "") && text) val = text;
    }
    if (val === null || val === "") continue;
    const key = controlKey(el);
    table[key] = {
      value: val as string | boolean,
      tag: el.tagName.toLowerCase(),
      type: (el.getAttribute("type") || "").toLowerCase(),
      name: (el.getAttribute("name") || "").toLowerCase(),
      autocomplete: (el.getAttribute("autocomplete") || "").toLowerCase(),
      accessibleName: norm(getAccessibleName(el)),
      optionSig: optionSetSignature(el) || "",
      selectedText:
        el.tagName.toLowerCase() === "select"
          ? norm((el as HTMLSelectElement).selectedOptions?.[0]?.text || "")
          : isCombobox(el as HTMLElement)
          ? getComboboxSelectedText(el as HTMLInputElement)
          : undefined,
    };
  }
  current[ats] = table;
  await storage.set(current);
  toast(`Saved application data for future ${ats.charAt(0).toUpperCase() + ats.slice(1)} forms.`);
}

export async function applySaved(): Promise<number> {
  const ats = detectATS();
  const profiles = await storage.get();
  const table = profiles[ats] || {};
  const inputs = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR_FORM_CONTROLS));
  let filled = 0;
  for (const el of inputs) {
    let saved: SavedCell | undefined;
    const key = controlKey(el);
    saved = table[key];

    if (saved) {
      if (saved.tag !== el.tagName.toLowerCase()) saved = undefined;
      else if ((saved.type || "") !== (el.getAttribute("type") || "").toLowerCase()) saved = undefined;
      else if ((saved.name || "") !== (el.getAttribute("name") || "").toLowerCase()) saved = undefined;
      else if ((saved.autocomplete || "") !== (el.getAttribute("autocomplete") || "").toLowerCase()) saved = undefined;
      else {
        const currentSig = optionSetSignature(el) || "";
        const sigMatches = saved.optionSig === currentSig || sameOptionSet(saved.optionSig, currentSig);
        if (el.tagName.toLowerCase() !== "select") {
          if ((saved.optionSig || "") !== currentSig) saved = undefined;
        } else if (!sigMatches) saved = undefined;
        if (saved && (saved.accessibleName || "") !== norm(getAccessibleName(el))) saved = undefined;
      }
    }

    if (!saved && el.tagName.toLowerCase() === "select") {
      saved = findSavedForSelectFallback(el as HTMLSelectElement, table);
    }
    if (!saved) continue;

    if (el.tagName.toLowerCase() === "select") {
      const sel = el as HTMLSelectElement;
      let applied = false;
      if (typeof saved.value === "string" && saved.value) {
        const desired = String(saved.value);
        const hasValue = Array.from(sel.options).some((o) => String(o.value) === desired);
        if (hasValue) {
          sel.value = desired;
          applied = true;
        }
      }
      if (!applied && saved.selectedText) {
        const targetText = norm(saved.selectedText);
        const match = Array.from(sel.options).find((o) => norm(o.text) === targetText);
        if (match) {
          sel.value = match.value;
          applied = true;
        }
      }
      if (applied) {
        dispatchValueEvents(sel as unknown as HTMLElement);
        filled++;
      }
      continue;
    }

    if (isCombobox(el as HTMLElement)) {
      let ok = await applyComboboxBySaved(el as HTMLInputElement, table);
      if (!ok) ok = await applyComboboxBySaved(el as HTMLInputElement, table);
      if (ok) {
        filled++;
        continue;
      }
    }

    setValue(el, saved.value);
    filled++;
  }
  return filled;
}

export async function clearSaved(): Promise<void> {
  const ats = detectATS();
  const ok = window.confirm(`Clear all saved data for ${ats}?`);
  if (!ok) return;
  const profiles = await storage.get();
  profiles[ats] = {} as Record<string, SavedCell>;
  await storage.set(profiles);
  toast(`Cleared saved ${ats.charAt(0).toUpperCase() + ats.slice(1)} profile.`);
}

export async function exportSaved(): Promise<void> {
  const ats = detectATS();
  const profiles = await storage.get();
  const table = profiles[ats] || {};
  if (!Object.keys(table).length) return toast(`No saved data for ${ats.charAt(0).toUpperCase() + ats.slice(1)} to export.`);
  const payload = { ats, exportedAt: new Date().toISOString(), count: Object.keys(table).length, data: table };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `glever-apply-${ats}-profile.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast(`Exported ${payload.count} ${ats.charAt(0).toUpperCase() + ats.slice(1)} field(s).`);
}

export async function importSaved(): Promise<void> {
  const ats = detectATS();
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json,application/json";
  fileInput.style.display = "none";
  fileInput.addEventListener("change", async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as { ats?: ATS; data?: Record<string, SavedCell> };
      const incoming = parsed.data || (parsed as unknown as Record<string, SavedCell>);
      if (!incoming || typeof incoming !== "object") throw new Error("Invalid payload");
      const profiles = await storage.get();
      const table = profiles[ats] || {};
      let merged = 0;
      for (const [k, v] of Object.entries(incoming)) {
        if (!v || typeof v !== "object") continue;
        if (!("value" in v) || !("tag" in v)) continue;
        table[k] = v as SavedCell;
        merged++;
      }
      profiles[ats] = table;
      await storage.set(profiles);
      toast(`Imported ${merged} ${ats.charAt(0).toUpperCase() + ats.slice(1)} field(s).`);
    } catch (e) {
      console.error(e);
      toast("Import failed: invalid JSON file");
    } finally {
      fileInput.remove();
    }
  });
  document.body.appendChild(fileInput);
  fileInput.click();
}

export async function hasAnySavedData(): Promise<boolean> {
  const ats = detectATS();
  const profiles = await storage.get();
  const table = profiles[ats] || {};
  for (const _k in table) return true;
  return false;
}

