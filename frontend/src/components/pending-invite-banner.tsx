"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth-provider";
import { fetchMyInvites, acceptInvite, declineInvite } from "@/lib/api";
import { Button } from "@/components/ui/button";

/**
 * Shown at the top of every page (see layout.tsx) whenever the logged-in
 * user has one or more pending team invites addressed to their own account
 * email (see companyController.listMyInvites). Mirrors the look of the
 * company-pending-approval banner on /admin.
 *
 * Scope: existing, logged-in users only - someone without an account yet
 * still has to use the shared invite link (see /join).
 */
export function PendingInviteBanner() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: invites } = useQuery({
    queryKey: ["invites", "me"],
    queryFn: fetchMyInvites,
    enabled: Boolean(user),
  });

  const acceptMutation = useMutation({
    mutationFn: (token: string) => acceptInvite({ token }),
    onSuccess: () => {
      // Accepting changes the caller's role/companyId server-side (fresh
      // cookie issued). AuthProvider only fetches /auth/me once on mount,
      // so a full navigation is needed for the NavBar links and
      // ProtectedRoute checks to pick up the new role immediately.
      window.location.href = "/admin";
    },
  });

  const declineMutation = useMutation({
    mutationFn: (token: string) => declineInvite(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invites", "me"] });
    },
  });

  if (!user || !invites || invites.length === 0) {
    return null;
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 pt-6">
      {invites.map((invite) => (
        <div
          key={invite.id}
          className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2.5 text-sm text-foreground/70">
            <Users className="h-4.5 w-4.5 shrink-0 text-primary" />
            <span>
              <strong className="text-foreground">{invite.companyName}</strong> invited you to join as{" "}
              {invite.subRole === "hr_admin" ? "a company admin" : "a team member"}.
            </span>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={declineMutation.isPending || acceptMutation.isPending}
              onClick={() => declineMutation.mutate(invite.token)}
            >
              Deny
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={acceptMutation.isPending || declineMutation.isPending}
              onClick={() => acceptMutation.mutate(invite.token)}
            >
              {acceptMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Accept
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
