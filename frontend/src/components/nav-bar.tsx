"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Sprout, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-provider";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

  const links =
    user?.role === "super_admin"
      ? [{ href: "/super-admin", label: "Company Approvals" }]
      : user?.role === "hr"
        ? [
            { href: "/admin", label: "Overview" },
            { href: "/admin/postings", label: "Postings" },
            { href: "/admin/candidates", label: "Candidates" },
            { href: "/admin/skill-insights", label: "Skill Insights" },
            { href: "/admin/team", label: "Team" },
          ]
        : [
            { href: "/", label: "Analyze" },
            { href: "/history", label: "My Progress" },
          ];

  // Picks the most specific matching link (e.g. on /admin/candidates/123,
  // highlight "Candidates" rather than also lighting up "Overview").
  const activeHref = links
    .filter((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
            <Sprout className="h-4.5 w-4.5" />
          </span>
          <span className="font-heading text-base font-semibold text-foreground">Career Readiness Analyzer</span>
        </Link>

        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  link.href === activeHref ? "bg-primary/10 text-primary" : "text-foreground/60 hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="h-6 w-px bg-border" />

          <ThemeToggle />

          <div className="h-6 w-px bg-border" />

          {isLoading ? null : user ? (
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-medium text-foreground/70">{user.name}</span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5">
                <LogOut className="h-3.5 w-3.5" /> Log out
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="rounded-lg px-3.5 py-2 text-sm font-medium text-foreground/60 hover:text-foreground">
                Log in
              </Link>
              <Button asChild size="sm">
                <Link href="/signup">Sign up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

