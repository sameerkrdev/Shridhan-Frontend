import type { SocietyStatus } from "@/types/auth";

const routeByStatus: Record<SocietyStatus, string> = {
  CREATED: "/onboarding/permit",
  PERMIT_PENDING: "/onboarding/permit",
  RAZORPAY_PENDING: "/onboarding/razorpay",
  ACTIVE: "/",
};

export const getRouteForSocietyStatus = (status: SocietyStatus) => {
  return routeByStatus[status];
};
