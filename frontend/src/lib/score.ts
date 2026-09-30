export type ScoreTier = "green" | "amber" | "red";

export function getScoreTier(score: number): ScoreTier {
  if (score >= 70) return "green";
  if (score >= 40) return "amber";
  return "red";
}

export const tierColors: Record<ScoreTier, { text: string; bg: string; ring: string }> = {
  green: { text: "text-accent", bg: "bg-accent", ring: "stroke-accent" },
  amber: { text: "text-warning", bg: "bg-warning", ring: "stroke-warning" },
  red: { text: "text-error", bg: "bg-error", ring: "stroke-error" },
};

export function getScoreLabel(score: number): string {
  const tier = getScoreTier(score);
  if (tier === "green") return "Strong fit";
  if (tier === "amber") return "Getting there";
  return "Needs work";
}
