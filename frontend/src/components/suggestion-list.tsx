import { BookOpen, Hammer, PenLine, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Suggestion } from "@/lib/types";

const typeMeta: Record<Suggestion["type"], { icon: React.ReactNode; label: string }> = {
  skill_to_learn: { icon: <GraduationCap className="h-4 w-4" />, label: "Skill to learn" },
  project_idea: { icon: <Hammer className="h-4 w-4" />, label: "Project idea" },
  resume_rewrite: { icon: <PenLine className="h-4 w-4" />, label: "Resume tip" },
  learning_resource: { icon: <BookOpen className="h-4 w-4" />, label: "Resource" },
};

const priorityVariant = {
  high: "error",
  medium: "warning",
  low: "neutral",
} as const;

export function SuggestionList({ suggestions }: { suggestions: Suggestion[] }) {
  if (suggestions.length === 0) {
    return <p className="text-sm text-foreground/50">No suggestions — your resume looks strong for this role.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {suggestions.map((s, i) => (
        <li key={i} className="flex gap-3 rounded-xl border border-border p-3.5 transition-colors hover:bg-surface/60">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {typeMeta[s.type].icon}
          </span>
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
                {typeMeta[s.type].label}
              </p>
              <Badge variant={priorityVariant[s.priority]}>{s.priority}</Badge>
            </div>
            <p className="text-sm text-foreground">{s.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
