export type ATS = "greenhouse" | "lever" | "unknown";

export function detectATS(): ATS {
  const h = location.hostname;
  if (h.startsWith("job-boards.") && h.endsWith(".greenhouse.io")) return "greenhouse";
  if (h === "jobs.lever.co") return "lever";
  return "unknown";
}

