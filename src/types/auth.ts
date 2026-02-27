export type RouteIntent = "CREATE_NEW_SOCIETY" | "SOCIETY_SELECTOR";

export type SocietyStatus = "CREATED" | "PERMIT_PENDING" | "RAZORPAY_PENDING" | "ACTIVE";

export interface Member {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  societyId: string | null;
}

export interface SocietySummary {
  memberId: string;
  societyId: string;
  role: string;
  societyName: string;
  subDomainName: string;
  status: SocietyStatus;
}

export interface AuthResponse {
  member: Member;
  accessToken: string;
  refreshToken: string;
  routeIntent: RouteIntent;
  societies: SocietySummary[];
}

export interface ResolveSocietyResponse {
  memberId: string;
  societyId: string;
  societyName: string;
  subDomainName: string;
  status: SocietyStatus;
  role: string;
  nextRoute: string;
}
