import type {
  AdminAnalysesFilters,
  AdminAnalysesPage,
  AdminAnalysisDetail,
  AnalysisResult,
  AnalysisStatus,
  CompanyMember,
  CompanySummary,
  CompanySubRole,
  DashboardStats,
  HistoryEntry,
  InviteInfo,
  InviteResult,
  JdQualityReport,
  MyInvite,
  Posting,
  PostingSkillGaps,
  PublicPosting,
  RoleListItem,
  SuperAdminRequest,
  User,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    // Sends the httpOnly auth cookie with every request, including
    // cross-origin ones between the frontend and backend dev servers.
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // response body wasn't JSON; keep default message
    }
    throw new ApiError(message, res.status);
  }
  return res.json();
}

export async function fetchRoles(): Promise<RoleListItem[]> {
  const data = await request<{ roles: RoleListItem[] }>("/api/roles");
  return data.roles;
}

export async function analyzeResume(params: {
  file: File;
  roleId?: string;
  jobDescription?: string;
  /** Selecting a posting analyzes AND applies in one action - see backend
   * Analysis.appliedToCompany. */
  postingId?: string;
}): Promise<AnalysisResult> {
  const form = new FormData();
  form.append("file", params.file);
  if (params.roleId) form.append("roleId", params.roleId);
  if (params.jobDescription) form.append("jobDescription", params.jobDescription);
  if (params.postingId) form.append("postingId", params.postingId);

  return request<AnalysisResult>("/api/analyze", {
    method: "POST",
    body: form,
  });
}

export async function fetchHistory(roleId?: string): Promise<HistoryEntry[]> {
  const params = new URLSearchParams();
  if (roleId) params.set("roleId", roleId);
  const query = params.toString();
  const data = await request<{ history: HistoryEntry[] }>(`/api/history${query ? `?${query}` : ""}`);
  return data.history;
}

export async function fetchAnalysisById(id: string): Promise<AnalysisResult> {
  return request<AnalysisResult>(`/api/analysis/${id}`);
}

/** hr/super_admin only - paginated, filterable list of analyses belonging
 * to the caller's company that students have explicitly applied with. */
export async function fetchAdminAnalyses(filters: AdminAnalysesFilters = {}): Promise<AdminAnalysesPage> {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.postingId) params.set("postingId", filters.postingId);
  if (filters.minScore !== undefined) params.set("minScore", String(filters.minScore));
  if (filters.maxScore !== undefined) params.set("maxScore", String(filters.maxScore));
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.order) params.set("order", filters.order);
  const query = params.toString();
  return request<AdminAnalysesPage>(`/api/admin/analyses${query ? `?${query}` : ""}`);
}

/** hr/super_admin only - full detail for one candidate's analysis, in the
 * same shape the student sees on their own dashboard. */
export async function fetchAdminAnalysisDetail(id: string): Promise<AdminAnalysisDetail> {
  return request<AdminAnalysisDetail>(`/api/admin/analyses/${id}`);
}

/** hr/super_admin only - company-scoped aggregate stats for the overview page. */
export async function fetchAdminDashboardStats(): Promise<DashboardStats> {
  return request<DashboardStats>("/api/admin/dashboard-stats");
}

/** hr/super_admin only - postings belonging to the caller's own company. */
export async function fetchMyPostings(): Promise<Posting[]> {
  const data = await request<{ postings: Posting[] }>("/api/postings");
  return data.postings;
}

/** hr/super_admin only - create a posting under the caller's own company. */
export async function createPosting(params: {
  title: string;
  requiredSkills: string[];
  seniority: string;
  jobDescription?: string;
  status?: string;
}): Promise<Posting> {
  const data = await request<{ posting: Posting }>("/api/postings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return data.posting;
}

/** hr/super_admin only - edit a posting belonging to the caller's own company. */
export async function updatePosting(
  id: string,
  params: Partial<{
    title: string;
    requiredSkills: string[];
    seniority: string;
    jobDescription: string;
    status: string;
  }>
): Promise<Posting> {
  const data = await request<{ posting: Posting }>(`/api/postings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return data.posting;
}

/** Any authenticated user (students browse this to pick a posting to apply
 * to) - only currently-open postings across all companies. */
export async function fetchPublicPostings(): Promise<PublicPosting[]> {
  const data = await request<{ postings: PublicPosting[] }>("/api/postings/public");
  return data.postings;
}

export async function registerUser(params: { name: string; email: string; password: string }): Promise<User> {
  const data = await request<{ user: User }>("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return data.user;
}

export async function loginUser(params: { email: string; password: string }): Promise<User> {
  const data = await request<{ user: User }>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return data.user;
}

export async function logoutUser(): Promise<void> {
  await request<{ success: boolean }>("/api/auth/logout", { method: "POST" });
}

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const data = await request<{ user: User }>("/api/auth/me");
    return data.user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

/** hr/super_admin only - moves a candidate to a new pipeline stage. */
export async function updateAnalysisStatus(id: string, status: AnalysisStatus): Promise<AnalysisResult> {
  return request<AnalysisResult>(`/api/admin/analyses/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

/** Signs up an HR user AND creates their company (starts 'pending' until a
 * super_admin approves it - see the /super-admin page). */
export async function registerCompany(params: {
  name: string;
  email: string;
  password: string;
  companyName: string;
  companyDomain: string;
}): Promise<{ user: User; company: CompanySummary }> {
  return request<{ user: User; company: CompanySummary }>("/api/auth/register-company", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

/** hr/super_admin only - the caller's own company profile + team roster. */
export async function fetchMyCompany(): Promise<{ company: CompanySummary; members: CompanyMember[] }> {
  return request<{ company: CompanySummary; members: CompanyMember[] }>("/api/companies/me");
}

/** hr_admin only (enforced server-side) - invites a teammate by email. No
 * email is actually sent; the returned inviteUrl must be shared manually. */
export async function inviteTeammate(
  companyId: string,
  params: { email: string; subRole: CompanySubRole }
): Promise<InviteResult> {
  const data = await request<{ invite: InviteResult }>(`/api/companies/${companyId}/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return data.invite;
}

/** Public - basic info about a pending invite, for the /join page. */
export async function fetchInviteInfo(token: string): Promise<InviteInfo> {
  return request<InviteInfo>(`/api/companies/invite/${encodeURIComponent(token)}`);
}

/** Public - accepts a team invite. Omit name/password if already logged in
 * with a matching email; both are required to create a brand-new account. */
export async function acceptInvite(params: { token: string; name?: string; password?: string }): Promise<User> {
  const data = await request<{ user: User }>("/api/companies/invite/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return data.user;
}

/** Any authenticated (existing) user - pending team invites addressed to
 * the caller's own account email, for the pending-invite banner. */
export async function fetchMyInvites(): Promise<MyInvite[]> {
  const data = await request<{ invites: MyInvite[] }>("/api/invites/me");
  return data.invites;
}

/** Any authenticated (existing) user - declines a pending invite addressed
 * to the caller's own account email. No role/company change happens. */
export async function declineInvite(token: string): Promise<void> {
  await request<{ success: boolean }>("/api/invites/decline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

/** super_admin only - lists companies, optionally filtered by status. */
export async function fetchSuperAdminCompanies(status?: "pending" | "approved" | "rejected"): Promise<CompanySummary[]> {
  const query = status ? `?status=${status}` : "";
  const data = await request<{ companies: CompanySummary[] }>(`/api/super-admin/companies${query}`);
  return data.companies;
}

/** super_admin only - approves a pending company, unlocking posting creation. */
export async function approveCompany(id: string): Promise<CompanySummary> {
  const data = await request<{ company: CompanySummary }>(`/api/super-admin/companies/${id}/approve`, {
    method: "PATCH",
  });
  return data.company;
}

/** super_admin only - rejects a pending company. */
export async function rejectCompany(id: string): Promise<CompanySummary> {
  const data = await request<{ company: CompanySummary }>(`/api/super-admin/companies/${id}/reject`, {
    method: "PATCH",
  });
  return data.company;
}

/** hr/super_admin only - advisory JD quality check for the posting form;
 * never blocks saving, purely informational. */
export async function checkJdQuality(params: { jobDescription: string; seniority?: string }): Promise<JdQualityReport> {
  return request<JdQualityReport>("/api/postings/jd-quality-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

/** hr/super_admin only - which skills this posting's candidates most
 * commonly fail to match, for the /admin/skill-insights page. */
export async function fetchPostingSkillGaps(postingId: string): Promise<PostingSkillGaps> {
  return request<PostingSkillGaps>(`/api/admin/postings/${postingId}/skill-gaps`);
}

/** hr only - submits a request to be promoted to super_admin. */
export async function submitSuperAdminRequest(params: { justification: string }): Promise<SuperAdminRequest> {
  const data = await request<{ request: SuperAdminRequest }>("/api/super-admin-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return data.request;
}

/** super_admin only - lists super admin requests, optionally filtered by status. */
export async function fetchSuperAdminRequests(
  status?: "pending" | "approved" | "rejected"
): Promise<SuperAdminRequest[]> {
  const query = status ? `?status=${status}` : "";
  const data = await request<{ requests: SuperAdminRequest[] }>(`/api/super-admin-requests${query}`);
  return data.requests;
}

/** super_admin only - approves a pending super admin request, promoting the requester. */
export async function approveSuperAdminRequest(id: string): Promise<SuperAdminRequest> {
  const data = await request<{ request: SuperAdminRequest }>(`/api/super-admin-requests/${id}/approve`, {
    method: "PATCH",
  });
  return data.request;
}

/** super_admin only - rejects a pending super admin request. */
export async function rejectSuperAdminRequest(id: string): Promise<SuperAdminRequest> {
  const data = await request<{ request: SuperAdminRequest }>(`/api/super-admin-requests/${id}/reject`, {
    method: "PATCH",
  });
  return data.request;
}

export { ApiError };

