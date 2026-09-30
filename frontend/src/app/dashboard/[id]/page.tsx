"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle, ArrowLeft, Briefcase, FolderGit2, Clock, GraduationCap } from "lucide-react";

import { fetchAnalysisById } from "@/lib/api";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScoreGauge } from "@/components/score-gauge";
import { ScoreBreakdownBars } from "@/components/score-breakdown-bars";
import { SkillMatchList } from "@/components/skill-match-list";
import { AtsIssueList } from "@/components/ats-issue-list";
import { GithubVerificationList } from "@/components/github-verification-list";
import { SuggestionList } from "@/components/suggestion-list";
import { ScoreImprovedToastViewport } from "@/components/score-improved-toast";
import { ScoreExplanationPanel } from "@/components/score-explanation-panel";
import type { ScoreTier } from "@/lib/score";

export default function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProtectedRoute>
      <DashboardContent id={id} />
    </ProtectedRoute>
  );
}

function DashboardContent({ id }: { id: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => fetchAnalysisById(id),
  });

  // Tracks a tier-improvement moment (e.g. an updated resume pushes the score
  // from "Getting there" into "Strong fit") so we can surface a brief, tasteful toast.
  const [tierToast, setTierToast] = useState<{ id: number; tier: ScoreTier } | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-foreground/50">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading your results...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-error" />
        <p className="text-foreground/70">We couldn&apos;t find that analysis.</p>
        <Button asChild variant="outline">
          <Link href="/">Start a new analysis</Link>
        </Button>
      </div>
    );
  }

  const atsIssueCount = data.atsIssues.length;
  const suggestionCount = data.suggestions.length;
  const githubVerifications = data.githubVerifications ?? [];
  const hasUnhealthyRepo = githubVerifications.some(
    (v) => v.status === "stale" || v.status === "not_found"
  );

  // Analyses run via "Apply to a company posting" carry the posting's own
  // title (see analysisController.js), rather than the generic "Custom Job
  // Description" label used for a plain pasted JD.
  const subtitle = data.postingId ? data.roleTitle : data.usedCustomJd ? "Custom job description" : data.roleTitle;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-foreground/50 hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> New analysis
      </Link>

      <div className="mb-6 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            {subtitle}
            {data.appliedToCompany && <Badge variant="success">Applied</Badge>}
          </p>
          <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
            Your Career Readiness Score
          </h1>
        </div>
      </div>

      {/* Persistent hero card: gauge + breakdown + at-a-glance stats, always visible above the tabs */}
      <Card className="mb-6">
        <CardContent className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
          <div className="flex flex-col items-center justify-center gap-6 lg:col-span-1">
            <ScoreGauge
              score={data.score.overallScore}
              onTierImprove={(tier) => setTierToast({ id: Date.now(), tier })}
            />
            <div className="w-full">
              <ScoreBreakdownBars score={data.score} />
            </div>
            <ScoreExplanationPanel score={data.score} />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:col-span-2 lg:content-center">
            <StatBlock
              icon={<Briefcase className="h-4 w-4" />}
              label="Skills matched"
              value={`${data.matchedSkillCount}/${data.totalRequiredSkillCount}`}
            />
            <StatBlock
              icon={<FolderGit2 className="h-4 w-4" />}
              label="Projects found"
              value={String(data.detectedProjectsCount)}
            />
            <StatBlock
              icon={<Clock className="h-4 w-4" />}
              label="Experience"
              value={`${data.detectedExperienceMonths} mo`}
            />
            <StatBlock
              icon={<GraduationCap className="h-4 w-4" />}
              label="Education match"
              value={data.educationDetected ? "Yes" : "No"}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="skills">
        <TabsList>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="ats" className="gap-1.5">
            ATS check
            <Badge variant={data.hiddenTextWarning?.detected ? "error" : data.atsFriendly ? "success" : "warning"}>
              {data.hiddenTextWarning?.detected ? "!" : atsIssueCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="gap-1.5">
            Suggestions
            <Badge variant="primary">{suggestionCount}</Badge>
          </TabsTrigger>
          {githubVerifications.length > 0 && (
            <TabsTrigger value="github" className="gap-1.5">
              GitHub projects
              <Badge variant={hasUnhealthyRepo ? "warning" : "success"}>{githubVerifications.length}</Badge>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="skills">
          <Card>
            <CardHeader>
              <CardTitle>Skill match breakdown</CardTitle>
              <CardDescription>Core skills matter most — close those gaps first.</CardDescription>
            </CardHeader>
            <CardContent>
              <SkillMatchList matches={data.skillMatches} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ats">
          <Card>
            <CardHeader>
              <CardTitle>ATS formatting check</CardTitle>
              <CardDescription>Formatting issues that could break automated resume parsers.</CardDescription>
            </CardHeader>
            <CardContent>
              <AtsIssueList
                atsFriendly={data.atsFriendly}
                issues={data.atsIssues}
                hiddenTextWarning={data.hiddenTextWarning}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions">
          <Card>
            <CardHeader>
              <CardTitle>Suggestions to improve your score</CardTitle>
              <CardDescription>Ordered by impact — start from the top.</CardDescription>
            </CardHeader>
            <CardContent>
              <SuggestionList suggestions={data.suggestions} />
            </CardContent>
          </Card>
        </TabsContent>

        {githubVerifications.length > 0 && (
          <TabsContent value="github">
            <Card>
              <CardHeader>
                <CardTitle>GitHub project verification</CardTitle>
                <CardDescription>
                  We checked each GitHub link against live repo activity instead of taking it at face value.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GithubVerificationList verifications={githubVerifications} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <div className="mt-8 flex justify-center">
        <Button asChild variant="outline">
          <Link href="/history">View my progress over time</Link>
        </Button>
      </div>

      <ScoreImprovedToastViewport toast={tierToast} onDismiss={() => setTierToast(null)} />
    </div>
  );
}

function StatBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-surface p-3.5 transition-colors hover:bg-border/40">
      <span className="flex items-center gap-1.5 text-xs font-medium text-foreground/50">
        {icon}
        {label}
      </span>
      <span className="font-heading text-lg font-semibold text-foreground">{value}</span>
    </div>
  );
}

