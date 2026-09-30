"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth-provider";
import type { UserRole } from "@/lib/types";

/**
 * Client-side gate for pages that require a logged-in user, and optionally
 * a specific role (or one of a set of roles). This is a convenience
 * redirect only - the real security boundary is enforced by the backend's
 * authMiddleware / requireRole on every protected endpoint.
 */
export function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  /** If provided, only users whose role matches (one of) these are let through. */
  requiredRole?: UserRole | UserRole[];
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const allowedRoles = requiredRole ? (Array.isArray(requiredRole) ? requiredRole : [requiredRole]) : null;
  const roleMismatch = Boolean(allowedRoles && user && !allowedRoles.includes(user.role));

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (roleMismatch) {
      router.replace("/");
    }
  }, [isLoading, user, roleMismatch, router]);

  if (isLoading || !user || roleMismatch) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-foreground/50">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}

