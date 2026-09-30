import { Progress } from "@/components/ui/progress";
import { getScoreTier, tierColors } from "@/lib/score";
import type { ScoreBreakdown } from "@/lib/types";

const ROWS: { key: "skillsScore" | "projectsScore" | "experienceScore" | "educationScore"; label: string; weight: string }[] = [
  { key: "skillsScore", label: "Skills", weight: "40%" },
  { key: "projectsScore", label: "Projects", weight: "25%" },
  { key: "experienceScore", label: "Experience", weight: "20%" },
  { key: "educationScore", label: "Education", weight: "15%" },
];

export function ScoreBreakdownBars({ score }: { score: ScoreBreakdown }) {
  return (
    <div className="flex flex-col gap-4">
      {ROWS.map((row) => {
        const value = score[row.key];
        const tier = getScoreTier(value);
        return (
          <div key={row.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-foreground">
                {row.label} <span className="text-foreground/40">· {row.weight} weight</span>
              </span>
              <span className={tierColors[tier].text}>{Math.round(value)}</span>
            </div>
            <Progress value={value} indicatorClassName={tierColors[tier].bg} />
          </div>
        );
      })}
    </div>
  );
}

