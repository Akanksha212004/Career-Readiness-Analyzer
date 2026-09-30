import { CheckCircle2, AlertTriangle, HelpCircle, XCircle, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { GithubRepoVerification } from "@/lib/types";

/** Maps each backend verification status to how it should read at a glance -
 * badge color/label plus icon. "rate_limited"/"unreachable" are deliberately
 * neutral, not warning: we simply couldn't confirm anything either way,
 * which isn't the same signal as a stale or missing repo. */
const STATUS_META: Record<
  GithubRepoVerification["status"],
  { badge: "success" | "warning" | "error" | "neutral"; label: string; icon: typeof CheckCircle2 }
> = {
  active: { badge: "success", label: "Verified", icon: CheckCircle2 },
  stale: { badge: "warning", label: "Inactive", icon: AlertTriangle },
  not_found: { badge: "error", label: "Not found", icon: XCircle },
  rate_limited: { badge: "neutral", label: "Unverified", icon: HelpCircle },
  unreachable: { badge: "neutral", label: "Unverified", icon: HelpCircle },
};

export function GithubVerificationList({
  verifications,
}: {
  verifications: GithubRepoVerification[];
}) {
  if (verifications.length === 0) return null;

  return (
    <ul className="flex flex-col gap-3">
      {verifications.map((v) => {
        const meta = STATUS_META[v.status];
        const Icon = meta.icon;
        return (
          <li
            key={v.url}
            className="flex gap-3 rounded-xl border border-border p-3.5 transition-colors hover:bg-surface/60"
          >
            <Icon
              className={`h-5 w-5 shrink-0 ${
                meta.badge === "success"
                  ? "text-accent"
                  : meta.badge === "warning"
                  ? "text-warning"
                  : meta.badge === "error"
                  ? "text-error"
                  : "text-foreground/40"
              }`}
            />
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <GitBranch className="h-3.5 w-3.5 text-foreground/40" />
                <a
                  href={v.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-foreground hover:underline"
                >
                  {v.owner}/{v.repo}
                </a>
                <Badge variant={meta.badge}>{meta.label}</Badge>
                {v.stargazersCount != null && v.stargazersCount > 0 && (
                  <span className="text-xs text-foreground/40">★ {v.stargazersCount}</span>
                )}
              </div>
              <p className="text-sm text-foreground/60">{v.note}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
