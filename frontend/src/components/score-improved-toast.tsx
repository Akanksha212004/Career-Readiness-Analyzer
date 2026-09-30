"use client";

import { useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Sparkles } from "lucide-react";

import { tierColors, type ScoreTier } from "@/lib/score";

const TIER_MESSAGE: Record<ScoreTier, string> = {
  green: "Your resume now reads as a strong fit.",
  amber: "Nice progress — you're getting there.",
  red: "Score updated.",
};

export function ScoreImprovedToast({
  tier,
  onDone,
  durationMs = 3200,
}: {
  tier: ScoreTier;
  onDone: () => void;
  durationMs?: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  const colors = tierColors[tier];

  useEffect(() => {
    const timer = setTimeout(onDone, durationMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      role="status"
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-2.5 rounded-xl border border-border bg-white px-4 py-3 shadow-lg"
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colors.bg}/10 ${colors.text}`}>
        <Sparkles className="h-4 w-4" />
      </span>
      <p className="text-sm font-medium text-foreground">{TIER_MESSAGE[tier]}</p>
    </motion.div>
  );
}

export function ScoreImprovedToastViewport({
  toast,
  onDismiss,
}: {
  toast: { id: number; tier: ScoreTier } | null;
  onDismiss: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center sm:justify-end sm:pr-8">
      <div className="pointer-events-auto">
        <AnimatePresence>
          {toast && <ScoreImprovedToast key={toast.id} tier={toast.tier} onDone={onDismiss} />}
        </AnimatePresence>
      </div>
    </div>
  );
}
