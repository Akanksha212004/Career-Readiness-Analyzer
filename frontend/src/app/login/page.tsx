"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Sprout, Briefcase, ShieldCheck } from "lucide-react";

import { useAuth } from "@/lib/auth-provider";
import { ApiError } from "@/lib/api";
import type { UserRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required.").email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});
type LoginValues = z.infer<typeof loginSchema>;

/** Query-string context only (`/login?portal=hr` etc.) - the route itself
 * never changes. Each entry maps a `?portal=` value to the heading/copy
 * shown on this page and the single role that's allowed to log in through
 * it (see the role-mismatch check in onSubmit below). */
const PORTAL_CONFIG: Record<string, { heading: string; description: string; expectedRole: UserRole }> = {
  hr: {
    heading: "Sign in to your HR portal",
    description: "Review candidates and manage postings for your company.",
    expectedRole: "hr",
  },
  admin: {
    heading: "Sign in as Admin",
    description: "Platform administration - review and approve company registrations.",
    expectedRole: "super_admin",
  },
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, logout } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const portalParam = searchParams.get("portal");
  const portal = portalParam && PORTAL_CONFIG[portalParam] ? PORTAL_CONFIG[portalParam] : null;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const loggedInUser = await login(values.email, values.password);

      if (portal && loggedInUser.role !== portal.expectedRole) {
        // Wrong portal for this account - don't redirect, log back out so
        // the session doesn't silently stick around on the login page.
        await logout();
        setServerError("Yeh account is portal ko access nahi kar sakta.");
        return;
      }

      // router.push(loggedInUser.role === "student" ? "/dashboard" : "/admin");
      router.push(loggedInUser.role === "student" ? "/" : "/admin");
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-md flex-col items-center justify-center px-6 py-14">
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
        <Sprout className="h-5 w-5" />
      </span>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{portal ? portal.heading : "Log in"}</CardTitle>
          <CardDescription>
            {portal ? portal.description : "Welcome back — pick up your resume history right where you left off."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} />
              {errors.email && <p className="text-sm text-error">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" {...register("password")} />
              {errors.password && <p className="text-sm text-error">{errors.password.message}</p>}
            </div>

            {serverError && <p className="text-sm text-error">{serverError}</p>}

            <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Logging in...
                </>
              ) : (
                "Log in"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="mt-5 text-sm text-foreground/60">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Sign up
        </Link>
      </p>

      <div className="mt-6 flex w-full items-center gap-3 text-foreground/30">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide">Other portals</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="mt-3 flex items-center gap-4 text-sm">
        <Link
          href="/login?portal=hr"
          className="flex items-center gap-1.5 text-foreground/50 hover:text-foreground"
        >
          <Briefcase className="h-3.5 w-3.5" /> HR/Company Portal
        </Link>
        <Link
          href="/login?portal=admin"
          className="flex items-center gap-1.5 text-foreground/50 hover:text-foreground"
        >
          <ShieldCheck className="h-3.5 w-3.5" /> Admin Access
        </Link>
      </div>
    </div>
  );
}

