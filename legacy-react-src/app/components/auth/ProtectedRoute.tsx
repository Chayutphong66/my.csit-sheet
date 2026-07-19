import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "./AuthContext";
import type { Role } from "../../services/auth.service";

interface Props {
  children: ReactNode;
  requiredRole?: Role;
}

/**
 * Wraps any route that needs authentication.
 * - If not logged in → redirects to /login, preserving the attempted URL.
 * - If logged in but wrong role → redirects to the correct dashboard.
 *
 * Role is read from the AuthContext (populated server-side via the JWT).
 * Client-side values are NEVER trusted for access decisions — this is the
 * first fence; the real enforcement happens on the backend.
 */
export function ProtectedRoute({ children, requiredRole }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Still bootstrapping (silent refresh in flight) — render nothing
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5EF] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#9FE870] border-t-transparent animate-spin" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Wrong role → redirect to the correct dashboard (privilege escalation prevention)
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={user.role === "ADMIN" ? "/admin" : "/dashboard"} replace />;
  }

  return <>{children}</>;
}
