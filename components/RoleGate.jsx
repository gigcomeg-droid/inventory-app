'use client';

import { useAuth, roleAtLeast } from '@/components/AuthContext';

/**
 * Conditionally renders children based on the current user's role.
 *
 * Usage:
 *   <RoleGate allow={['ADMIN']}>...</RoleGate>            // exact role(s)
 *   <RoleGate min="MANAGER">...</RoleGate>                 // role hierarchy
 *   <RoleGate min="MANAGER" fallback={<p>No access</p>}>...</RoleGate>
 *
 * This is a visual/UX convenience only — the server enforces the real
 * permission checks.
 */
export default function RoleGate({ allow, min, role: roleOverride, fallback = null, children }) {
  const { user } = useAuth();
  const role = roleOverride || user?.role;

  if (!role) return fallback;

  let permitted = true;
  if (Array.isArray(allow) && allow.length > 0) {
    permitted = allow.includes(role);
  } else if (min) {
    permitted = roleAtLeast(role, min);
  }

  return permitted ? children : fallback;
}
