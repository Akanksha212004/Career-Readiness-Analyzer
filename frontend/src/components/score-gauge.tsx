"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from "motion/react";

import { getScoreTier, tierColors, getScoreLabel, type ScoreTier } from "@/lib/score";

const TIER_RANK: Record<ScoreTier, number> = { red: 0, amber: 1, green: 2 };

export function ScoreGauge({
  score,
  size = 188,
  onTierImprove,
}: {
  score: number;
  size?: number;
  /** Fires when a score change moves the gauge into a better tier (not on first mount). */
  onTierImprove?: (tier: ScoreTier, prevTier: ScoreTier) => void;
}) {
  const tier = getScoreTier(score);
  const colors = tierColors[tier];
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const prefersReducedMotion = useReducedMotion();
  const motionScore = useMotionValue(0);
  const offset = useTransform(motionScore, (v) => circumference * (1 - v / 100));
  const [displayScore, setDisplayScore] = useState(0);

  const prevTierRef = useRef<ScoreTier | null>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    const controls = animate(motionScore, score, {
      duration: prefersReducedMotion ? 0 : 0.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplayScore(Math.round(v)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score, prefersReducedMotion]);

  useEffect(() => {
    const newTier = getScoreTier(score);
    if (hasMountedRef.current && prevTierRef.current && TIER_RANK[newTier] > TIER_RANK[prevTierRef.current]) {
      onTierImprove?.(newTier, prevTierRef.current);
    }
    prevTierRef.current = newTier;
    hasMountedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative drop-shadow-[0_8px_20px_rgba(13,148,136,0.15)]" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            className="fill-none stroke-surface"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            style={{ strokeDashoffset: offset }}
            className={`fill-none ${colors.ring} transition-colors duration-500 ease-out`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-4xl font-semibold text-foreground tabular-nums">{displayScore}</span>
          <span className="text-xs text-foreground/50">out of 100</span>
        </div>
      </div>
      <span
        className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors duration-500 ${colors.bg}/10 ${colors.text}`}
      >
        {getScoreLabel(score)}
      </span>
    </div>
  );
}
