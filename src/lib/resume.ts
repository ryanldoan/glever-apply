import { toast } from "./toast";

export type StoredFile = { name: string; type: string; size: number; dataB64: string };

export async function getStoredResume(): Promise<StoredFile | undefined> {
  return new Promise((res) => {
    chrome.storage.local.get(["vault"], (data) => res((data.vault?.resume as StoredFile) || undefined));
  });
}

function b64ToBlob(b64: string, type: string): Blob {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function attachResume(): Promise<void> {
  const stored = await getStoredResume();
  if (!stored) return toast("No resume stored.");
  const blob = b64ToBlob(stored.dataB64, stored.type || "application/octet-stream");
  const file = new File([blob], stored.name, { type: stored.type || blob.type });
  const dt = new DataTransfer();
  dt.items.add(file);

  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input[type=file]"));
  for (const inp of inputs) {
    try {
      // @ts-ignore - files is read-only in typings
      inp.files = dt.files;
      inp.dispatchEvent(new Event("input", { bubbles: true }));
      inp.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    } catch {}
    try {
      const ev = new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt });
      const ok = inp.dispatchEvent(ev);
      if (ok) return;
    } catch {}
  }

  const zones = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.dropzone, [data-testid*="upload" i], [data-qa*="upload" i], [class*="upload" i], [aria-label*="upload" i], [aria-label*="resume" i]'
    )
  );
  for (const z of zones) {
    try {
      const ev = new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt });
      const ok = z.dispatchEvent(ev);
      if (ok) return;
    } catch {}
  }

  toast("Couldn’t find an upload input/zone.");
}

export async function saveResumeFileToVault(file: File): Promise<void> {
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
  toast("Resume saved.");
}

export async function clearStoredResume(): Promise<void> {
  await new Promise<void>((res) => chrome.storage.local.set({ vault: {} }, () => res()));
}

