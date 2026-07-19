import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  type AuthUser,
  type LoginCredentials,
  type RegisterCredentials,
  mockLogin,
  mockRegister,
  mockRefresh,
  apiLogout,
  apiLogoutAll,
  setAccessToken,
} from "../../services/auth.service";

// ─── Context types ────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  loginAttempts: number;
  login: (creds: LoginCredentials) => Promise<AuthUser>;
  register: (creds: RegisterCredentials) => Promise<{ message: string }>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 5 * 60 * 1_000; // 5 min brute-force lockout (client-side; backend enforces too)
const REFRESH_INTERVAL_MS = 12 * 60 * 1_000; // refresh access token every 12 min

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]           = useState<AuthUser | null>(null);
  const [loading, setLoading]     = useState(true);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const lockedUntilRef = useRef<number>(0);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // On mount: attempt silent refresh (reads HttpOnly cookie via backend)
  useEffect(() => {
    (async () => {
      // In production: const data = await apiRefresh();
      const data = await mockRefresh();
      if (data) setUser(data.user);
      setLoading(false);
    })();
  }, []);

  // Proactive token refresh
  function scheduleRefresh() {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    refreshTimerRef.current = setInterval(async () => {
      // const data = await apiRefresh();
      const data = await mockRefresh();
      if (!data) { setUser(null); clearInterval(refreshTimerRef.current!); }
    }, REFRESH_INTERVAL_MS);
  }

  async function login(creds: LoginCredentials): Promise<AuthUser> {
    // Client-side brute-force throttle (backend rate-limits too)
    if (Date.now() < lockedUntilRef.current) {
      const secsLeft = Math.ceil((lockedUntilRef.current - Date.now()) / 1000);
      throw new Error(`บัญชีถูกล็อกชั่วคราว กรุณารอ ${secsLeft} วินาที`);
    }
    try {
      // In production: const data = await apiLogin(creds);
      const data = await mockLogin(creds);
      setUser(data.user);
      setLoginAttempts(0);
      lockedUntilRef.current = 0;
      scheduleRefresh();
      return data.user;
    } catch (err) {
      const next = loginAttempts + 1;
      setLoginAttempts(next);
      if (next >= MAX_ATTEMPTS) {
        lockedUntilRef.current = Date.now() + LOCK_DURATION_MS;
        setLoginAttempts(0);
      }
      throw err;
    }
  }

  async function register(creds: RegisterCredentials): Promise<{ message: string }> {
    // In production: return apiRegister(creds);
    return mockRegister();
  }

  async function logout(): Promise<void> {
    await apiLogout().catch(() => null);
    setAccessToken(null);
    setUser(null);
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
  }

  async function logoutAll(): Promise<void> {
    await apiLogoutAll().catch(() => null);
    setAccessToken(null);
    setUser(null);
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginAttempts, login, register, logout, logoutAll }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
