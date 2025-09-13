/**
 * Glever Apply
 *
 * Purpose:
 * - Detect ATS (Lever/Greenhouse)
 * - Capture user-entered form values keyed by robust control signatures
 * - Re-apply saved values on future applications (including combobox/select fallbacks)
 * - Provide a small in-page UI for user actions
 * - Help attach a stored resume via file inputs or drop zones
 *
 * NOTE: Keep logic deterministic and conservative; do not guess values.
 */

/** CSS selector for all form controls we consider. */
const SELECTOR_FORM_CONTROLS = "input, textarea, select";

/************* tiny utilities *************/
const norm = (s?: string | null): string =>
  (s || "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Derive an accessible/visible label for a control.
 * Tries aria-label, aria-labelledby, associated <label>, wrapping labels,
 * nearby headings, then placeholder as a last resort.
 */
function getAccessibleName(el: HTMLElement): string {
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
    const lab = document.querySelector(
      `label[for='${CSS.escape(id)}']`
    ) as HTMLLabelElement | null;
    if (lab?.textContent?.trim()) return lab.textContent;
  }

  const wrap = el.closest("label");
  if (wrap?.textContent?.trim()) return wrap.textContent!;

  const group = el.closest(
    "fieldset, .form-group, section, div"
  ) as HTMLElement | null;
  const header = group?.querySelector?.(
    "legend,h1,h2,h3,h4,label,p,span"
  ) as HTMLElement | null;
  if (header?.textContent?.trim()) return header.textContent;

  const ph = (el as HTMLInputElement).getAttribute?.("placeholder");
  return ph || "";
}

/**
 * Produce a stable signature for option sets (for <select> and radio groups).
 * We encode the normalized visible option texts to detect material differences.
 */
function optionSetSignature(el: HTMLElement): string | undefined {
  const tag = el.tagName.toLowerCase();
  if (tag === "select") {
    const sel = el as HTMLSelectElement;
    const opts = Array.from(sel.options).map((o) => norm(o.text));
    return btoa(unescape(encodeURIComponent(opts.join("|"))));
  }
  if (tag === "input" && (el as HTMLInputElement).type === "radio") {
    const name = (el as HTMLInputElement).name;
    if (!name) return undefined;
    const group = document.querySelectorAll<HTMLInputElement>(
      `input[type=radio][name="${CSS.escape(name)}"]`
    );
    const labels = Array.from(group).map((r) =>
      norm(getAccessibleName(r as unknown as HTMLElement))
    );
    return btoa(unescape(encodeURIComponent(labels.join("|"))));
  }
  return undefined;
}

/** Decode an option signature back into a normalized list of labels. */
function decodeOptionSig(sig?: string): string[] {
  if (!sig) return [];
  try {
    // reverse of btoa(unescape(encodeURIComponent(...)))
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - escape is deprecated but fine for this controlled use
    const decoded = decodeURIComponent(escape(atob(sig)));
    return decoded
      .split("|")
      .map((s) => norm(s))
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Compare two option signatures for set equality (order-insensitive).
 */
function sameOptionSet(a?: string, b?: string): boolean {
  const A = decodeOptionSig(a).sort();
  const B = decodeOptionSig(b).sort();
  if (A.length !== B.length) return false;
  for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) return false;
  return true;
}

/**
 * Fallback: find a saved <select> cell by matching label and option set,
 * even if name/autocomplete differ between forms.
 */
function findSavedForSelectFallback(
  el: HTMLSelectElement,
  table: Record<string, SavedCell>
): SavedCell | undefined {
  const label = norm(getAccessibleName(el));
  const curSig = optionSetSignature(el as unknown as HTMLElement) || "";
  let preferred: SavedCell | undefined;
  for (const saved of Object.values(table)) {
    if (!saved || saved.tag !== "select") continue;
    if ((saved.accessibleName || "") !== label) continue;
    if (!sameOptionSet(saved.optionSig, curSig) && saved.optionSig !== curSig)
      continue;
    // Prefer same name if available
    if ((saved.name || "") === (el.getAttribute("name") || "").toLowerCase())
      return saved;
    // Otherwise remember first candidate
    preferred ||= saved;
  }
  return preferred;
}

/** Custom combobox (React-style) helpers **/
/** Return true if element is an ARIA combobox (React-style select). */
function isCombobox(el: HTMLElement): el is HTMLInputElement {
  return (el.getAttribute("role") || "").toLowerCase() === "combobox";
}

/** Type guard: HTMLElement -> HTMLInputElement */
function isInputElement(el: HTMLElement): el is HTMLInputElement {
  return el.tagName.toLowerCase() === "input";
}

/** Type guard: HTMLElement -> HTMLTextAreaElement */
function isTextareaElement(el: HTMLElement): el is HTMLTextAreaElement {
  return el.tagName.toLowerCase() === "textarea";
}

/** Type guard: HTMLElement -> HTMLSelectElement */
function isSelectElement(el: HTMLElement): el is HTMLSelectElement {
  return el.tagName.toLowerCase() === "select";
}

/** Small async delay helper. */
async function wait(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** Try opening a combobox by focusing/clicking common affordances. */
function openCombobox(el: HTMLInputElement): void {
  // Try clicking the input or its container/indicator to open the listbox
  el.focus();
  el.click();
  const container = el.closest(
    '[class*="select__control" i]'
  ) as HTMLElement | null;
  const toggleBtn = container?.querySelector(
    '[aria-label*="toggle" i]'
  ) as HTMLElement | null;
  toggleBtn?.click?.();
}

/** Query visible ARIA options for open combobox menus. */
function getComboboxOptions(): Array<{ el: HTMLElement; text: string }> {
  const options = Array.from(
    document.querySelectorAll<HTMLElement>('[role="listbox"] [role="option"]')
  );
  return options
    .map((o) => ({ el: o, text: norm(o.textContent || "") }))
    .filter((o) => !!o.text);
}

/**
 * Read visible selected label(s) for React-style selects.
 * Supports single-value and multi-value modes.
 */
function getComboboxSelectedText(el: HTMLInputElement): string | undefined {
  const container = el
    .closest('[class*="select__control" i]')
    ?.querySelector('[class*="value-container" i]') as HTMLElement | null;
  if (!container) return undefined;
  const single = container.querySelector(
    '[class*="single-value" i]'
  ) as HTMLElement | null;
  if (single && single.textContent) return norm(single.textContent);
  const multi = Array.from(
    container.querySelectorAll<HTMLElement>('[class*="multi-value__label" i]')
  )
    .map((n) => norm(n.textContent || ""))
    .filter(Boolean);
  if (multi.length) return multi.join(", ");
  return undefined;
}

/**
 * Attempt to select a saved value for a combobox by matching the saved
 * selected label text against the currently rendered option texts.
 */
async function applyComboboxBySaved(
  el: HTMLInputElement,
  table: Record<string, SavedCell>
): Promise<boolean> {
  /** Ensure the combobox menu is open and options are present. */
  const ensureOpen = async (): Promise<boolean> => {
    // multiple strategies to open the menu
    const container = el.closest(
      '[class*="select__control" i]'
    ) as HTMLElement | null;
    const indicators = container?.querySelector(
      '[class*="indicators" i]'
    ) as HTMLElement | null;
    for (let attempt = 0; attempt < 5; attempt++) {
      el.scrollIntoView({ block: "center" });
      el.focus();
      // container click
      if (container) {
        container.dispatchEvent(
          new MouseEvent("mousedown", { bubbles: true, button: 0 })
        );
        container.dispatchEvent(
          new MouseEvent("mouseup", { bubbles: true, button: 0 })
        );
        container.click();
      } else {
        el.dispatchEvent(
          new MouseEvent("mousedown", { bubbles: true, button: 0 })
        );
        el.dispatchEvent(
          new MouseEvent("mouseup", { bubbles: true, button: 0 })
        );
        el.click();
      }
      // indicator click
      (indicators as HTMLElement | null)?.click?.();
      // keyboard open
      el.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" })
      );
      el.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
      );
      await wait(80);
      if (getComboboxOptions().length) return true;
    }
    return getComboboxOptions().length > 0;
  };

  const label = norm(getAccessibleName(el));
  // Candidate saved entries with same label and a recorded selectedText
  const candidates = Object.values(table).filter(
    (s) => !!s && !!s.selectedText && norm(s.accessibleName || "") === label
  );
  if (!candidates.length) return false;

  await ensureOpen();
  let options = getComboboxOptions();
  if (!options.length) {
    // Try typing to prompt options
    el.dispatchEvent(new Event("focus", { bubbles: true }));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(50);
    options = getComboboxOptions();
  }
  if (!options.length) return false;

  // Select the first candidate whose text exists in current options
  for (const s of candidates) {
    const target = norm(s.selectedText || "");
    // Try narrow by typing target to the input
    try {
      el.value = target;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      await wait(50);
      options = getComboboxOptions();
    } catch {}

    const match = options.find((o) => o.text === target);
    if (match) {
      // Simulate mouse interactions which React-select often expects
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

/** Supported ATS identifiers (limited to Lever and Greenhouse). */
type ATS = "greenhouse" | "lever" | "unknown";

/** Detect ATS based on hostname. */
function detectATS(): ATS {
  const h = location.hostname;
  if (h.includes("greenhouse")) return "greenhouse";
  if (h.includes("lever")) return "lever";
  return "unknown";
}

/** Read a scalar value from a supported control. */
function readValue(el: HTMLElement): string | boolean | null {
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

/**
 * Assign a scalar value to a supported control and notify listeners via events.
 */
function setValue(el: HTMLElement, v: unknown): void {
  const tag = el.tagName.toLowerCase();
  if (tag === "input") {
    const inp = el as HTMLInputElement;
    const t = (inp.type || "").toLowerCase();
    if (t === "file") return; // cannot programmatically set for security
    if (t === "checkbox") inp.checked = !!v;
    else if (t === "radio") {
      if (String(inp.value).toLowerCase() === String(v).toLowerCase())
        inp.checked = true;
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

/** Dispatch common events after a programmatic value change. */
function dispatchValueEvents(el: HTMLElement): void {
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
}

/************* storage *************/
/** Persisted snapshot of a single control's value and signature. */
type SavedCell = {
  value: string | boolean;
  tag: string;
  type: string;
  name: string;
  autocomplete: string;
  accessibleName: string;
  optionSig: string;
  selectedText?: string; // for selects: normalized visible text of selected option(s)
};

/** All saved profiles keyed by ATS and control key. */
type Profiles = Record<ATS, Record<string, SavedCell>>;

/** Thin wrapper around chrome.storage for saved profiles. */
const storage = {
  get(): Promise<Profiles> {
    return new Promise((res) => {
      chrome.storage.local.get(["profiles"], (data) => {
        res(
          (data.profiles as Profiles) || {
            greenhouse: {},
            lever: {},
            unknown: {},
          }
        );
      });
    });
  },
  set(profiles: Profiles): Promise<void> {
    return new Promise((res) =>
      chrome.storage.local.set({ profiles }, () => res())
    );
  },
};

/************* data shape / keys *************/
/**
 * Compute a robust control key from structural attributes and label/signature.
 */
function controlKey(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const type = (el.getAttribute("type") || "").toLowerCase();
  const name = (el.getAttribute("name") || "").toLowerCase();
  const ac = (el.getAttribute("autocomplete") || "").toLowerCase();
  const label = norm(getAccessibleName(el));
  const opt = optionSetSignature(el) || "";
  return JSON.stringify({ tag, type, name, ac, label, opt });
}

/************* capture (user clicks Save) *************/
/** Capture current page's filled controls and persist under the active ATS. */
async function captureAndSave(): Promise<void> {
  const ats = detectATS();
  const inputs = Array.from(
    document.querySelectorAll<HTMLElement>(SELECTOR_FORM_CONTROLS)
  );

  // “Touched” heuristic: if it has a value, or (checkbox checked)
  const touched = inputs.filter((el) => {
    if (el instanceof HTMLInputElement) {
      const inputEl = el as HTMLInputElement;
      if (inputEl.type === "checkbox") return inputEl.checked;
      if (inputEl.type === "radio") return inputEl.checked || !!inputEl.value; // radio value typed? usually predefined
      if (isCombobox(inputEl)) {
        const selText = getComboboxSelectedText(inputEl);
        return !!(selText || inputEl.value);
      }
      return String((inputEl as HTMLInputElement).value || "").length > 0;
    }
    if (el instanceof HTMLTextAreaElement) return !!el.value;
    if (el instanceof HTMLSelectElement) return !!el.value;
    return false;
  });

  const current = await storage.get();
  const table = current[ats] || {};
  for (const el of touched) {
    let val = readValue(el);
    // For combobox inputs, prefer the visible selected label when input value is empty
    if (
      el.tagName.toLowerCase() === "input" &&
      isCombobox(el as HTMLInputElement)
    ) {
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
  toast(`Saved this application for future ${ats} forms.`);
}

/************* apply (user clicks Apply) *************/
/** Apply saved values for the active ATS to the current page. */
async function applySaved(): Promise<void> {
  const ats = detectATS();
  const profiles = await storage.get();
  const table = profiles[ats] || {};
  if (!Object.keys(table).length) return toast(`No saved data for ${ats} yet.`);

  const inputs = Array.from(
    document.querySelectorAll<HTMLElement>(SELECTOR_FORM_CONTROLS)
  );
  let filled = 0;
  for (const el of inputs) {
    // Skip file inputs — handled via Resume button (drop simulation)
    if (
      el.tagName.toLowerCase() === "input" &&
      (el as HTMLInputElement).type === "file"
    )
      continue;
    const key = controlKey(el);
    let saved: SavedCell | undefined = (
      table as Record<string, SavedCell | undefined>
    )[key];

    // strict checks (no guessing)
    if (saved) {
      if (saved.tag !== el.tagName.toLowerCase()) saved = undefined;
      else if (
        (saved.type || "") !== (el.getAttribute("type") || "").toLowerCase()
      )
        saved = undefined;
      else if (
        (saved.name || "") !== (el.getAttribute("name") || "").toLowerCase()
      )
        saved = undefined;
      else if (
        (saved.autocomplete || "") !==
        (el.getAttribute("autocomplete") || "").toLowerCase()
      )
        saved = undefined;
      else {
        const currentSig = optionSetSignature(el) || "";
        const sigMatches =
          saved.optionSig === currentSig ||
          sameOptionSet(saved.optionSig, currentSig);
        if (el.tagName.toLowerCase() !== "select") {
          if ((saved.optionSig || "") !== currentSig) saved = undefined;
        } else if (!sigMatches) saved = undefined;
        if (
          saved &&
          (saved.accessibleName || "") !== norm(getAccessibleName(el))
        )
          saved = undefined;
      }
    }

    // Fallback for selects: match by label + option set if strict key lookup fails
    if (!saved && el.tagName.toLowerCase() === "select") {
      saved = findSavedForSelectFallback(el as HTMLSelectElement, table);
    }
    if (!saved) continue;

    // If it's a select and the option set matches but values may differ, try selecting by visible text
    if (el.tagName.toLowerCase() === "select") {
      const sel = el as HTMLSelectElement;
      let applied = false;
      // Prefer exact value if present
      if (typeof saved.value === "string" && saved.value) {
        const desired = String(saved.value);
        const hasValue = Array.from(sel.options).some(
          (o) => String(o.value) === desired
        );
        if (hasValue) {
          sel.value = desired;
          applied = true;
        }
      }
      if (!applied && saved.selectedText) {
        const targetText = norm(saved.selectedText);
        const match = Array.from(sel.options).find(
          (o) => norm(o.text) === targetText
        );
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

    // React-style combobox (Greenhouse et al): try adaptive selection via ARIA and label fallback
    if (isCombobox(el as HTMLElement)) {
      let ok = await applyComboboxBySaved(el as HTMLInputElement, table);
      if (!ok) {
        // Fallback by label even if strict key match failed: already handled in applyComboboxBySaved via candidates
        ok = await applyComboboxBySaved(el as HTMLInputElement, table);
      }
      if (ok) {
        filled++;
        continue;
      }
    }

    setValue(el, saved.value);
    filled++;
  }
  // Also try to attach resume automatically after filling fields
  try {
    await attachResume();
  } catch {}

  toast(
    `Applied ${filled} field${
      filled === 1 ? "" : "s"
    } from your ${ats} profile.`
  );
}

/************* manage (clear / export / import) *************/
/** Clear all saved data for the active ATS. */
async function clearSaved(): Promise<void> {
  const ats = detectATS();
  const ok = window.confirm(`Clear all saved data for ${ats}?`);
  if (!ok) return;
  const profiles = await storage.get();
  profiles[ats] = {};
  await storage.set(profiles);
  toast(`Cleared saved ${ats} profile.`);
}

/** Export saved data for the active ATS as a downloadable JSON file. */
async function exportSaved(): Promise<void> {
  const ats = detectATS();
  const profiles = await storage.get();
  const table = profiles[ats] || {};
  if (!Object.keys(table).length)
    return toast(`No saved data for ${ats} to export.`);
  const payload = {
    ats,
    exportedAt: new Date().toISOString(),
    count: Object.keys(table).length,
    data: table,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `glever-apply-${ats}-profile.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast(`Exported ${payload.count} ${ats} field(s).`);
}

/** Import saved data for the active ATS from a pasted JSON payload. */
async function importSaved(): Promise<void> {
  const ats = detectATS();
  const raw = window.prompt(
    `Paste exported JSON for ${ats} (from glever-apply export):`
  );
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as {
      ats?: ATS;
      data?: Record<string, SavedCell>;
    };
    const incoming =
      parsed.data || (parsed as unknown as Record<string, SavedCell>);
    if (!incoming || typeof incoming !== "object")
      throw new Error("Invalid payload");
    const profiles = await storage.get();
    const table = profiles[ats] || {};
    let merged = 0;
    for (const [k, v] of Object.entries(incoming)) {
      if (!v || typeof v !== "object") continue;
      // minimally validate shape
      if (!("value" in v) || !("tag" in v)) continue;
      table[k] = v as SavedCell; // overwrite existing with imported
      merged++;
    }
    profiles[ats] = table;
    await storage.set(profiles);
    toast(`Imported ${merged} ${ats} field(s).`);
  } catch (e) {
    console.error(e);
    toast("Import failed: invalid JSON");
  }
}

/************* tiny in-page UI *************/
/** Inject the floating glever-apply control panel via a shadow root. */
function injectUI(): void {
  if (document.getElementById("__glever-apply_root")) return;
  const host = document.createElement("div");
  host.id = "__glever-apply_root";
  Object.assign(host.style, {
    position: "fixed",
    left: "16px",
    bottom: "16px",
    zIndex: "2147483647",
  } as CSSStyleDeclaration);

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .panel {
      position: relative;
      min-width: 280px;
      max-width: 90vw;
      background: linear-gradient(135deg, #ffffff 0%, #f5f7fb 100%);
      border: 1px solid #e8eaf0;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,.14);
      font: 12px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, sans-serif;
      color: #111;
      overflow: hidden;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      background: rgba(61,116,204,.08);
      cursor: move;
      user-select: none;
    }
    .title {
      font-weight: 600;
      font-size: 12px;
      color: #2b2f36;
    }
    .badge { opacity: .7; margin-left: 8px; font-weight: 500; }
    .collapse {
      border: none; background: transparent; cursor: pointer; color: #2b2f36;
      font-size: 14px; padding: 4px; border-radius: 6px;
    }
    .collapse:hover { background: rgba(0,0,0,.06); }
    .content { padding: 8px 10px; display: flex; flex-wrap: wrap; gap: 8px; }
    .btn {
      padding: 6px 12px; border-radius: 999px; border: 1px solid #d8dbe6;
      background: #fff; cursor: pointer; font-weight: 600; color: #283042;
    }
    .btn:hover { background: #f3f5fb; }
    .collapsed .content { display: none; }
    .section { width: 100%; }
    .sectionTitle { font-weight: 700; font-size: 11px; color: #4b5563; margin: 4px 0; }
    .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .resumeName { font-weight: 600; color: #283042; }
    .clickable { cursor: pointer; padding: 6px 12px; border: 1px solid #d8dbe6; border-radius: 999px; background: #fff; }
    .clickable:hover { background: #f3f5fb; }
    .empty { opacity: .7; }
  `;

  const panel = document.createElement("div");
  panel.className = "panel";

  const header = document.createElement("div");
  header.className = "header";
  const title = document.createElement("div");
  title.className = "title";
  title.textContent = "glever-apply";
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = `ATS: ${detectATS()}`;
  const left = document.createElement("div");
  left.style.display = "flex";
  left.style.alignItems = "center";
  left.append(title, badge);

  const collapseBtn = document.createElement("button");
  collapseBtn.className = "collapse";
  collapseBtn.textContent = "–";
  collapseBtn.title = "Collapse";
  collapseBtn.onclick = () => {
    const isCollapsed = panel.classList.toggle("collapsed");
    collapseBtn.textContent = isCollapsed ? "+" : "–";
    try {
      localStorage.setItem("glever-apply:ui:collapsed", String(isCollapsed));
    } catch {}
  };

  header.append(left, collapseBtn);

  const content = document.createElement("div");
  content.className = "content";

  const btn = (label: string, onClick: () => void) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.className = "btn";
    b.onclick = onClick;
    return b;
  };

  // Build requested UI sections
  const makeSection = (titleText: string) => {
    const sec = document.createElement("div");
    sec.className = "section";
    const t = document.createElement("div");
    t.className = "sectionTitle";
    t.textContent = titleText;
    const row = document.createElement("div");
    row.className = "row";
    sec.append(t, row);
    return { sec, row } as const;
  };

  // Resume section: show file name as a clickable button to set
  const { sec: resumeSec, row: resumeRow } = makeSection("Resume");
  const resumeName = document.createElement("button");
  resumeName.className = "resumeName clickable empty";
  resumeName.textContent = "No resume stored";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "application/pdf,.pdf,.doc,.docx,.rtf,.txt";
  fileInput.style.display = "none";
  const refreshResumeLabel = async () => {
    const r = await getStoredResume();
    if (r) {
      resumeName.textContent = r.name;
      resumeName.classList.remove("empty");
    } else {
      resumeName.textContent = "No resume stored";
      resumeName.classList.add("empty");
    }
  };
  resumeName.onclick = () => fileInput.click();
  fileInput.addEventListener("change", async () => {
    const f = (fileInput.files || [])[0];
    if (!f) return;
    try {
      await saveResumeFileToVault(f);
      await refreshResumeLabel();
    } catch (e) {
      console.error(e);
      toast("Failed to save resume.");
    }
  });
  resumeRow.append(resumeName, fileInput);

  // Data section
  const { sec: dataSec, row: dataRow } = makeSection("Data");
  const btnSave = btn("Save", () => void captureAndSave());
  const btnExport = btn("Export", () => void exportSaved());
  const btnImport = btn("Import", () => void importSaved());
  const btnClear = btn("Clear", () => void clearSaved());
  dataRow.append(btnSave, btnExport, btnImport, btnClear);

  // Application section
  const { sec: appSec, row: appRow } = makeSection("Application");
  const btnApply = btn("Autofill", () => void applySaved());
  const btnResume = btn("Resume", () => void attachResume());
  appRow.append(btnApply, btnResume);

  // Assemble
  content.append(resumeSec, dataSec, appSec);
  void refreshResumeLabel();

  panel.append(header, content);
  shadow.append(style, panel);
  document.body.appendChild(host);

  // Restore collapsed state
  try {
    const c = localStorage.getItem("glever-apply:ui:collapsed");
    if (c === "true") {
      panel.classList.add("collapsed");
      collapseBtn.textContent = "+";
    }
  } catch {}

  // Draggable behavior on header
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;
  const loadPos = () => {
    try {
      const raw = localStorage.getItem("glever-apply:ui:pos");
      if (!raw) return;
      const pos = JSON.parse(raw) as { left: number; top: number };
      host.style.left = `${pos.left}px`;
      host.style.bottom = "auto";
      host.style.top = `${pos.top}px`;
    } catch {}
  };
  loadPos();

  const onMouseMove = (e: MouseEvent) => {
    if (!dragging) return;
    const leftPx = Math.max(0, e.clientX - offsetX);
    const topPx = Math.max(0, e.clientY - offsetY);
    host.style.left = `${leftPx}px`;
    host.style.top = `${topPx}px`;
  };
  const onMouseUp = () => {
    if (!dragging) return;
    dragging = false;
    try {
      const rect = host.getBoundingClientRect();
      localStorage.setItem(
        "glever-apply:ui:pos",
        JSON.stringify({ left: rect.left, top: rect.top })
      );
    } catch {}
    window.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("mouseup", onMouseUp, true);
  };
  header.addEventListener("mousedown", (e) => {
    dragging = true;
    const rect = host.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    window.addEventListener("mousemove", onMouseMove, true);
    window.addEventListener("mouseup", onMouseUp, true);
  });
}

/** Lightweight toast message helper. */
function toast(msg: string): void {
  let t = document.getElementById("__glever-apply_toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "__glever-apply_toast";
    Object.assign(t.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      background: "#111",
      color: "#fff",
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

/************* boot *************/
window.addEventListener("load", () => {
  injectUI();
});

/** Resume attach via simulated drop **/
type StoredFile = { name: string; type: string; size: number; dataB64: string };
/** Read stored resume from the local vault, if present. */
async function getStoredResume(): Promise<StoredFile | undefined> {
  return new Promise((res) => {
    chrome.storage.local.get(["vault"], (data) =>
      res((data.vault?.resume as StoredFile) || undefined)
    );
  });
}

/** Convert a base64 string into a typed Blob. */
function b64ToBlob(b64: string, type: string): Blob {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/**
 * Attempt to attach the stored resume:
 * 1) Directly set files on visible file inputs (when allowed)
 * 2) Simulate a drop over file inputs
 * 3) Simulate a drop over common uploader zones
 */
async function attachResume(): Promise<void> {
  const stored = await getStoredResume();
  if (!stored) return toast("No resume in vault. Set it in options.");

  // Construct a File from stored blob
  const blob = b64ToBlob(
    stored.dataB64,
    stored.type || "application/octet-stream"
  );
  const file = new File([blob], stored.name, {
    type: stored.type || blob.type,
  });
  const dt = new DataTransfer();
  dt.items.add(file);

  // Strategy 1: direct file inputs visible
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>("input[type=file]")
  );
  for (const inp of inputs) {
    try {
      // Some Chromium versions allow assigning FileList from DataTransfer; ignore if blocked
      // @ts-ignore - files is read-only in typings
      inp.files = dt.files;
      inp.dispatchEvent(new Event("input", { bubbles: true }));
      inp.dispatchEvent(new Event("change", { bubbles: true }));
      toast("Attached resume to file input.");
      return;
    } catch {}
    // Fallback: simulate a drop on the input
    try {
      const ev = new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
      });
      const ok = inp.dispatchEvent(ev);
      if (ok) {
        toast("Dropped resume onto file input.");
        return;
      }
    } catch {}
  }

  // Strategy 2: common drop zones
  const zones = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.dropzone, [data-testid*="upload" i], [data-qa*="upload" i], [class*="upload" i], [aria-label*="upload" i], [aria-label*="resume" i]'
    )
  );
  for (const z of zones) {
    try {
      const ev = new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
      });
      const ok = z.dispatchEvent(ev);
      if (ok) {
        toast("Dropped resume onto uploader.");
        return;
      }
    } catch {}
  }

  toast("Couldn’t find an upload input/zone.");
}

/** Persist a provided File as the stored resume in the vault. */
async function saveResumeFileToVault(file: File): Promise<void> {
  const ab = await file.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const dataB64 = btoa(bin);
  await new Promise<void>((res) =>
    chrome.storage.local.set(
      {
        vault: {
          resume: {
            name: file.name,
            type: file.type || "application/octet-stream",
            size: file.size,
            dataB64,
          } as StoredFile,
        },
      },
      () => res()
    )
  );
  toast("Resume saved in vault.");
}
