import { useMutation, useQuery } from "@tanstack/react-query";
import {
  checkMemberExists,
  createSociety,
  fetchMemberSocieties,
  loginMember,
  logoutSession,
  refreshSession,
  resolveSelectedSociety,
  sendLoginOtp,
  sendSignupEmailOtp,
  sendSignupPhoneOtp,
  setupPermitRules,
  signupMember,
  verifyLoginOtp,
  verifySignupEmailOtp,
  verifySignupPhoneOtp,
} from "@/lib/authApi";

export const useSignupMutation = () => {
  return useMutation({
    mutationFn: signupMember,
  });
};

export const useLoginMutation = () => {
  return useMutation({
    mutationFn: loginMember,
  });
};

export const useCheckMemberExistsMutation = () => {
  return useMutation({
    mutationFn: checkMemberExists,
  });
};

export const useMemberSocietiesQuery = (enabled: boolean) => {
  return useQuery({
    queryKey: ["member-societies"],
    queryFn: fetchMemberSocieties,
    enabled,
  });
};

export const useResolveSelectedSocietyMutation = () => {
  return useMutation({
    mutationFn: resolveSelectedSociety,
  });
};

export const useCreateSocietyMutation = () => {
  return useMutation({
    mutationFn: createSociety,
  });
};

export const useRefreshSessionMutation = () => {
  return useMutation({
    mutationFn: refreshSession,
  });
};

export const useSetupPermitRulesMutation = () => {
  return useMutation({
    mutationFn: setupPermitRules,
  });
};

export const useLogoutMutation = () => {
  return useMutation({
    mutationFn: logoutSession,
  });
};

export const useSendLoginOtpMutation = () => {
  return useMutation({
    mutationFn: sendLoginOtp,
  });
};

export const useVerifyLoginOtpMutation = () => {
  return useMutation({
    mutationFn: verifyLoginOtp,
  });
};

export const useSendSignupPhoneOtpMutation = () => {
  return useMutation({
    mutationFn: sendSignupPhoneOtp,
  });
};

export const useVerifySignupPhoneOtpMutation = () => {
  return useMutation({
    mutationFn: verifySignupPhoneOtp,
  });
};

export const useSendSignupEmailOtpMutation = () => {
  return useMutation({
    mutationFn: sendSignupEmailOtp,
  });
};

export const useVerifySignupEmailOtpMutation = () => {
  return useMutation({
    mutationFn: verifySignupEmailOtp,
  });
};
