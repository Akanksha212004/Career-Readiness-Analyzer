"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShieldAlert, Lightbulb, Users } from "lucide-react";

import { fetchMyPostings, fetchPostingSkillGaps } from "@/lib/api";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function AdminSkillInsightsPage() {
  return (
    <ProtectedRoute requiredRole={["hr", "super_admin"]}>
      <SkillInsightsContent />
    </ProtectedRoute>
  );
}

function SkillInsightsContent() {
  const [postingId, setPostingId] = useState<string>("");

  const { data: postings, isLoading: postingsLoading } = useQuery({
    queryKey: ["postings", "mine"],
    queryFn: fetchMyPostings,
  });

  const effectivePostingId = postingId || postings?.[0]?._id || "";

  const {
    data: gaps,
    isLoading: gapsLoading,
    isError: gapsError,
  } = useQuery({
    queryKey: ["admin", "skill-gaps", effectivePostingId],
    queryFn: () => fetchPostingSkillGaps(effectivePostingId),
    enabled: Boolean(effectivePostingId),
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">Skill Insights</h1>
          <p className="mt-1 text-foreground/60">
            Which required skills are your applicants most often missing, for one posting at a time.
          </p>
        </div>
        <Select value={effectivePostingId} onValueChange={setPostingId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder={postingsLoading ? "Loading postings..." : "Select a posting"} />
          </SelectTrigger>
          <SelectContent>
            {(postings ?? []).map((p) => (
              <SelectItem key={p._id} value={p._id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!postingsLoading && (postings ?? []).length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Lightbulb className="h-8 w-8 text-foreground/30" />
            <p className="text-foreground/60">Create a posting first to see skill insights for its candidates.</p>
          </CardContent>
        </Card>
      )}

      {effectivePostingId && gapsLoading && (
        <div className="flex items-center gap-2 text-foreground/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading skill gaps...
        </div>
      )}

      {effectivePostingId && gapsError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldAlert className="h-8 w-8 text-error" />
            <p className="text-foreground/60">Couldn&apos;t load skill gaps for this posting.</p>
          </CardContent>
        </Card>
      )}

      {effectivePostingId && !gapsLoading && !gapsError && gaps && gaps.totalCandidates === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Users className="h-8 w-8 text-foreground/30" />
            <p className="text-foreground/60">No candidates have applied to &quot;{gaps.postingTitle}&quot; yet.</p>
          </CardContent>
        </Card>
      )}

      {effectivePostingId && !gapsLoading && !gapsError && gaps && gaps.totalCandidates > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-4.5 w-4.5 text-warning" />
              {gaps.postingTitle}
            </CardTitle>
            <CardDescription>
              Based on {gaps.totalCandidates} candidate{gaps.totalCandidates === 1 ? "" : "s"} who applied. Higher %
              means more candidates are missing that skill.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-4">
              {gaps.skillGaps.map((g) => (
                <li key={g.skill} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      {g.skill}
                      <Badge variant={g.category === "core" ? "primary" : "neutral"}>{g.category}</Badge>
                    </span>
                    <span className="text-foreground/60">
                      {g.failedCount}/{g.candidateCount} candidates missing ({g.failRate}%)
                    </span>
                  </div>
                  <Progress
                    value={g.failRate}
                    indicatorClassName={
                      g.failRate >= 60 ? "bg-error" : g.failRate >= 30 ? "bg-warning" : "bg-accent"
                    }
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


