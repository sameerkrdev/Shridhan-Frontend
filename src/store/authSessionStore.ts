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
  setAuthPayload: (payload: AuthResponse) => void;
  setMemberships: (memberships: MembershipSummary[]) => void;
  setSelectedMembership: (membership: MembershipSummary) => void;
  setResolvedSociety: (resolved: ResolveSocietyResponse) => void;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  setHydrated: (isHydrated: boolean) => void;
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
          };
        }),
      setMemberships: (memberships) => set({ memberships }),
      setSelectedMembership: (membership) => set({ selectedMembership: membership }),
      setResolvedSociety: (resolved) => {
        const matched = get().memberships.find((m) => m.societyId === resolved.societyId);
        const selectedMembership: MembershipSummary = matched ?? {
          membershipId: resolved.membershipId,
          societyId: resolved.societyId,
          role: resolved.role,
          roleId: resolved.roleId,
          permissions: resolved.permissions,
          status: resolved.status,
          societyName: resolved.societyName,
          subDomainName: resolved.subDomainName,
          societyStatus: resolved.societyStatus,
        };

        set({ selectedMembership });
      },
      setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
      setHydrated: (isHydrated) => set({ isHydrated }),
      clearSession: () => set({ ...initialState, isHydrated: true }),
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
