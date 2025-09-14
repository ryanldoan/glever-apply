export type ATS = "greenhouse" | "lever" | "workable" | "rippling" | "ashby" | "unknown";

export function detectATS(): ATS {
  const h = location.hostname;
  if (h.startsWith("job-boards.") && h.endsWith(".greenhouse.io")) return "greenhouse";
  if (h === "jobs.lever.co") return "lever";
  if (h === "apply.workable.com" || h.endsWith(".workable.com")) return "workable";
  if (h === "ats.rippling.com" || h.endsWith(".rippling.com")) return "rippling";
  if (h === "jobs.ashbyhq.com" || h.endsWith(".ashbyhq.com")) return "ashby";
  return "unknown";
}
