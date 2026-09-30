"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { HistoryEntry } from "@/lib/types";

/**
 * Recharts needs real color strings, not Tailwind classes, so we read the
 * live --primary/--border/--foreground CSS variables at render time. This
 * keeps the chart in sync with the light/dark theme (and any future theme
 * change) without hardcoding hex values here.
 */
function useThemeColors() {
  const [colors, setColors] = useState({ primary: "#0D9488", border: "#E2E8F0", foreground: "#1E293B" });

  useEffect(() => {
    const read = () => {
      const styles = getComputedStyle(document.documentElement);
      setColors({
        primary: styles.getPropertyValue("--primary").trim() || "#0D9488",
        border: styles.getPropertyValue("--border").trim() || "#E2E8F0",
        foreground: styles.getPropertyValue("--foreground").trim() || "#1E293B",
      });
    };
    read();

    // Re-read whenever the `dark` class toggles on <html>.
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return colors;
}

export function ScoreTrendChart({ history }: { history: HistoryEntry[] }) {
  const { primary, border, foreground } = useThemeColors();

  const data = history.map((h, i) => ({
    attempt: `#${i + 1}`,
    date: new Date(h.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    score: h.score.overallScore,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="scoreTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={primary} stopOpacity={0.28} />
            <stop offset="100%" stopColor={primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={border} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 12, fill: foreground, opacity: 0.6 }} axisLine={{ stroke: border }} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: foreground, opacity: 0.6 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 10, border: `1px solid ${border}`, fontSize: 13, background: "var(--background)", color: "var(--foreground)" }}
          labelFormatter={(label, payload) => (payload?.[0] ? `Attempt ${payload[0].payload.attempt}` : label)}
          formatter={(value) => [`${value}`, "Readiness score"]}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke={primary}
          strokeWidth={2.5}
          fill="url(#scoreTrendFill)"
          dot={{ r: 4, fill: primary }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
