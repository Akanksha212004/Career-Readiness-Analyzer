import { AlertTriangle, EyeOff, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AtsIssue, HiddenTextWarning } from "@/lib/types";

const severityVariant = {
  high: "error",
  medium: "warning",
  low: "neutral",
} as const;

/** Prominent, distinct banner for concealed/invisible-text keyword stuffing.
 * Deliberately styled with --error tokens and separated from the regular
 * issue list below — this is a gaming-the-parser red flag, not an ordinary
 * formatting quibble, and should read as more serious at a glance. */
function HiddenTextBanner({ warning }: { warning: HiddenTextWarning }) {
  if (!warning.detected) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-error bg-error/10 p-4">
      <div className="flex items-start gap-3">
        <EyeOff className="h-5 w-5 shrink-0 text-error" />
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-error">⚠ Hidden text detected</p>
            <Badge variant="error">high risk</Badge>
          </div>
          <p className="text-sm text-foreground/80">
            This can get real resumes rejected by recruiters who manually inspect them — many
            ATS platforms now specifically scan for and penalize this trick too.
          </p>
        </div>
      </div>

      {warning.findings.length > 0 && (
        <ul className="flex flex-col gap-2 border-t border-error/20 pt-3">
          {warning.findings.map((finding, i) => (
            <li key={i} className="pl-8 text-sm text-foreground/70">
              <span className="font-medium text-foreground">{finding.detail}</span>
              {finding.sampleText && (
                <span className="block italic text-foreground/50">“{finding.sampleText}”</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AtsIssueList({
  atsFriendly,
  issues,
  hiddenTextWarning,
}: {
  atsFriendly: boolean;
  issues: AtsIssue[];
  hiddenTextWarning?: HiddenTextWarning;
}) {
  const showAllClear = atsFriendly && issues.length === 0 && !hiddenTextWarning?.detected;

  return (
    <div className="flex flex-col gap-3">
      {hiddenTextWarning && <HiddenTextBanner warning={hiddenTextWarning} />}

      {showAllClear ? (
        <div className="flex items-center gap-3 rounded-lg bg-accent/5 px-4 py-3 text-sm text-foreground">
          <ShieldCheck className="h-5 w-5 shrink-0 text-accent" />
          No formatting issues detected — this resume should parse cleanly through most ATS systems.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {issues.map((issue, i) => (
            <li key={i} className="flex gap-3 rounded-xl border border-border p-3.5 transition-colors hover:bg-surface/60">
              <AlertTriangle
                className={`h-5 w-5 shrink-0 ${
                  issue.severity === "high" ? "text-error" : issue.severity === "medium" ? "text-warning" : "text-foreground/40"
                }`}
              />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{issue.issue}</p>
                  <Badge variant={severityVariant[issue.severity]}>{issue.severity}</Badge>
                </div>
                <p className="text-sm text-foreground/60">{issue.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


