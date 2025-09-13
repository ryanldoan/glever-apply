import { injectUI } from "./ui/panel";

// Entry point for the content script
window.addEventListener("load", () => {
  try {
    injectUI();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Glever Apply failed to inject UI:", e);
  }
});

