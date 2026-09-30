"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShieldAlert, TrendingUp, Users, Target, Briefcase, ArrowRight, Clock } from "lucide-react";

import { fetchAdminDashboardStats, fetchMyCompany } from "@/lib/api";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminScoreTrendChart } from "@/components/admin-score-trend-chart";
import { tierColors, getScoreTier } from "@/lib/score";

export default function AdminPage() {
  return (
    <ProtectedRoute requiredRole={["hr", "super_admin"]}>
      <AdminOverviewContent />
    </ProtectedRoute>
  );
}

function AdminOverviewContent() {
  const { data: company } = useQuery({
    queryKey: ["companies", "me"],
    queryFn: fetchMyCompany,
  });

  const {
    data: stats,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["admin", "dashboard-stats"],
    queryFn: fetchAdminDashboardStats,
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {company && company.company.status !== "approved" && (
        <Card className="mb-6 border-warning/30 bg-warning/5">
          <CardContent className="flex items-center gap-3 pt-5 text-sm text-foreground/70">
            <Clock className="h-5 w-5 shrink-0 text-warning" />
            {company.company.status === "pending" ? (
              <span>
                <strong className="text-foreground">{company.company.name}</strong> is pending approval by an
                administrator. You&apos;ll be able to create postings once it&apos;s approved.
              </span>
            ) : (
              <span>
                <strong className="text-foreground">{company.company.name}</strong> was not approved. Contact
                support if you believe this is a mistake.
              </span>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">Overview</h1>
          <p className="mt-1 text-foreground/60">How candidates are matching against your company&apos;s postings.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/admin/postings">
              <Briefcase className="h-4 w-4" /> Postings
            </Link>
          </Button>
          <Button asChild className="gap-1.5">
            <Link href="/admin/candidates">
              <Users className="h-4 w-4" /> Candidates
            </Link>
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-foreground/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading overview...
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldAlert className="h-8 w-8 text-error" />
            <p className="text-foreground/60">Couldn&apos;t load the overview. Please try again.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && stats && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={<Users className="h-4.5 w-4.5" />}
              label="Total candidates"
              value={String(stats.totalCandidates)}
              sub={`${stats.totalApplications} application${stats.totalApplications === 1 ? "" : "s"}`}
            />
            <StatCard
              icon={<Target className="h-4.5 w-4.5" />}
              label="Average readiness score"
              value={String(stats.averageScore)}
              valueClassName={tierColors[getScoreTier(stats.averageScore)].text}
            />
            <StatCard
              icon={<Briefcase className="h-4.5 w-4.5" />}
              label="Postings with applicants"
              value={String(stats.postingBreakdown.length)}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4.5 w-4.5 text-accent" />
                Score trend
              </CardTitle>
              <CardDescription>Average candidate readiness score by day.</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.scoreTrend.length > 1 ? (
                <AdminScoreTrendChart scoreTrend={stats.scoreTrend} />
              ) : (
                <p className="py-10 text-center text-sm text-foreground/50">
                  Not enough data yet — the trend chart appears once candidates have applied across more than one day.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top postings by applicant volume</CardTitle>
              <CardDescription>Candidate count and average score per posting.</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.postingBreakdown.length === 0 ? (
                <p className="py-6 text-center text-sm text-foreground/50">No applications yet.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {[...stats.postingBreakdown]
                    .sort((a, b) => b.candidateCount - a.candidateCount)
                    .slice(0, 5)
                    .map((p) => (
                      <li key={p.postingId} className="flex items-center justify-between gap-4 py-3">
                        <Link
                          href={`/admin/candidates?postingId=${p.postingId}`}
                          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary"
                        >
                          {p.title}
                          <ArrowRight className="h-3.5 w-3.5 text-foreground/30" />
                        </Link>
                        <div className="flex items-center gap-4 text-sm text-foreground/60">
                          <span>
                            {p.candidateCount} candidate{p.candidateCount === 1 ? "" : "s"}
                          </span>
                          <span className={tierColors[getScoreTier(p.averageScore)].text}>avg {p.averageScore}</span>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-5">
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-foreground/50">
          {icon}
          {label}
        </span>
        <span className={`font-heading text-3xl font-semibold text-foreground ${valueClassName ?? ""}`}>{value}</span>
        {sub && <span className="text-xs text-foreground/50">{sub}</span>}
      </CardContent>
    </Card>
  );
}

