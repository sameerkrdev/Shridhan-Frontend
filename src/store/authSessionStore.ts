import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AuthResponse,
  User,
  ResolveSocietyResponse,
  RouteIntent,
  MembershipSummary,
} from "@/types/auth";

interface AuthSessionState {
  user: User | null;
  routeIntent: RouteIntent | null;
  memberships: MembershipSummary[];
  selectedMembership: MembershipSummary | null;
  isAuthenticated: boolean;
  hadSession: boolean;
  isHydrated: boolean;
  hasRestoredSession: boolean;
  setAuthPayload: (payload: AuthResponse) => void;
  setMemberships: (memberships: MembershipSummary[]) => void;
  setSelectedMembership: (membership: MembershipSummary) => void;
  setResolvedSociety: (resolved: ResolveSocietyResponse) => void;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  setHydrated: (isHydrated: boolean) => void;
  setHasRestoredSession: (hasRestoredSession: boolean) => void;
  clearSession: () => void;
}

const initialState = {
  user: null,
  routeIntent: null,
  memberships: [],
  selectedMembership: null,
  isAuthenticated: false,
  hadSession: false,
  isHydrated: false,
  hasRestoredSession: false,
};

const upsertMembership = (
  memberships: MembershipSummary[],
  membership: MembershipSummary,
): MembershipSummary[] => {
  const existingIndex = memberships.findIndex((m) => m.societyId === membership.societyId);
  if (existingIndex === -1) {
    return [...memberships, membership];
  }

  return memberships.map((m, index) => (index === existingIndex ? membership : m));
};

export const useAuthSessionStore = create<AuthSessionState>()(
  persist(
    (set, get) => ({
      ...initialState,
      setAuthPayload: (payload) =>
        set((state) => {
          const selectedMembership =
            state.selectedMembership &&
            payload.memberships.some((m) => m.societyId === state.selectedMembership?.societyId)
              ? state.selectedMembership
              : null;

          return {
            user: payload.user,
            routeIntent: payload.routeIntent,
            memberships: payload.memberships,
            selectedMembership,
            isAuthenticated: true,
            hadSession: true,
            hasRestoredSession: true,
          };
        }),
      setMemberships: (memberships) => set({ memberships }),
      setSelectedMembership: (membership) =>
        set((state) => ({
          selectedMembership: membership,
          memberships: upsertMembership(state.memberships, membership),
        })),
      setResolvedSociety: (resolved) => {
        // Always apply the resolve response (fresh role + permissions from API). Previously we reused a
        // cached membership from `memberships` when present, which dropped updated permissions until
        // the user logged in again — e.g. new keys like `fixed_deposit.request_early_payout`.
        const selectedMembership: MembershipSummary = {
          membershipId: resolved.membershipId,
          societyId: resolved.societyId,
          role: resolved.role,
          roleId: resolved.roleId,
          permissions: resolved.permissions,
          status: resolved.status,
          societyName: resolved.societyName,
          societyStatus: resolved.societyStatus,
        };

        set((state) => ({
          selectedMembership,
          memberships: upsertMembership(state.memberships, selectedMembership),
        }));
      },
      setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
      setHydrated: (isHydrated) => set({ isHydrated }),
      setHasRestoredSession: (hasRestoredSession) => set({ hasRestoredSession }),
      clearSession: () => set({ ...initialState, isHydrated: true, hasRestoredSession: true }),
    }),
    {
      name: "auth-session-store",
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
      partialize: (state) => ({
        hadSession: state.hadSession,
      }),
    },
  ),
);
