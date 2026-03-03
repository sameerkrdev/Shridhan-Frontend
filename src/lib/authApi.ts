import { apiClient } from "@/lib/apiClient";
import type {
  AuthResponse,
  RefreshSessionResponse,
  ResolveSocietyResponse,
  MembershipSummary,
} from "@/types/auth";

interface SignupPayload {
  name: string;
  phone: string;
  email: string;
}

interface LoginPayload {
  phone: string;
}

interface UserExistsPayload {
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

export const signupUser = async (payload: SignupPayload) => {
  const { data } = await apiClient.post<AuthResponse>("/members/signup", payload);
  return data;
};

export const loginUser = async (payload: LoginPayload) => {
  const { data } = await apiClient.post<AuthResponse>("/members/login", payload);
  return data;
};

export const checkUserExists = async (payload: UserExistsPayload) => {
  const { data } = await apiClient.post<{ exists: boolean }>("/members/exists", payload);
  return data.exists;
};

export const fetchMemberSocieties = async () => {
  const { data } = await apiClient.get<{ memberships: MembershipSummary[] }>(
    "/societies/member-societies",
  );
  return data.memberships;
};

export const resolveSelectedSociety = async (societyId: string) => {
  const { data } = await apiClient.post<ResolveSocietyResponse>(
    "/societies/member-societies/resolve",
    { societyId },
  );
  return data;
};

export const createSociety = async (payload: CreateSocietyPayload) => {
  const { data } = await apiClient.post<{
    society: {
      id: string;
      name: string;
      subDomainName: string;
      status: "CREATED" | "RAZORPAY_PENDING" | "ACTIVE";
    };
    membership: {
      id: string;
      roleId: string;
      status: "active" | "suspended";
      role: { id: string; name: string; permissions: string[] };
    };
  }>("/societies", payload);
  return data;
};

export const setupPermitRules = async (societyId: string) => {
  const { data } = await apiClient.post<{
    societyId: string;
    status: "CREATED" | "RAZORPAY_PENDING" | "ACTIVE";
    nextRoute: string;
  }>("/societies/permit/setup", { societyId });
  return data;
};

export const setupSubscription = async (societyId: string) => {
  const { data } = await apiClient.post<{
    keyId: string;
    razorpaySubscriptionId: string;
    razorpayCustomerId: string;
    status: string;
  }>("/societies/subscription/setup", { societyId });
  return data;
};

export const createSetupFeeLink = async (societyId: string) => {
  const { data } = await apiClient.post<{
    setupFeeWaived: boolean;
    setupFeePaid: boolean;
    paymentLinkUrl: string | null;
    paymentLinkId?: string;
    amount: string;
    currency: string;
  }>("/societies/setup-fee/link", { societyId });
  return data;
};

export const fetchSocietyBillingOverview = async (societyId: string) => {
  const { data } = await apiClient.get<{
    society: { id: string; name: string };
    trial: { endAt: string | null; daysRemaining: number | null; isActive: boolean };
    setupFee: {
      enabled: boolean;
      amount: string;
      paid: boolean;
      paidAt: string | null;
      dueAt: string | null;
      paymentId: string | null;
      paymentLinkUrl: string | null;
      waived: boolean;
    };
    override: { enabled: boolean };
    subscription: {
      status: string;
      mandateStatus: string;
      isInGrace: boolean;
      graceEndDate: string | null;
      nextBillingAt: string;
      previousBillingAt: string | null;
      razorpaySubId: string;
    } | null;
    transactions: Array<{
      id: string;
      amount: string;
      status: string;
      isPaid: boolean;
      billingDate: string;
      paymentDate: string | null;
      paymentMethod: string | null;
      paymentCycleCount: number;
      razorpayPaymentId: string | null;
    }>;
  }>(`/societies/billing/${societyId}`);
  return data;
};

export const refreshSession = async () => {
  const { data } = await apiClient.post<RefreshSessionResponse>("/members/refresh", {});
  return data;
};

export const fetchSession = async () => {
  const { data } = await apiClient.get<AuthResponse>("/members/session");
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
