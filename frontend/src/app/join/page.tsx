"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Users, AlertCircle } from "lucide-react";

import { useAuth } from "@/lib/auth-provider";
import { fetchInviteInfo, acceptInvite, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function JoinPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const {
    data: invite,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["invite", token],
    queryFn: () => fetchInviteInfo(token),
    enabled: Boolean(token),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: () => acceptInvite(user ? { token } : { token, name, password }),
    onSuccess: () => {
      router.push("/admin");
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Couldn't accept the invite."),
  });

  if (!token) {
    return <EmptyState message="This invite link is missing a token." />;
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-foreground/50">
        <Loader2 className="h-6 w-6 animate-spin" />
        Checking invite...
      </div>
    );
  }

  if (isError || !invite) {
    return <EmptyState message="This invite link is invalid or has already been used." />;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!user) {
      if (!name.trim()) {
        setFormError("Your name is required.");
        return;
      }
      if (password.length < 8) {
        setFormError("Password must be at least 8 characters.");
        return;
      }
    }
    mutation.mutate();
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-md flex-col items-center justify-center px-6 py-14">
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
        <Users className="h-5 w-5" />
      </span>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Join {invite.companyName}</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join as a{" "}
            {invite.subRole === "hr_admin" ? "company admin" : "team member"} for{" "}
            <span className="font-medium text-foreground">{invite.invitedEmail}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user && user.email !== invite.invitedEmail ? (
            <p className="text-sm text-error">
              You&apos;re logged in as {user.email}, but this invite was sent to {invite.invitedEmail}. Log out and
              try again from that account, or open this link in a private window.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              {!user && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="name">Your name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="password">Choose a password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                    />
                  </div>
                </>
              )}

              {formError && <p className="text-sm text-error">{formError}</p>}

              <Button type="submit" size="lg" disabled={mutation.isPending} className="mt-1">
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Joining...
                  </>
                ) : user ? (
                  `Accept as ${user.name}`
                ) : (
                  "Create account & join"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <AlertCircle className="h-8 w-8 text-error" />
      <p className="text-foreground/70">{message}</p>
    </div>
  );
}

