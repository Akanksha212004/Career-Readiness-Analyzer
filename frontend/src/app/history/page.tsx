"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Loader2, FileText, ArrowRight } from "lucide-react";

import { fetchHistory } from "@/lib/api";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreTrendChart } from "@/components/score-trend-chart";
import { getScoreTier, tierColors } from "@/lib/score";

export default function HistoryPage() {
  return (
    <ProtectedRoute>
      <HistoryContent />
    </ProtectedRoute>
  );
}

function HistoryContent() {
  const { data: history, isLoading } = useQuery({
    queryKey: ["history"],
    queryFn: () => fetchHistory(),
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">My Progress</h1>
        <p className="mt-1 text-foreground/60">Every resume you&apos;ve analyzed on your account, in order.</p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-foreground/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading history...
        </div>
      )}

      {!isLoading && history && history.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <FileText className="h-8 w-8 text-foreground/30" />
            <p className="text-foreground/60">No analyses yet. Upload a resume to get started.</p>
            <Link href="/" className="text-sm font-medium text-primary hover:underline">
              Analyze my resume
            </Link>
          </CardContent>
        </Card>
      )}

      {!isLoading && history && history.length > 0 && (
        <div className="flex flex-col gap-6">
          {history.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4.5 w-4.5 text-accent" />
                  Score trend
                </CardTitle>
                <CardDescription>Your overall readiness score across every attempt.</CardDescription>
              </CardHeader>
              <CardContent>
                <ScoreTrendChart history={history} />
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-3">
            {[...history].reverse().map((h) => {
              const tier = getScoreTier(h.score.overallScore);
              return (
                <Link key={h.id} href={`/dashboard/${h.id}`}>
                  <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                    <CardContent className="flex items-center justify-between gap-4 py-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tierColors[tier].bg}/10 ${tierColors[tier].text} font-heading text-sm font-semibold`}
                        >
                          {Math.round(h.score.overallScore)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {h.usedCustomJd ? "Custom job description" : h.roleTitle}
                          </p>
                          <p className="text-xs text-foreground/50">
                            {h.resumeFilename} · {new Date(h.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="neutral">
                          {h.matchedSkillCount}/{h.totalRequiredSkillCount} skills
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-foreground/30" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
