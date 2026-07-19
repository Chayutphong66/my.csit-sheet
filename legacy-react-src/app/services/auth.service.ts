/**
 * Auth Service — all real API calls go here.
 * Replace BASE_URL with your Express backend URL.
 * The backend handles: JWT signing, bcrypt/Argon2 hashing,
 * refresh-token rotation in HttpOnly cookies, and role assignment.
 */

export const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Role = "USER" | "ADMIN";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  isVerified: boolean;
  provider: "local" | "google" | "line";
}

export interface LoginCredentials {
  usernameOrEmail: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string; // short-lived JWT (15 min); stored in memory only
  // refreshToken arrives as HttpOnly cookie — never exposed to JS
}

// ─── In-memory token store (never localStorage — XSS protection) ─────────────

let _accessToken: string | null = null;

export function setAccessToken(t: string | null) { _accessToken = t; }
export function getAccessToken(): string | null   { return _accessToken; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (_accessToken) headers["Authorization"] = `Bearer ${_accessToken}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include", // sends HttpOnly refresh-token cookie automatically
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export async function apiLogin(creds: LoginCredentials): Promise<AuthResponse> {
  const data = await request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(creds),
  });
  setAccessToken(data.accessToken);
  return data;
}

export async function apiRegister(creds: RegisterCredentials): Promise<{ message: string }> {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify(creds),
  });
}

/** Silently refresh — called on app boot and before token expiry. */
export async function apiRefresh(): Promise<AuthResponse | null> {
  try {
    const data = await request<AuthResponse>("/auth/refresh", { method: "POST" });
    setAccessToken(data.accessToken);
    return data;
  } catch {
    setAccessToken(null);
    return null;
  }
}

/** Revokes the refresh token on the server, clearing the HttpOnly cookie. */
export async function apiLogout(): Promise<void> {
  await request("/auth/logout", { method: "POST" }).catch(() => null);
  setAccessToken(null);
}

/** Logout from every device (server revokes ALL refresh tokens for this user). */
export async function apiLogoutAll(): Promise<void> {
  await request("/auth/logout-all", { method: "POST" }).catch(() => null);
  setAccessToken(null);
}

// ─── OAuth redirect URLs (backend handles the OAuth flow) ────────────────────

export const GOOGLE_AUTH_URL = `${BASE_URL}/auth/google`;
export const LINE_AUTH_URL   = `${BASE_URL}/auth/line`;

// ─── User API ─────────────────────────────────────────────────────────────────

export async function apiGetMe(): Promise<AuthUser> {
  return request<AuthUser>("/users/me");
}

export interface Sheet {
  id: string;
  title: string;
  subject: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  downloadCount: number;
}

export async function apiGetMySheets(): Promise<Sheet[]> {
  return request<Sheet[]>("/sheets/mine");
}

// ─── Admin API ────────────────────────────────────────────────────────────────

export interface AdminSheet extends Sheet {
  uploaderUsername: string;
  uploaderEmail: string;
}

export async function apiGetPendingSheets(): Promise<AdminSheet[]> {
  return request<AdminSheet[]>("/admin/sheets/pending");
}

export async function apiApproveSheet(id: string): Promise<void> {
  await request(`/admin/sheets/${id}/approve`, { method: "PATCH" });
}

export async function apiRejectSheet(id: string, reason: string): Promise<void> {
  await request(`/admin/sheets/${id}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}

export interface PlatformStats {
  totalUsers: number;
  totalSheets: number;
  pendingCount: number;
  approvedCount: number;
}

export async function apiGetStats(): Promise<PlatformStats> {
  return request<PlatformStats>("/admin/stats");
}

// ─── Mock layer — remove once the real backend is running ────────────────────
// The mock honours the security model: role is determined server-side only.

const MOCK_USERS: Record<string, { user: AuthUser; password: string }> = {
  "admin@csitsheet.app": {
    password: "Admin@1234",
    user: { id: "1", username: "admin", email: "admin@csitsheet.app", role: "ADMIN", isVerified: true, provider: "local" },
  },
  "user@csitsheet.app": {
    password: "User@1234",
    user: { id: "2", username: "student01", email: "user@csitsheet.app", role: "USER",  isVerified: true, provider: "local" },
  },
};

const MOCK_SHEETS: Sheet[] = [
  { id: "s1", title: "Calculus II Summary", subject: "MATH201", status: "APPROVED",  createdAt: "2024-12-01", downloadCount: 42 },
  { id: "s2", title: "Data Structures Notes", subject: "CS301", status: "PENDING",  createdAt: "2025-01-10", downloadCount: 0  },
  { id: "s3", title: "Physics I Cheat Sheet", subject: "PHY101", status: "REJECTED", createdAt: "2025-01-05", downloadCount: 0  },
];

const MOCK_ADMIN_SHEETS: AdminSheet[] = [
  ...MOCK_SHEETS.map(s => ({ ...s, uploaderUsername: "student01", uploaderEmail: "user@csitsheet.app" })),
  { id: "s4", title: "Linear Algebra", subject: "MATH302", status: "PENDING", createdAt: "2025-01-15", downloadCount: 0, uploaderUsername: "student02", uploaderEmail: "s2@nu.ac.th" },
];

function mockToken(role: Role) {
  // Not a real JWT — just a placeholder so the interface is identical.
  return btoa(JSON.stringify({ sub: "mock", role, exp: Date.now() + 15 * 60_000 }));
}

export async function mockLogin(creds: LoginCredentials): Promise<AuthResponse> {
  await new Promise(r => setTimeout(r, 800));
  const entry = Object.values(MOCK_USERS).find(
    u => (u.user.email === creds.usernameOrEmail || u.user.username === creds.usernameOrEmail)
  );
  if (!entry || entry.password !== creds.password) {
    throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  }
  const token = mockToken(entry.user.role);
  setAccessToken(token);
  return { user: entry.user, accessToken: token };
}

export async function mockRegister(): Promise<{ message: string }> {
  await new Promise(r => setTimeout(r, 800));
  return { message: "สมัครสมาชิกสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี" };
}

export async function mockRefresh(): Promise<AuthResponse | null> {
  // In production this reads the HttpOnly cookie on the server.
  return null;
}

export async function mockGetMySheets(): Promise<Sheet[]> {
  await new Promise(r => setTimeout(r, 400));
  return MOCK_SHEETS;
}

export async function mockGetPendingSheets(): Promise<AdminSheet[]> {
  await new Promise(r => setTimeout(r, 400));
  return MOCK_ADMIN_SHEETS.filter(s => s.status === "PENDING");
}

export async function mockGetStats(): Promise<PlatformStats> {
  await new Promise(r => setTimeout(r, 300));
  return { totalUsers: 284, totalSheets: 391, pendingCount: 12, approvedCount: 347 };
}
