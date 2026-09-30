"use client";

import { useState } from "react";
import { ChevronDown, Percent, MinusCircle, HelpCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { getScoreLabel, getScoreTier, tierColors } from "@/lib/score";
import type { ScoreBreakdown } from "@/lib/types";

function formatSigned(value: number, suffix: string, digits = 1) {
  const rounded = Number(value.toFixed(digits));
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}${suffix}`;
}

export function ScoreExplanationPanel({ score }: { score: ScoreBreakdown }) {
  const [open, setOpen] = useState(false);

  const hasExplanation =
    !!score.components && score.components.length > 0 && score.adjustments !== undefined && score.baseScore !== undefined;

  const tier = getScoreTier(score.overallScore);
  const colors = tierColors[tier];

  // Short "Base 75 → Core skills missing (2): -8 pts → Final: 67" style summary line.
  const chainParts: string[] = hasExplanation ? [`Base score: ${Math.round(score.baseScore!)}`] : [];
  if (hasExplanation) {
    for (const adj of score.adjustments!) {
      const impact =
        adj.kind === "multiplier" && adj.percentImpact !== null
          ? formatSigned(adj.percentImpact, "%", 0)
          : adj.points !== null
            ? formatSigned(adj.points, " pts", 1)
            : "";
      chainParts.push(`${adj.label}: ${impact}`);
    }
    chainParts.push(`Final: ${Math.round(score.finalScore ?? score.overallScore)}`);
  }

  return (
    <div className="w-full rounded-xl border border-border bg-surface/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left transition-colors hover:bg-surface"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <HelpCircle className="h-4 w-4 text-primary" />
          Why this score?
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-foreground/40 transition-transform duration-300", open && "rotate-180")}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-4 px-4 pb-4 pt-1">
            {!hasExplanation ? (
              <p className="text-sm text-foreground/50">
                A detailed breakdown isn&apos;t available for this analysis. Re-run it to see the full calculation.
              </p>
            ) : (
              <>
                {/* Step-by-step chain summary */}
                <p className="rounded-lg bg-surface px-3 py-2.5 text-sm font-medium leading-relaxed text-foreground">
                  {chainParts.map((part, i) => (
                    <span key={i}>
                      {i > 0 && <span className="mx-1.5 text-foreground/30">→</span>}
                      {part}
                    </span>
                  ))}
                </p>

                {/* Weighted components that make up the base score */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/40">
                    Base score — 4 weighted components
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {score.components!.map((c) => (
                      <li
                        key={c.key}
                        className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2 text-sm"
                      >
                        <span className="text-foreground">
                          {c.label} <span className="text-foreground/40">· {Math.round(c.weight * 100)}% weight</span>
                        </span>
                        <span className="whitespace-nowrap text-foreground/70">
                          {Math.round(c.rawScore)} × {c.weight.toFixed(2)} ={" "}
                          <span className="font-semibold text-foreground">{c.weightedPoints.toFixed(1)} pts</span>
                        </span>
                      </li>
                    ))}
                    <li className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-semibold">
                      <span className="text-foreground">Base score</span>
                      <span className="text-foreground">{score.baseScore!.toFixed(1)}</span>
                    </li>
                  </ul>
                </div>

                {/* Adjustments applied on top of the base score */}
                {score.adjustments!.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/40">
                      Adjustments applied
                    </p>
                    <ul className="flex flex-col gap-2">
                      {score.adjustments!.map((adj) => {
                        const impact =
                          adj.kind === "multiplier" && adj.percentImpact !== null
                            ? formatSigned(adj.percentImpact, "%", 0)
                            : adj.points !== null
                              ? formatSigned(adj.points, " pts", 1)
                              : "—";
                        return (
                          <li key={adj.key} className="flex gap-2.5 rounded-lg bg-surface px-3 py-2.5">
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
                              {adj.kind === "multiplier" ? (
                                <Percent className="h-3.5 w-3.5" />
                              ) : (
                                <MinusCircle className="h-3.5 w-3.5" />
                              )}
                            </span>
                            <div className="flex flex-1 flex-col gap-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium text-foreground">{adj.label}</span>
                                <span className="whitespace-nowrap text-sm font-semibold text-error">{impact}</span>
                              </div>
                              <p className="text-xs text-foreground/55">{adj.detail}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Final score */}
                <div
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold",
                    `${colors.bg}/10 ${colors.text}`
                  )}
                >
                  <span>Final score — {getScoreLabel(score.overallScore)}</span>
                  <span>{Math.round(score.finalScore ?? score.overallScore)} / 100</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
