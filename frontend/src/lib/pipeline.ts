import type { AnalysisStatus } from "./types";

export const PIPELINE_STATUSES: AnalysisStatus[] = ["new", "reviewed", "shortlisted", "rejected", "hired"];

export const PIPELINE_STATUS_META: Record<AnalysisStatus, { label: string; badgeVariant: "neutral" | "primary" | "success" | "warning" | "error" }> = {
  new: { label: "New", badgeVariant: "neutral" },
  reviewed: { label: "Reviewed", badgeVariant: "primary" },
  shortlisted: { label: "Shortlisted", badgeVariant: "warning" },
  rejected: { label: "Rejected", badgeVariant: "error" },
  hired: { label: "Hired", badgeVariant: "success" },
};

