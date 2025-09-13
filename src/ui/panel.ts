import { detectATS } from "../lib/ats";
import {
  hasAnySavedData,
  captureAndSave,
  importSaved,
  exportSaved,
  clearSaved,
  applySaved,
} from "../lib/formFill";
import {
  getStoredResume,
  saveResumeFileToVault,
  clearStoredResume,
  attachResume,
} from "../lib/resume";
import { toast } from "../lib/toast";

export function injectUI(): void {
  if (document.getElementById("__glever-apply_root")) return;
  const host = document.createElement("div");
  host.id = "__glever-apply_root";
  Object.assign(host.style, {
    position: "fixed",
    top: "0px",
    right: "0px",
    zIndex: "2147483647",
  } as CSSStyleDeclaration);

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .panel { position: relative; width: 280px; min-height: 180px; background: linear-gradient(135deg, rgba(13,51,120,0.9) 0%, rgba(13,51,120,0.7) 100%); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; box-shadow: 0 8px 32px rgba(13,51,120,0.3), inset 0 1px 0 rgba(255,255,255,0.1); font: 12px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, sans-serif; color: #ffffff; overflow: hidden; transition: width 240ms cubic-bezier(0.16, 1, 0.3, 1); }
    .panel.collapsed { min-height: 0; }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; background: linear-gradient(135deg, rgba(13,51,120,0.8) 0%, rgba(13,51,120,0.6) 100%); border-bottom: 1px solid rgba(255,255,255,0.1); cursor: default; user-select: none; }
    .title { font-weight: 600; font-size: 12px; color: #ffffff; line-height: 1.2; }
    .subtitle { font-weight: 500; font-size: 10px; color: #ffffff; line-height: 1.2; margin-top: 2px; }
    .collapse { border: none; outline: none; -webkit-appearance: none; appearance: none; background: none; cursor: pointer; color: #ffffff; font-size: 14px; padding: 4px; border-radius: 6px; transition: all 0.2s ease; }
    .content { display: flex; flex-wrap: wrap; gap: 8px; overflow: hidden; max-height: 0; padding: 0 10px; transition: max-height 420ms cubic-bezier(0.16, 1, 0.3, 1); }
    .panel:not(.collapsed) .content { max-height: 1000px; padding: 0px 10px 8px 10px; }
    .btn { padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: linear-gradient(135deg, rgba(13,51,120,0.6) 0%, rgba(13,51,120,0.4) 100%); cursor: pointer; font-weight: 600; color: #ffffff; font-size: 11px; box-shadow: 0 2px 8px rgba(13,51,120,0.2), inset 0 1px 0 rgba(255,255,255,0.1); transition: all 0.2s ease; }
    .btn:hover { background: linear-gradient(135deg, rgba(13,51,120,0.8) 0%, rgba(13,51,120,0.6) 100%); box-shadow: 0 4px 12px rgba(13,51,120,0.3), inset 0 1px 0 rgba(255,255,255,0.2); transform: translateY(-1px); }
    .btn:disabled:hover { background: linear-gradient(135deg, rgba(13,51,120,0.6) 0%, rgba(13,51,120,0.4) 100%); box-shadow: 0 2px 8px rgba(13,51,120,0.2), inset 0 1px 0 rgba(255,255,255,0.1); transform: none; }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    /* Quick Autofill button (visible in collapsed pill when there is work to do) */
    .quick { padding: 4px 10px; font-size: 10px; }
    .section { width: 100%; }
    .sectionTitle { font-weight: 700; font-size: 11px; color: #ffffff; margin: 4px 0; }
    .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .clickable { cursor: pointer; padding: 6px 12px; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; background: linear-gradient(135deg, rgba(13,51,120,0.6) 0%, rgba(13,51,120,0.4) 100%); color: #ffffff; box-shadow: 0 2px 8px rgba(13,51,120,0.2), inset 0 1px 0 rgba(255,255,255,0.1); transition: all 0.2s ease; -webkit-appearance: none; appearance: none; }
    .clickable:hover { background: linear-gradient(135deg, rgba(13,51,120,0.8) 0%, rgba(13,51,120,0.6) 100%); box-shadow: 0 4px 12px rgba(13,51,120,0.3), inset 0 1px 0 rgba(255,255,255,0.2); transform: translateY(-1px); }
    .empty { opacity: .7; }
    .resumeName { font-weight: 600; color: #ffffff; font-size: 10px; padding: 4px 8px; line-height: 1.2; display: inline-block; width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .resumeClear { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 6px; border: none; outline: none; -webkit-appearance: none; appearance: none; background: none; color: #fff; cursor: pointer; transition: background 200ms ease, transform 150ms ease; user-select: none; }
  `;

  const panel = document.createElement("div");
  panel.className = "panel";

  const header = document.createElement("div");
  header.className = "header";

  const titleContainer = document.createElement("div");
  titleContainer.style.display = "flex";
  titleContainer.style.alignItems = "center";
  titleContainer.style.gap = "6px";

  const logo = document.createElement("img");
  logo.src = chrome.runtime.getURL("Glever.png");
  logo.style.width = "16px";
  logo.style.height = "16px";
  logo.style.flexShrink = "0";

  const title = document.createElement("div");
  title.className = "title";
  title.textContent = "Glever Apply";
  titleContainer.append(logo, title);

  const subtitleContainer = document.createElement("div");
  subtitleContainer.style.display = "flex";
  subtitleContainer.style.alignItems = "center";
  subtitleContainer.style.gap = "9px";

  const atsType = detectATS();
  const atsText = document.createElement("span");
  atsText.style.opacity = "0.8";
  atsText.textContent = atsType.charAt(0).toUpperCase() + atsType.slice(1);
  if (atsType === "lever") {
    const leverIcon = document.createElement("img");
    leverIcon.src = chrome.runtime.getURL("LeverIcon.png");
    leverIcon.style.width = "12px";
    leverIcon.style.height = "12px";
    leverIcon.style.flexShrink = "0";
    leverIcon.style.marginLeft = "2px";
    subtitleContainer.append(leverIcon);
  }
  if (atsType === "greenhouse") {
    const greenhouseIcon = document.createElement("img");
    greenhouseIcon.src = chrome.runtime.getURL("GreenhouseIcon.png");
    greenhouseIcon.style.width = "12px";
    greenhouseIcon.style.height = "12px";
    greenhouseIcon.style.flexShrink = "0";
    greenhouseIcon.style.marginLeft = "2px";
    subtitleContainer.append(greenhouseIcon);
  }
  subtitleContainer.append(atsText);

  const subtitle = document.createElement("div");
  subtitle.className = "subtitle";
  subtitle.append(subtitleContainer);

  const left = document.createElement("div");
  left.style.display = "flex";
  left.style.flexDirection = "column";
  left.style.alignItems = "flex-start";
  left.append(titleContainer, subtitle);

  const collapseBtn = document.createElement("button");
  collapseBtn.className = "collapse";
  collapseBtn.textContent = "-";
  collapseBtn.title = "Collapse";
  collapseBtn.onclick = () => {
    const isCollapsedNow = panel.classList.contains("collapsed");
    const PANEL_TARGET_WIDTH = 280; // Should match CSS .panel width
    const WIDTH_ANIM_MS = 240;

    const setCollapsedWidth = () => {
      const leftW = Math.ceil(left.getBoundingClientRect().width) || 120; // includes quick button if visible
      const btnW = Math.ceil(collapseBtn.getBoundingClientRect().width) || 16;
      const horizontalPadding = 20; // header has 10px left + 10px right
      const gap = 8; // space between left column and + button
      const w = leftW + btnW + horizontalPadding + gap;
      panel.style.width = `${w}px`;
    };

    if (isCollapsedNow) {
      // Two-step expand: 1) animate width to full, 2) drop content
      setCollapsedWidth();
      void panel.offsetWidth; // reflow
      panel.style.width = `${PANEL_TARGET_WIDTH}px`;
      window.setTimeout(() => {
        panel.style.width = ""; // let CSS control full width
        panel.classList.remove("collapsed");
        collapseBtn.textContent = "-";
        quickApplyBtn.style.display = "none"; // hide quick button when expanded
        try {
          localStorage.setItem("glever-apply:ui:collapsed", "false");
        } catch {}
      }, WIDTH_ANIM_MS + 30);
    } else {
      // Collapse: first close content, then animate width to pill after content transition
      panel.classList.add("collapsed");
      collapseBtn.textContent = "+";
      try {
        localStorage.setItem("glever-apply:ui:collapsed", "true");
      } catch {}
      // Start from explicit full width for reliable transition
      panel.style.width = `${PANEL_TARGET_WIDTH}px`;
      const CONTENT_ANIM_MS = 480; // keep in sync with CSS
      window.setTimeout(() => { setCollapsedWidth(); void updateApplyEnabled(); }, CONTENT_ANIM_MS + 30);
    }
  };

  // Quick Autofill button (only shown in collapsed state when actionable)
  const quickApplyBtn = document.createElement("button");
  quickApplyBtn.className = "btn quick";
  quickApplyBtn.textContent = "Autofill";
  quickApplyBtn.style.display = "none";
  quickApplyBtn.style.marginTop = "6px";
  quickApplyBtn.style.alignSelf = "flex-start";
  // Place below ATS title so the + button remains visible
  left.appendChild(quickApplyBtn);
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

  // Resume
  const { sec: resumeSec, row: resumeRow } = makeSection("Resume");
  const resumeName = document.createElement("button");
  resumeName.className = "resumeName clickable empty";
  resumeName.textContent = "Add Resume";
  const resumeClear = document.createElement("button");
  resumeClear.className = "resumeClear";
  resumeClear.title = "Remove stored resume";
  resumeClear.textContent = "✕";
  resumeClear.style.display = "none";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "application/pdf,.pdf,.doc,.docx,.rtf,.txt";
  fileInput.style.display = "none";

  const { sec: dataSec, row: dataRow } = makeSection("Data");
  const btnSave = btn("Save", async () => {
    await captureAndSave();
    await updateApplyEnabled();
  });
  const btnImport = btn("Import", async () => {
    await importSaved();
    await updateApplyEnabled();
  });
  const btnExport = btn("Export", () => void exportSaved());
  const btnClear = btn("Clear", async () => {
    await clearSaved();
    await updateApplyEnabled();
  });
  dataRow.append(btnSave, btnExport, btnImport, btnClear);

  const { sec: appSec, row: appRow } = makeSection("Application");
  let resumeAttached = false;
  const btnApply = btn("Autofill", async () => {
    if (btnApply.disabled) return;
    const ats = detectATS();
    try {
      const filled = await applySaved();
      if (!resumeAttached) {
        try {
          const hasStoredResume = !!(await getStoredResume());
          if (hasStoredResume) {
            await attachResume();
            resumeAttached = true;
          }
        } catch (e) {
          console.error("Resume attachment failed:", e);
        }
      }
      btnApply.disabled = true;
      btnApply.style.opacity = "0.6";
      toast(
        `Applied ${resumeAttached ? "resume and " : ""} ${filled} field${
          filled === 1 ? "" : "s"
        } from your ${ats.charAt(0).toUpperCase() + ats.slice(1)} profile.`
      );
    } catch (e) {
      console.error("Autofill failed:", e);
    }
  });
  const btnResume = btn("Resume", async () => {
    if (btnResume.disabled) return;
    btnResume.disabled = true;
    btnResume.style.opacity = "0.6";
    try {
      await attachResume();
      resumeAttached = true;
      toast("Resume attached.");
    } catch {
      btnResume.disabled = false;
      btnResume.style.opacity = "1";
    }
  });
  appRow.append(btnApply, btnResume);

  // Quick Autofill (collapsed pill)
  quickApplyBtn.onclick = async () => {
    if (quickApplyBtn.disabled) return;
    const ats = detectATS();
    try {
      const filled = await applySaved();
      if (!resumeAttached) {
        try {
          const hasStoredResume = !!(await getStoredResume());
          if (hasStoredResume) {
            await attachResume();
            resumeAttached = true;
          }
        } catch (e) {
          console.error("Resume attachment failed:", e);
        }
      }
      // Mirror main Autofill disable after completion
      btnApply.disabled = true;
      btnApply.style.opacity = "0.6";
      quickApplyBtn.disabled = true;
      quickApplyBtn.style.opacity = "0.6";
      toast(
        `Applied ${resumeAttached ? "resume and " : ""} ${filled} field${
          filled === 1 ? "" : "s"
        } from your ${ats.charAt(0).toUpperCase() + ats.slice(1)} profile.`
      );
      // If resume was attached, disable Resume button too
      if (resumeAttached) { btnResume.disabled = true; btnResume.style.opacity = "0.6"; }
    } catch (e) {
      console.error("Quick autofill failed:", e);
    }
  };

  const refreshResumeLabel = async () => {
    const r = await getStoredResume();
    if (r) {
      resumeName.textContent = r.name;
      resumeName.classList.remove("empty");
      resumeClear.style.display = "inline-flex";
      if (!resumeAttached) {
        btnResume.disabled = false;
        btnResume.style.opacity = "1";
      }
    } else {
      resumeName.textContent = "Add Resume";
      resumeName.classList.add("empty");
      resumeClear.style.display = "none";
      btnResume.disabled = true;
      btnResume.style.opacity = "0.6";
    }
  };

  resumeName.onclick = () => {
    try {
      fileInput.value = "";
    } catch {}
    fileInput.click();
  };
  fileInput.addEventListener("change", async () => {
    const f = (fileInput.files || [])[0];
    if (!f) return;
    try {
      await saveResumeFileToVault(f);
      await refreshResumeLabel();
      await updateApplyEnabled();
      try {
        fileInput.value = "";
      } catch {}
    } catch (e) {
      console.error(e);
      toast("Failed to save resume.");
    }
  });
  resumeRow.append(resumeName, resumeClear, fileInput);

  content.append(resumeSec, dataSec, appSec);
  panel.append(header, content);
  shadow.append(style, panel);
  document.body.appendChild(host);

  // init buttons
  void refreshResumeLabel();
  void updateApplyEnabled();

  resumeClear.onclick = async () => {
    try {
      await clearStoredResume();
      resumeAttached = false;
      await refreshResumeLabel();
      await updateApplyEnabled();
      toast("Removed stored resume.");
    } catch (e) {
      console.error("Failed to clear resume:", e);
      toast("Failed to remove resume.");
    }
  };

  async function updateApplyEnabled(): Promise<void> {
    const [hasData, hasResume] = await Promise.all([
      hasAnySavedData(),
      getStoredResume().then(Boolean),
    ]);
    const enable = hasData || hasResume;
    btnApply.disabled = !enable;
    btnApply.style.opacity = enable ? "1" : "0.6";
    // Show quick Autofill only when collapsed and actionable
    const showQuick = panel.classList.contains("collapsed") && enable && !btnApply.disabled;
    quickApplyBtn.style.display = showQuick ? "inline-block" : "none";
    quickApplyBtn.disabled = !enable;
    quickApplyBtn.style.opacity = enable ? "1" : "0.6";
  }

  // collapsed state restore
  try {
    const c = localStorage.getItem("glever-apply:ui:collapsed");
    if (c === "true") {
      panel.classList.add("collapsed");
      collapseBtn.textContent = "+";
      // Ensure pill width matches the title + ATS text plus button
      const leftW = Math.ceil(left.getBoundingClientRect().width) || 120;
      const btnW = Math.ceil(collapseBtn.getBoundingClientRect().width) || 16;
      const horizontalPadding = 20; // 10px + 10px
      const gap = 8;
      panel.style.width = `${leftW + btnW + horizontalPadding + gap}px`;
      // ensure quick button visibility on load
      void updateApplyEnabled();
    }
  } catch {}
}
