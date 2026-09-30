"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import { Check, X, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SkillMatch } from "@/lib/types";

const listVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
};

export function SkillMatchList({ matches }: { matches: SkillMatch[] }) {
  const prefersReducedMotion = useReducedMotion();
  const matched = matches.filter((m) => m.matched);
  const missing = matches
    .filter((m) => !m.matched)
    .sort((a, b) => (a.category === b.category ? 0 : a.category === "core" ? -1 : 1));

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <div>
        <p className="mb-3 text-sm font-medium text-foreground/70">
          Matched ({matched.length}/{matches.length})
        </p>
        <motion.ul
          className="flex flex-col gap-2"
          variants={prefersReducedMotion ? undefined : listVariants}
          initial={prefersReducedMotion ? false : "hidden"}
          animate="visible"
        >
          {matched.map((m) => {
            const isSemantic = m.matchType === "semantic";
            return (
              <motion.li
                key={m.skill}
                variants={prefersReducedMotion ? undefined : itemVariants}
                className={`flex flex-col gap-1 rounded-xl px-3.5 py-2.5 transition-colors ${
                  isSemantic ? "bg-primary/5 hover:bg-primary/10" : "bg-accent/5 hover:bg-accent/10"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <Check className={`h-4 w-4 shrink-0 ${isSemantic ? "text-primary" : "text-accent"}`} />
                    {m.skill}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {isSemantic && (
                      <Badge
                        variant="primary"
                        className="gap-1"
                        title="Matched by meaning (semantic similarity), not exact keyword text."
                      >
                        <Sparkles className="h-3 w-3" />
                        AI match
                      </Badge>
                    )}
                    {m.category === "core" && <Badge variant="primary">core</Badge>}
                  </span>
                </div>
                {isSemantic && m.matchedResumePhrase && (
                  <p className="pl-6 text-xs italic text-foreground/50">
                    Recognized from your resume: &ldquo;{m.matchedResumePhrase}&rdquo;
                  </p>
                )}
              </motion.li>
            );
          })}
          {matched.length === 0 && <p className="text-sm text-foreground/40">No matches yet.</p>}
        </motion.ul>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-foreground/70">Gaps ({missing.length})</p>
        <motion.ul
          className="flex flex-col gap-2"
          variants={prefersReducedMotion ? undefined : listVariants}
          initial={prefersReducedMotion ? false : "hidden"}
          animate="visible"
        >
          {missing.map((m) => (
            <motion.li
              key={m.skill}
              variants={prefersReducedMotion ? undefined : itemVariants}
              className={`flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 transition-colors ${
                m.category === "core" ? "bg-error/5 hover:bg-error/10" : "bg-surface hover:bg-border/40"
              }`}
            >
              <span className="flex items-center gap-2 text-sm text-foreground">
                <X className={`h-4 w-4 shrink-0 ${m.category === "core" ? "text-error" : "text-foreground/30"}`} />
                {m.skill}
              </span>
              <Badge variant={m.category === "core" ? "error" : "neutral"}>{m.category}</Badge>
            </motion.li>
          ))}
          {missing.length === 0 && <p className="text-sm text-foreground/40">No gaps — nice work!</p>}
        </motion.ul>
      </div>
    </div>
  );
}


