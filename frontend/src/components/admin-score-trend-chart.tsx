"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { DashboardStats } from "@/lib/types";

/**
 * Same approach as components/score-trend-chart.tsx: recharts needs real
 * color strings, not Tailwind classes, so we read the live CSS variables at
 * render time and stay in sync with the light/dark theme.
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

    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return colors;
}

export function AdminScoreTrendChart({ scoreTrend }: { scoreTrend: DashboardStats["scoreTrend"] }) {
  const { primary, border, foreground } = useThemeColors();

  const data = scoreTrend.map((d) => ({
    date: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    score: d.averageScore,
    count: d.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="adminScoreTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={primary} stopOpacity={0.28} />
            <stop offset="100%" stopColor={primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={border} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 12, fill: foreground, opacity: 0.6 }} axisLine={{ stroke: border }} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: foreground, opacity: 0.6 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 10, border: `1px solid ${border}`, fontSize: 13, background: "var(--background)", color: "var(--foreground)" }}
          formatter={(value, name, item) => [`${value} (${item.payload.count} candidate${item.payload.count === 1 ? "" : "s"})`, "Avg. readiness score"]}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke={primary}
          strokeWidth={2.5}
          fill="url(#adminScoreTrendFill)"
          dot={{ r: 4, fill: primary }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
