/**
 * ProtectedRoute.tsx
 *
 * Guards any route that requires authentication.
 *
 * Usage — as a wrapper element:
 *   <Route path="/dashboard" element={
 *     <ProtectedRoute><Dashboard /></ProtectedRoute>
 *   } />
 *
 * Usage — as a layout route (wraps an <Outlet>):
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/dashboard" element={<Dashboard />} />
 *   </Route>
 *
 * Behaviour:
 *   loading  → centered loading indicator (starfield stays visible)
 *   no user  → <Navigate to="/login" replace state={{ from: current path+search }} />
 *   user ok  → renders children (or <Outlet /> when used as a layout route)
 */

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  /** When used as a wrapper, pass children. Omit when used as a layout route. */
  children?: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location          = useLocation();

  // ── Still resolving auth state ─────────────────────────────────────────────
  // Never show a blank screen — render the loading indicator over the starfield
  // background (which is fixed in the DOM by StarfieldBackground rendered by
  // AppLayout, so it is already visible behind this).
  if (loading) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4"
        role="status"
        aria-live="polite"
        aria-label="Loading"
      >
        {/* Pulsing ring that matches the constellation aesthetic */}
        <div className="relative flex items-center justify-center">
          <span
            className="absolute inline-block rounded-full border border-gold/40 animate-ping"
            style={{ width: 48, height: 48 }}
            aria-hidden="true"
          />
          <Loader2
            size={24}
            className="animate-spin text-gold drop-shadow-[0_0_6px_#FFD36E99]"
            aria-hidden="true"
          />
        </div>
        <p className="text-sm text-textMuted select-none">Loading…</p>
      </div>
    );
  }

  // ── Not authenticated ──────────────────────────────────────────────────────
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  // ── Authenticated ──────────────────────────────────────────────────────────
  // Support both patterns:
  //   <ProtectedRoute><SomePage /></ProtectedRoute>   → render children
  //   <Route element={<ProtectedRoute />}>…           → render <Outlet />
  return <>{children ?? <Outlet />}</>;
}
