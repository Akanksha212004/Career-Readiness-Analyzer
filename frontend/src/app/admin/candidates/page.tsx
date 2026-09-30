"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Loader2, ShieldAlert, Users, ArrowUpDown, ChevronLeft, ChevronRight, X } from "lucide-react";

import { fetchAdminAnalyses, fetchMyPostings, updateAnalysisStatus } from "@/lib/api";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { tierColors, getScoreTier } from "@/lib/score";
import { PIPELINE_STATUSES, PIPELINE_STATUS_META } from "@/lib/pipeline";
import type { AdminAnalysesFilters, AnalysisStatus } from "@/lib/types";

const PAGE_LIMIT = 20;

export default function AdminCandidatesPage() {
  return (
    <ProtectedRoute requiredRole={["hr", "super_admin"]}>
      <AdminCandidatesContent />
    </ProtectedRoute>
  );
}

function AdminCandidatesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [postingId, setPostingId] = useState(searchParams.get("postingId") ?? "");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "score">("date");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const { data: postings } = useQuery({ queryKey: ["postings", "mine"], queryFn: fetchMyPostings });

  const filters: AdminAnalysesFilters = {
    page,
    limit: PAGE_LIMIT,
    postingId: postingId || undefined,
    minScore: minScore !== "" ? Number(minScore) : undefined,
    maxScore: maxScore !== "" ? Number(maxScore) : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    sortBy,
    order,
  };

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["admin", "analyses", filters],
    queryFn: () => fetchAdminAnalyses(filters),
    placeholderData: keepPreviousData,
  });

  const queryClient = useQueryClient();
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AnalysisStatus }) => updateAnalysisStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "analyses"] });
    },
  });

  function updatePostingFilter(value: string) {
    setPostingId(value);
    setPage(1);
    // Reflect in the URL so links like the /admin overview's "candidates"
    // link (?postingId=...) land pre-filtered.
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("postingId", value);
    else params.delete("postingId");
    router.replace(`/admin/candidates${params.toString() ? `?${params}` : ""}`);
  }

  function toggleSort(field: "date" | "score") {
    setPage(1);
    if (sortBy === field) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setOrder("desc");
    }
  }

  function clearFilters() {
    setPostingId("");
    setMinScore("");
    setMaxScore("");
    setStartDate("");
    setEndDate("");
    setPage(1);
    router.replace("/admin/candidates");
  }

  const hasActiveFilters = Boolean(postingId || minScore || maxScore || startDate || endDate);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">Candidates</h1>
        <p className="mt-1 text-foreground/60">
          Every candidate who has applied to one of your postings, with their resume match score.
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-4 pt-5">
          <div className="flex flex-col gap-1.5">
            <Label>Posting</Label>
            <Select value={postingId || "all"} onValueChange={(v) => updatePostingFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All postings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All postings</SelectItem>
                {(postings ?? []).map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Min score</Label>
            <Input
              type="number"
              min={0}
              max={100}
              className="w-24"
              value={minScore}
              onChange={(e) => {
                setMinScore(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Max score</Label>
            <Input
              type="number"
              min={0}
              max={100}
              className="w-24"
              value={maxScore}
              onChange={(e) => {
                setMaxScore(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>From</Label>
            <Input
              type="date"
              className="w-40"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>To</Label>
            <Input
              type="date"
              className="w-40"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5">
              <X className="h-3.5 w-3.5" /> Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center gap-2 text-foreground/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading candidates...
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldAlert className="h-8 w-8 text-error" />
            <p className="text-foreground/60">Couldn&apos;t load candidates. Please try again.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && data && data.analyses.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Users className="h-8 w-8 text-foreground/30" />
            <p className="text-foreground/60">No candidates match these filters.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && data && data.analyses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All candidates</CardTitle>
            <CardDescription>{data.pagination.total} total</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">
                    <button onClick={() => toggleSort("score")} className="flex items-center gap-1 hover:text-foreground">
                      Score <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2 pr-4">Posting</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">
                    <button onClick={() => toggleSort("date")} className="flex items-center gap-1 hover:text-foreground">
                      Date <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className={isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}>
                {data.analyses.map((a) => {
                  const candidate = typeof a.userId === "object" ? a.userId : null;
                  const postingTitle = typeof a.postingId === "object" && a.postingId ? a.postingId.title : a.roleTitle;
                  const score = Math.round(a.score?.overallScore ?? 0);
                  return (
                    <tr key={a._id} className="border-b border-border/60 last:border-0">
                      <td className="py-3 pr-4">
                        <Link href={`/admin/candidates/${a._id}`} className="block hover:text-primary">
                          <p className="font-medium text-foreground">{candidate?.name ?? "Unknown candidate"}</p>
                          {candidate?.email && <p className="text-xs text-foreground/50">{candidate.email}</p>}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`font-heading font-semibold ${tierColors[getScoreTier(score)].text}`}>{score}</span>
                      </td>
                      <td className="py-3 pr-4 text-foreground/70">{postingTitle}</td>
                      <td className="py-3 pr-4">
                        <Select
                          value={a.status}
                          onValueChange={(v) => statusMutation.mutate({ id: a._id, status: v as AnalysisStatus })}
                        >
                          <SelectTrigger className="h-8 w-36 text-xs">
                            <SelectValue>
                              <Badge variant={PIPELINE_STATUS_META[a.status].badgeVariant}>
                                {PIPELINE_STATUS_META[a.status].label}
                              </Badge>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {PIPELINE_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {PIPELINE_STATUS_META[s].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 pr-4 text-foreground/50">{new Date(a.createdAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <p className="text-xs text-foreground/50">
                Page {data.pagination.page} of {data.pagination.pages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="gap-1"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
