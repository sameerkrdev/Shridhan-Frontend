import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AuthResponse,
  Member,
  ResolveSocietyResponse,
  RouteIntent,
  SocietySummary,
} from "@/types/auth";

interface AuthSessionState {
  member: Member | null;
  routeIntent: RouteIntent | null;
  societies: SocietySummary[];
  selectedSociety: SocietySummary | null;
  isAuthenticated: boolean;
  hadSession: boolean;
  isHydrated: boolean;
  setAuthPayload: (payload: AuthResponse) => void;
  setSocieties: (societies: SocietySummary[]) => void;
  setSelectedSociety: (society: SocietySummary) => void;
  setResolvedSociety: (resolved: ResolveSocietyResponse) => void;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  setHydrated: (isHydrated: boolean) => void;
  clearSession: () => void;
}

const initialState = {
  member: null,
  routeIntent: null,
  societies: [],
  selectedSociety: null,
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
          const selectedSociety =
            state.selectedSociety &&
            payload.societies.some((society) => society.societyId === state.selectedSociety?.societyId)
              ? state.selectedSociety
              : null;

          return {
            member: payload.member,
            routeIntent: payload.routeIntent,
            societies: payload.societies,
            selectedSociety,
            isAuthenticated: true,
            hadSession: true,
          };
        }),
      setSocieties: (societies) => set({ societies }),
      setSelectedSociety: (society) => set({ selectedSociety: society }),
      setResolvedSociety: (resolved) => {
        const matchedSociety = get().societies.find(
          (society) => society.societyId === resolved.societyId,
        );
        const selectedSociety: SocietySummary = matchedSociety ?? {
          memberId: resolved.memberId,
          societyId: resolved.societyId,
          role: resolved.role,
          societyName: resolved.societyName,
          subDomainName: resolved.subDomainName,
          status: resolved.status,
        };

        set({ selectedSociety });
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
        selectedSociety: state.selectedSociety,
        hadSession: state.hadSession,
      }),
    },
  ),
);
