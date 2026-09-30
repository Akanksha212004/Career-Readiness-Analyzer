"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldAlert, ShieldCheck, ShieldX, Building2, Clock, UserCog } from "lucide-react";

import {
  fetchSuperAdminCompanies,
  approveCompany,
  rejectCompany,
  fetchSuperAdminRequests,
  approveSuperAdminRequest,
  rejectSuperAdminRequest,
  ApiError,
} from "@/lib/api";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function SuperAdminPage() {
  return (
    <ProtectedRoute requiredRole="super_admin">
      <SuperAdminContent />
    </ProtectedRoute>
  );
}

function SuperAdminContent() {
  const queryClient = useQueryClient();

  const {
    data: pending,
    isLoading: pendingLoading,
    isError: pendingError,
  } = useQuery({
    queryKey: ["super-admin", "companies", "pending"],
    queryFn: () => fetchSuperAdminCompanies("pending"),
  });

  const {
    data: approved,
    isLoading: approvedLoading,
    isError: approvedError,
  } = useQuery({
    queryKey: ["super-admin", "companies", "approved"],
    queryFn: () => fetchSuperAdminCompanies("approved"),
  });

  const {
    data: pendingRequests,
    isLoading: pendingRequestsLoading,
    isError: pendingRequestsError,
  } = useQuery({
    queryKey: ["super-admin", "requests", "pending"],
    queryFn: () => fetchSuperAdminRequests("pending"),
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["super-admin", "companies"] });
  }

  function invalidateRequests() {
    queryClient.invalidateQueries({ queryKey: ["super-admin", "requests"] });
  }

  const approveMutation = useMutation({
    mutationFn: approveCompany,
    onSuccess: invalidateAll,
  });
  const rejectMutation = useMutation({
    mutationFn: rejectCompany,
    onSuccess: invalidateAll,
  });

  const approveRequestMutation = useMutation({
    mutationFn: approveSuperAdminRequest,
    onSuccess: invalidateRequests,
  });
  const rejectRequestMutation = useMutation({
    mutationFn: rejectSuperAdminRequest,
    onSuccess: invalidateRequests,
  });

  const actionError = approveMutation.error || rejectMutation.error;
  const requestActionError = approveRequestMutation.error || rejectRequestMutation.error;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">Company Approvals</h1>
        <p className="mt-1 text-foreground/60">
          Review new company registrations before they can post openings or collect applicants.
        </p>
      </div>

      {actionError && (
        <p className="mb-4 text-sm text-error">
          {actionError instanceof ApiError ? actionError.message : "Something went wrong. Please try again."}
        </p>
      )}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4.5 w-4.5 text-warning" />
            Pending requests
          </CardTitle>
          <CardDescription>New companies waiting for review.</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingLoading && (
            <div className="flex items-center gap-2 py-6 text-foreground/50">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          )}
          {pendingError && (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-foreground/60">
              <ShieldAlert className="h-6 w-6 text-error" /> Couldn&apos;t load pending companies.
            </div>
          )}
          {!pendingLoading && !pendingError && pending && pending.length === 0 && (
            <p className="py-6 text-center text-sm text-foreground/50">No pending requests right now.</p>
          )}
          {!pendingLoading && !pendingError && pending && pending.length > 0 && (
            <ul className="flex flex-col divide-y divide-border">
              {pending.map((c) => (
                <li key={c.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-foreground/50">
                      {c.domain} · Requested {new Date(c.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={rejectMutation.isPending}
                      onClick={() => rejectMutation.mutate(c.id)}
                    >
                      <ShieldX className="h-3.5 w-3.5" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={approveMutation.isPending}
                      onClick={() => approveMutation.mutate(c.id)}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" /> Approve
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {requestActionError && (
        <p className="mb-4 text-sm text-error">
          {requestActionError instanceof ApiError ? requestActionError.message : "Something went wrong. Please try again."}
        </p>
      )}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-4.5 w-4.5 text-warning" />
            Pending super admin requests
          </CardTitle>
          <CardDescription>HR users asking to be promoted to super admin.</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingRequestsLoading && (
            <div className="flex items-center gap-2 py-6 text-foreground/50">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          )}
          {pendingRequestsError && (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-foreground/60">
              <ShieldAlert className="h-6 w-6 text-error" /> Couldn&apos;t load pending requests.
            </div>
          )}
          {!pendingRequestsLoading && !pendingRequestsError && pendingRequests && pendingRequests.length === 0 && (
            <p className="py-6 text-center text-sm text-foreground/50">No pending requests right now.</p>
          )}
          {!pendingRequestsLoading && !pendingRequestsError && pendingRequests && pendingRequests.length > 0 && (
            <ul className="flex flex-col divide-y divide-border">
              {pendingRequests.map((r) => (
                <li key={r.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{r.requestedByName ?? "Unknown user"}</p>
                    <p className="text-xs text-foreground/50">
                      {r.requestedByEmail} · Requested {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                    <p className="mt-2 text-sm text-foreground/70">{r.justification}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={rejectRequestMutation.isPending}
                      onClick={() => rejectRequestMutation.mutate(r.id)}
                    >
                      <ShieldX className="h-3.5 w-3.5" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={approveRequestMutation.isPending}
                      onClick={() => approveRequestMutation.mutate(r.id)}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" /> Approve
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4.5 w-4.5 text-accent" />
            Active companies
          </CardTitle>
          <CardDescription>Approved companies currently able to post openings.</CardDescription>
        </CardHeader>
        <CardContent>
          {approvedLoading && (
            <div className="flex items-center gap-2 py-6 text-foreground/50">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          )}
          {approvedError && (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-foreground/60">
              <ShieldAlert className="h-6 w-6 text-error" /> Couldn&apos;t load active companies.
            </div>
          )}
          {!approvedLoading && !approvedError && approved && approved.length === 0 && (
            <p className="py-6 text-center text-sm text-foreground/50">No approved companies yet.</p>
          )}
          {!approvedLoading && !approvedError && approved && approved.length > 0 && (
            <ul className="flex flex-col divide-y divide-border">
              {approved.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-foreground/50">{c.domain}</p>
                  </div>
                  <Badge variant="success">Approved</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


