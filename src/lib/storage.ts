import type { ATS } from "./ats";

export type SavedCell = {
  value: string | boolean;
  tag: string;
  type: string;
  name: string;
  autocomplete: string;
  accessibleName: string;
  optionSig: string;
  selectedText?: string;
};

export type Profiles = Record<ATS, Record<string, SavedCell>>;

export const storage = {
  get(): Promise<Profiles> {
    return new Promise((res) => {
      chrome.storage.local.get(["profiles"], (data) => {
        res((data.profiles as Profiles) || { greenhouse: {}, lever: {}, unknown: {} });
      });
    });
  },
  set(profiles: Profiles): Promise<void> {
    return new Promise((res) => chrome.storage.local.set({ profiles }, () => res()));
  },
};

