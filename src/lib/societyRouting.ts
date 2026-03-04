import type { SocietyStatus } from "@/types/auth";

const routeByStatus: Record<SocietyStatus, string> = {
  CREATED: "/",
  RAZORPAY_PENDING: "/",
  ACTIVE: "/",
};

export const getRouteForSocietyStatus = (status: SocietyStatus) => {
  return routeByStatus[status];
};
