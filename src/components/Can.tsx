import type { ReactNode } from "react";
import { useAuthSessionStore } from "@/store/authSessionStore";

export const hasPermission = (
  permissions: string[] | undefined,
  action: string,
  societyId?: string,
): boolean => {
  if (!permissions?.length) return false;
  void societyId;
  return permissions.includes(action);
};

interface CanProps {
  action: string;
  resource?: string;
  societyId?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export const Can = ({ action, resource, societyId, children, fallback = null }: CanProps) => {
  const selectedMembership = useAuthSessionStore((s) => s.selectedMembership);
  const memberships = useAuthSessionStore((s) => s.memberships);
  const resolvedAction = resource ? `${resource}.${action}` : action;
  const membership = societyId
    ? memberships.find((item) => item.societyId === societyId)
    : selectedMembership;

  if (!hasPermission(membership?.permissions, resolvedAction, societyId)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
