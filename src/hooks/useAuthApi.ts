import { useMutation, useQuery } from "@tanstack/react-query";
import {
  cancelSubscription,
  checkUserExists,
  createSociety,
  fetchSocietyBillingOverview,
  fetchMemberSocieties,
  loginUser,
  logoutSession,
  refreshSession,
  resolveSelectedSociety,
  sendLoginOtp,
  sendSignupEmailOtp,
  sendSignupPhoneOtp,
  setupSubscription,
  signupUser,
  verifyLoginOtp,
  verifySignupEmailOtp,
  verifySignupPhoneOtp,
} from "@/lib/authApi";

export const useSignupMutation = () => {
  return useMutation({ mutationFn: signupUser });
};

export const useLoginMutation = () => {
  return useMutation({ mutationFn: loginUser });
};

export const useCheckUserExistsMutation = () => {
  return useMutation({ mutationFn: checkUserExists });
};

export const useMemberSocietiesQuery = (enabled: boolean) => {
  return useQuery({
    queryKey: ["member-societies"],
    queryFn: fetchMemberSocieties,
    enabled,
  });
};

export const useResolveSelectedSocietyMutation = () => {
  return useMutation({ mutationFn: resolveSelectedSociety });
};

export const useCreateSocietyMutation = () => {
  return useMutation({ mutationFn: createSociety });
};

export const useRefreshSessionMutation = () => {
  return useMutation({ mutationFn: refreshSession });
};

export const useSetupSubscriptionMutation = () => {
  return useMutation({ mutationFn: setupSubscription });
};

export const useCancelSubscriptionMutation = () => {
  return useMutation({
    mutationFn: ({ societyId, refundLatestPayment }: { societyId: string; refundLatestPayment?: boolean }) =>
      cancelSubscription(societyId, refundLatestPayment ?? true),
  });
};

export const useSocietyBillingOverviewQuery = (societyId: string | null, enabled: boolean) => {
  return useQuery({
    queryKey: ["society-billing-overview", societyId],
    queryFn: () => fetchSocietyBillingOverview(societyId!),
    enabled: enabled && Boolean(societyId),
    staleTime: 60 * 1000,
  });
};

export const useLogoutMutation = () => {
  return useMutation({ mutationFn: logoutSession });
};

export const useSendLoginOtpMutation = () => {
  return useMutation({ mutationFn: sendLoginOtp });
};

export const useVerifyLoginOtpMutation = () => {
  return useMutation({ mutationFn: verifyLoginOtp });
};

export const useSendSignupPhoneOtpMutation = () => {
  return useMutation({ mutationFn: sendSignupPhoneOtp });
};

export const useVerifySignupPhoneOtpMutation = () => {
  return useMutation({ mutationFn: verifySignupPhoneOtp });
};

export const useSendSignupEmailOtpMutation = () => {
  return useMutation({ mutationFn: sendSignupEmailOtp });
};

export const useVerifySignupEmailOtpMutation = () => {
  return useMutation({ mutationFn: verifySignupEmailOtp });
};
