"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldAlert, Briefcase, Pencil, X, Users, Target, Sparkles, AlertTriangle } from "lucide-react";

import { fetchMyPostings, fetchAdminDashboardStats, createPosting, updatePosting, checkJdQuality, ApiError } from "@/lib/api";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { tierColors, getScoreTier } from "@/lib/score";
import type { Posting, PostingSeniority, PostingStatus, JdQualityFlag } from "@/lib/types";

const SEVERITY_BADGE: Record<JdQualityFlag["severity"], "error" | "warning" | "neutral"> = {
  high: "error",
  medium: "warning",
  low: "neutral",
};

const SENIORITY_OPTIONS: { value: PostingSeniority; label: string }[] = [
  { value: "internship", label: "Internship" },
  { value: "entry", label: "Entry-level" },
  { value: "mid", label: "Mid-level" },
  { value: "senior", label: "Senior" },
];

const STATUS_OPTIONS: { value: PostingStatus; label: string }[] = [
  { value: "active", label: "Active (visible to students)" },
  { value: "draft", label: "Draft (hidden)" },
  { value: "closed", label: "Closed (hidden)" },
];

type FormState = {
  title: string;
  skillsText: string;
  seniority: PostingSeniority;
  jobDescription: string;
  status: PostingStatus;
};

const EMPTY_FORM: FormState = {
  title: "",
  skillsText: "",
  seniority: "entry",
  jobDescription: "",
  status: "active",
};

export default function AdminPostingsPage() {
  return (
    <ProtectedRoute requiredRole={["hr", "super_admin"]}>
      <AdminPostingsContent />
    </ProtectedRoute>
  );
}

function AdminPostingsContent() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    data: postings,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["postings", "mine"],
    queryFn: fetchMyPostings,
  });

  // Candidate count + avg score per posting, for the "Applicants" / "Avg score"
  // columns below - same aggregate the /admin overview page uses.
  const { data: stats } = useQuery({
    queryKey: ["admin", "dashboard-stats"],
    queryFn: fetchAdminDashboardStats,
  });
  const statsByPostingId = new Map((stats?.postingBreakdown ?? []).map((p) => [p.postingId, p]));

  // Live, advisory-only JD quality check - debounced so we're not hitting
  // the ai-service on every keystroke. Never blocks saving the posting.
  const [debouncedJd, setDebouncedJd] = useState("");
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedJd(form.jobDescription.trim()), 600);
    return () => clearTimeout(timeout);
  }, [form.jobDescription]);

  const { data: jdQuality, isFetching: jdQualityLoading } = useQuery({
    queryKey: ["jd-quality", debouncedJd, form.seniority],
    queryFn: () => checkJdQuality({ jobDescription: debouncedJd, seniority: form.seniority }),
    enabled: debouncedJd.length >= 20,
  });

  function toPayload() {
    const requiredSkills = form.skillsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      title: form.title.trim(),
      requiredSkills,
      seniority: form.seniority,
      jobDescription: form.jobDescription.trim() || undefined,
      status: form.status,
    };
  }

  const createMutation = useMutation({
    mutationFn: createPosting,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["postings", "mine"] });
      setForm(EMPTY_FORM);
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Couldn't create the posting."),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; payload: ReturnType<typeof toPayload> }) =>
      updatePosting(vars.id, vars.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["postings", "mine"] });
      setEditingId(null);
      setForm(EMPTY_FORM);
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Couldn't update the posting."),
  });

  function startEdit(posting: Posting) {
    setEditingId(posting._id);
    setForm({
      title: posting.title,
      skillsText: posting.requiredSkills.join(", "),
      seniority: posting.seniority,
      jobDescription: posting.jobDescription ?? "",
      status: posting.status,
    });
    setFormError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!form.title.trim()) {
      setFormError("Title is required.");
      return;
    }
    const payload = toPayload();
    if (payload.requiredSkills.length === 0) {
      setFormError("Add at least one required skill, separated by commas.");
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">Postings</h1>
        <p className="mt-1 text-foreground/60">
          Create and manage postings for your company. Active postings are visible to students in the
          &quot;Apply to a company posting&quot; analyze mode.
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{editingId ? "Edit posting" : "New posting"}</CardTitle>
          <CardDescription>
            {editingId
              ? "Changes apply immediately - students browsing postings will see the latest version."
              : "Fill this out to open a new posting for students to apply to."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="posting-title">Title</Label>
                <Input
                  id="posting-title"
                  placeholder="e.g. Frontend Engineer Intern"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Seniority</Label>
                <Select
                  value={form.seniority}
                  onValueChange={(v) => setForm((f) => ({ ...f, seniority: v as PostingSeniority }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SENIORITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="posting-skills">Required skills</Label>
              <Input
                id="posting-skills"
                placeholder="e.g. React, TypeScript, REST APIs"
                value={form.skillsText}
                onChange={(e) => setForm((f) => ({ ...f, skillsText: e.target.value }))}
              />
              <p className="text-xs text-foreground/40">Comma-separated.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="posting-jd">Job description (optional)</Label>
              <Textarea
                id="posting-jd"
                placeholder="Paste a full job description, or leave blank to auto-generate one from the title and skills above."
                className="min-h-32"
                value={form.jobDescription}
                onChange={(e) => setForm((f) => ({ ...f, jobDescription: e.target.value }))}
              />
              {debouncedJd.length >= 20 && (
                <div className="mt-1 rounded-lg border border-border bg-surface px-3.5 py-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground/60">
                    {jdQualityLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking JD quality...
                      </>
                    ) : jdQuality ? (
                      <>
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        JD quality score: <span className="font-semibold text-foreground">{jdQuality.qualityScore}/100</span>
                      </>
                    ) : null}
                  </div>
                  {jdQuality && jdQuality.flags.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {jdQuality.flags.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-foreground/70">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-foreground/40" />
                          <span>
                            <Badge variant={SEVERITY_BADGE[f.severity]} className="mr-1.5 align-middle">
                              {f.severity}
                            </Badge>
                            {f.detail}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {jdQuality && jdQuality.flags.length === 0 && (
                    <p className="mt-1.5 text-xs text-accent">No issues found - this description looks clear and specific.</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5 sm:max-w-xs">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as PostingStatus }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formError && <p className="text-sm text-error">{formError}</p>}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : editingId ? (
                  "Save changes"
                ) : (
                  "Create posting"
                )}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={cancelEdit} disabled={isSaving}>
                  <X className="h-4 w-4" /> Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center gap-2 text-foreground/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading postings...
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldAlert className="h-8 w-8 text-error" />
            <p className="text-foreground/60">Couldn&apos;t load postings. Please try again.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && postings && postings.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Briefcase className="h-8 w-8 text-foreground/30" />
            <p className="text-foreground/60">No postings yet. Create your first one above.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && postings && postings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your postings</CardTitle>
            <CardDescription>{postings.length} total</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
                  <th className="py-2 pr-4">Title</th>
                  <th className="py-2 pr-4">Seniority</th>
                  <th className="py-2 pr-4">Skills</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Applicants</th>
                  <th className="py-2 pr-4">Avg score</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2 pr-4" />
                </tr>
              </thead>
              <tbody>
                {postings.map((p) => {
                  const postingStats = statsByPostingId.get(p._id);
                  return (
                    <tr key={p._id} className="border-b border-border/60 last:border-0">
                      <td className="py-3 pr-4 text-foreground">{p.title}</td>
                      <td className="py-3 pr-4 text-foreground/70 capitalize">{p.seniority}</td>
                      <td className="py-3 pr-4 text-foreground/70">
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {p.requiredSkills.slice(0, 4).map((skill) => (
                            <Badge key={skill} variant="neutral">
                              {skill}
                            </Badge>
                          ))}
                          {p.requiredSkills.length > 4 && (
                            <Badge variant="neutral">+{p.requiredSkills.length - 4}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge
                          variant={p.status === "active" ? "success" : p.status === "draft" ? "neutral" : "warning"}
                        >
                          {p.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-foreground/70">
                        {postingStats ? (
                          <Link
                            href={`/admin/candidates?postingId=${p._id}`}
                            className="flex items-center gap-1.5 hover:text-primary"
                          >
                            <Users className="h-3.5 w-3.5" />
                            {postingStats.candidateCount}
                          </Link>
                        ) : (
                          <span className="text-foreground/30">0</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {postingStats ? (
                          <span className={`flex items-center gap-1.5 ${tierColors[getScoreTier(postingStats.averageScore)].text}`}>
                            <Target className="h-3.5 w-3.5" />
                            {postingStats.averageScore}
                          </span>
                        ) : (
                          <span className="text-foreground/30">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-foreground/50">{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 pr-4">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(p)} className="gap-1.5">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


