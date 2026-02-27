import { apiClient } from "@/lib/apiClient";
import type { AuthResponse, ResolveSocietyResponse, SocietySummary } from "@/types/auth";

interface SignupPayload {
  name: string;
  phone: string;
  email: string;
  role: string;
}

interface LoginPayload {
  phone: string;
}

interface MemberExistsPayload {
  phone: string;
}

interface CreateSocietyPayload {
  name: string;
  subDomainName: string;
  country: string;
  state: string;
  city: string;
  zipcode: string;
  logoUrl: string;
}

interface LoginOtpPayload {
  phone: string;
  otp: string;
}

interface PhoneOtpPayload {
  phone: string;
}

interface VerifyPhoneOtpPayload {
  phone: string;
  otp: string;
}

interface EmailOtpPayload {
  email: string;
}

interface VerifyEmailOtpPayload {
  email: string;
  otp: string;
}

export const signupMember = async (payload: SignupPayload) => {
  const { data } = await apiClient.post<AuthResponse>("/members/signup", payload);
  return data;
};

export const loginMember = async (payload: LoginPayload) => {
  const { data } = await apiClient.post<AuthResponse>("/members/login", payload);
  return data;
};

export const checkMemberExists = async (payload: MemberExistsPayload) => {
  const { data } = await apiClient.post<{ exists: boolean }>("/members/exists", payload);
  return data.exists;
};

export const fetchMemberSocieties = async () => {
  const { data } = await apiClient.get<{ societies: SocietySummary[] }>(
    "/societies/member-societies",
  );
  return data.societies;
};

export const resolveSelectedSociety = async (societyId: string) => {
  const { data } = await apiClient.post<ResolveSocietyResponse>(
    "/societies/member-societies/resolve",
    {
      societyId,
    },
  );
  return data;
};

export const createSociety = async (payload: CreateSocietyPayload) => {
  const { data } = await apiClient.post<{
    society: {
      id: string;
      name: string;
      subDomainName: string;
      status: "CREATED" | "PERMIT_PENDING" | "RAZORPAY_PENDING" | "ACTIVE";
    };
    membership: {
      id: string;
      role: string;
    };
  }>("/societies", payload);

  return data;
};

export const setupPermitRules = async (societyId: string) => {
  const { data } = await apiClient.post<{
    societyId: string;
    status: "CREATED" | "PERMIT_PENDING" | "RAZORPAY_PENDING" | "ACTIVE";
    nextRoute: string;
  }>("/societies/permit/setup", { societyId });
  return data;
};

export const refreshSession = async () => {
  const { data } = await apiClient.post<AuthResponse>("/members/refresh", {});
  return data;
};

export const logoutSession = async () => {
  const { data } = await apiClient.post<{ success: boolean }>("/members/logout", {});
  return data;
};

export const sendLoginOtp = async ({ phone }: PhoneOtpPayload) => {
  const { data } = await apiClient.post<{ message: string }>("/otp/phone/send", {
    phone,
    reason: "login",
  });
  return data;
};

export const verifyLoginOtp = async ({ phone, otp }: LoginOtpPayload) => {
  const { data } = await apiClient.post<{ message: string }>("/otp/phone/verify", {
    phone,
    otp,
    reason: "login",
  });
  return data;
};

export const sendSignupPhoneOtp = async ({ phone }: PhoneOtpPayload) => {
  const { data } = await apiClient.post<{ message: string }>("/otp/phone/send", {
    phone,
    reason: "verify-phone",
  });
  return data;
};

export const verifySignupPhoneOtp = async ({ phone, otp }: VerifyPhoneOtpPayload) => {
  const { data } = await apiClient.post<{ message: string }>("/otp/phone/verify", {
    phone,
    otp,
    reason: "verify-phone",
  });
  return data;
};

export const sendSignupEmailOtp = async ({ email }: EmailOtpPayload) => {
  const { data } = await apiClient.post<{ message: string }>("/otp/email/send", {
    email,
    reason: "verify-email",
  });
  return data;
};

export const verifySignupEmailOtp = async ({ email, otp }: VerifyEmailOtpPayload) => {
  const { data } = await apiClient.post<{ message: string }>("/otp/email/verify", {
    email,
    otp,
    reason: "verify-email",
  });
  return data;
};
