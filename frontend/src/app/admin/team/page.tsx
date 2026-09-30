"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldAlert, Users, Copy, Check, Building2, UserCog, Clock, ShieldCheck, ShieldX } from "lucide-react";

import { fetchMyCompany, inviteTeammate, submitSuperAdminRequest, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { CompanySubRole, CompanyStatus, InviteResult } from "@/lib/types";

const MIN_JUSTIFICATION_LENGTH = 20;

const STATUS_BADGE: Record<CompanyStatus, "success" | "warning" | "error"> = {
  approved: "success",
  pending: "warning",
  rejected: "error",
};

export default function AdminTeamPage() {
  return (
    <ProtectedRoute requiredRole={["hr", "super_admin"]}>
      <AdminTeamContent />
    </ProtectedRoute>
  );
}

function AdminTeamContent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [subRole, setSubRole] = useState<CompanySubRole>("hr_viewer");
  const [formError, setFormError] = useState<string | null>(null);
  const [lastInvite, setLastInvite] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [showSuperAdminForm, setShowSuperAdminForm] = useState(false);
  const [justification, setJustification] = useState("");
  const [superAdminFormError, setSuperAdminFormError] = useState<string | null>(null);
  const [superAdminRequestSent, setSuperAdminRequestSent] = useState(false);

  const superAdminRequestMutation = useMutation({
    mutationFn: () => submitSuperAdminRequest({ justification: justification.trim() }),
    onSuccess: () => {
      setSuperAdminRequestSent(true);
      setSuperAdminFormError(null);
      setShowSuperAdminForm(false);
      setJustification("");
    },
    onError: (err) =>
      setSuperAdminFormError(err instanceof ApiError ? err.message : "Couldn't submit your request."),
  });

  function onSubmitSuperAdminRequest(e: React.FormEvent) {
    e.preventDefault();
    setSuperAdminFormError(null);
    if (justification.trim().length < MIN_JUSTIFICATION_LENGTH) {
      setSuperAdminFormError(`Justification must be at least ${MIN_JUSTIFICATION_LENGTH} characters.`);
      return;
    }
    superAdminRequestMutation.mutate();
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ["companies", "me"],
    queryFn: fetchMyCompany,
  });

  const inviteMutation = useMutation({
    mutationFn: () => inviteTeammate(data!.company.id, { email: email.trim(), subRole }),
    onSuccess: (invite) => {
      setLastInvite(invite);
      setEmail("");
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["companies", "me"] });
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Couldn't send the invite."),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!email.trim()) {
      setFormError("An email address is required.");
      return;
    }
    inviteMutation.mutate();
  }

  function copyInviteLink() {
    if (!lastInvite) return;
    const url = `${window.location.origin}${lastInvite.inviteUrl}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">Team &amp; Company Settings</h1>
        <p className="mt-1 text-foreground/60">Your company profile and who has access to this dashboard.</p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-foreground/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldAlert className="h-8 w-8 text-error" />
            <p className="text-foreground/60">Couldn&apos;t load your company. Please try again.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && data && (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4.5 w-4.5 text-accent" />
                Company profile
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-6">
              <div>
                <p className="text-xs uppercase tracking-wide text-foreground/50">Name</p>
                <p className="font-medium text-foreground">{data.company.name}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-foreground/50">Domain</p>
                <p className="font-medium text-foreground">{data.company.domain}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-foreground/50">Status</p>
                <Badge variant={STATUS_BADGE[data.company.status]} className="capitalize">
                  {data.company.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invite a teammate</CardTitle>
              <CardDescription>
                No email is sent automatically - copy the invite link below and share it directly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="teammate@company.com"
                    className="w-64"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Role</Label>
                  <Select value={subRole} onValueChange={(v) => setSubRole(v as CompanySubRole)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hr_viewer">Viewer</SelectItem>
                      <SelectItem value="hr_admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={inviteMutation.isPending} className="gap-1.5">
                  {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Send invite
                </Button>
              </form>

              {formError && <p className="mt-3 text-sm text-error">{formError}</p>}

              {lastInvite && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs text-foreground/50">Invite link for {lastInvite.email}</p>
                    <p className="truncate text-sm text-foreground">
                      {typeof window !== "undefined" ? `${window.location.origin}${lastInvite.inviteUrl}` : lastInvite.inviteUrl}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={copyInviteLink} className="shrink-0 gap-1.5">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-primary" />
                Team
              </CardTitle>
              <CardDescription>{data.members.length} member{data.members.length === 1 ? "" : "s"}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col divide-y divide-border">
                {data.members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-foreground">{m.name ?? m.email}</p>
                      {m.name && <p className="text-xs text-foreground/50">{m.email}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">{m.subRole === "hr_admin" ? "Admin" : "Viewer"}</Badge>
                      {m.status === "active" ? (
                        <Badge variant="success">Active</Badge>
                      ) : m.status === "declined" ? (
                        <Badge variant="error">Declined</Badge>
                      ) : (
                        <Badge variant="warning">Invited</Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {user?.role === "hr" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="h-4.5 w-4.5 text-warning" />
                  Super admin access
                </CardTitle>
                <CardDescription>
                  Request elevated access to review and approve companies platform-wide.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {superAdminRequestSent && !showSuperAdminForm && (
                  <div className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground/70">
                    <Clock className="h-4 w-4 shrink-0 text-warning" />
                    Your request has been submitted and is awaiting review by a super admin.
                  </div>
                )}

                {!showSuperAdminForm && !superAdminRequestSent && (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setShowSuperAdminForm(true)}
                  >
                    <UserCog className="h-4 w-4" /> Request Super Admin Access
                  </Button>
                )}

                {showSuperAdminForm && (
                  <form onSubmit={onSubmitSuperAdminRequest} className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="super-admin-justification">Why do you need super admin access?</Label>
                      <Textarea
                        id="super-admin-justification"
                        placeholder="Explain why you need platform-wide access..."
                        value={justification}
                        onChange={(e) => setJustification(e.target.value)}
                      />
                    </div>

                    {superAdminFormError && <p className="text-sm text-error">{superAdminFormError}</p>}

                    <div className="flex gap-2">
                      <Button type="submit" disabled={superAdminRequestMutation.isPending} className="gap-1.5">
                        {superAdminRequestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        Submit request
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="gap-1.5"
                        onClick={() => {
                          setShowSuperAdminForm(false);
                          setSuperAdminFormError(null);
                        }}
                      >
                        <ShieldX className="h-4 w-4" /> Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

