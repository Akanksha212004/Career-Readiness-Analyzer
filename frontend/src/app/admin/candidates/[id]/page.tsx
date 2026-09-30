"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  Briefcase,
  FolderGit2,
  Clock,
  GraduationCap,
  Eye,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

import { fetchAdminAnalysisDetail } from "@/lib/api";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScoreGauge } from "@/components/score-gauge";
import { ScoreBreakdownBars } from "@/components/score-breakdown-bars";
import { ScoreExplanationPanel } from "@/components/score-explanation-panel";
import { SkillMatchList } from "@/components/skill-match-list";
import { AtsIssueList } from "@/components/ats-issue-list";
import { SuggestionList } from "@/components/suggestion-list";
import { GithubVerificationList } from "@/components/github-verification-list";

export default function AdminCandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProtectedRoute requiredRole={["hr", "super_admin"]}>
      <AdminCandidateDetailContent id={id} />
    </ProtectedRoute>
  );
}

function AdminCandidateDetailContent({ id }: { id: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "analysis", id],
    queryFn: () => fetchAdminAnalysisDetail(id),
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-foreground/50">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading candidate...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-error" />
        <p className="text-foreground/70">We couldn&apos;t find that candidate&apos;s analysis.</p>
        <Button asChild variant="outline">
          <Link href="/admin/candidates">Back to candidates</Link>
        </Button>
      </div>
    );
  }

  const atsIssueCount = data.atsIssues.length;
  const suggestionCount = data.suggestions.length;
  const githubVerifications = data.githubVerifications ?? [];
  const priorApplications = (data.applicationHistory ?? []).filter((a) => !a.isCurrent);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href="/admin/candidates"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-foreground/50 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to candidates
      </Link>

      <div className="mb-6 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            {data.roleTitle}
            <Badge variant="neutral" className="gap-1">
              <Eye className="h-3 w-3" /> Read-only
            </Badge>
          </p>
          <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
            Candidate Readiness Review
          </h1>
          <p className="mt-1 text-sm text-foreground/50">{data.resumeFilename}</p>
        </div>
      </div>

      {priorApplications.length > 0 && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 pt-5 text-sm text-foreground/70">
            {data.score.overallScore > priorApplications[priorApplications.length - 1].score ? (
              <TrendingUp className="h-5 w-5 shrink-0 text-accent" />
            ) : data.score.overallScore < priorApplications[priorApplications.length - 1].score ? (
              <TrendingDown className="h-5 w-5 shrink-0 text-error" />
            ) : (
              <Minus className="h-5 w-5 shrink-0 text-foreground/40" />
            )}
            <span>
              This candidate has applied {priorApplications.length + 1} times.{" "}
              {priorApplications.map((a, i) => (
                <span key={a.id}>
                  {i > 0 && ", "}
                  <strong className="text-foreground">{a.score}</strong>{" "}
                  <span className="text-xs">({new Date(a.createdAt).toLocaleDateString()})</span>
                </span>
              ))}{" "}
              → <strong className="text-foreground">{Math.round(data.score.overallScore)}</strong> now.
            </span>
          </CardContent>
        </Card>
      )}

      {/* Same hero card layout as the student's own dashboard, in read-only form. */}
      <Card className="mb-6">
        <CardContent className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
          <div className="flex flex-col items-center justify-center gap-6 lg:col-span-1">
            <ScoreGauge score={data.score.overallScore} />
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
            <Badge variant={data.atsFriendly ? "success" : "warning"}>{atsIssueCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="gap-1.5">
            Suggestions
            <Badge variant="primary">{suggestionCount}</Badge>
          </TabsTrigger>
          {githubVerifications.length > 0 && (
            <TabsTrigger value="github" className="gap-1.5">
              GitHub projects
              <Badge variant={githubVerifications.some((v) => v.status === "stale" || v.status === "not_found") ? "warning" : "success"}>
                {githubVerifications.length}
              </Badge>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="skills">
          <Card>
            <CardHeader>
              <CardTitle>Skill match breakdown</CardTitle>
              <CardDescription>Core skills matter most for this posting&apos;s requirements.</CardDescription>
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
              <AtsIssueList atsFriendly={data.atsFriendly} issues={data.atsIssues} hiddenTextWarning={data.hiddenTextWarning} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions">
          <Card>
            <CardHeader>
              <CardTitle>Suggestions shown to this candidate</CardTitle>
              <CardDescription>What the analyzer recommended they improve.</CardDescription>
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
                  Live-checked against GitHub for commit activity, README, and test coverage - feeds the small
                  authenticity bonus/malus in the score breakdown above.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GithubVerificationList verifications={githubVerifications} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function StatBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-surface p-3.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-foreground/50">
        {icon}
        {label}
      </span>
      <span className="font-heading text-lg font-semibold text-foreground">{value}</span>
    </div>
  );
}


