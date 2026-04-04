export type RouteIntent = "CREATE_NEW_SOCIETY" | "SOCIETY_SELECTOR";

export type SocietyStatus = "CREATED" | "RAZORPAY_PENDING" | "ACTIVE";

export type MembershipRole = string;
export type MembershipStatus = "active" | "suspended";

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatar: string | null;
}

export interface MembershipSummary {
  membershipId: string;
  societyId: string;
  role: MembershipRole;
  roleId: string;
  permissions: string[];
  status: MembershipStatus;
  societyName: string;
  societyStatus: SocietyStatus;
}

export interface AuthResponse {
  user: User;
  routeIntent: RouteIntent;
  memberships: MembershipSummary[];
}

export interface RefreshSessionResponse {
  success: boolean;
}

export interface ResolveSocietyResponse {
  membershipId: string;
  societyId: string;
  societyName: string;
  societyStatus: SocietyStatus;
  role: MembershipRole;
  roleId: string;
  permissions: string[];
  status: MembershipStatus;
  nextRoute: string;
}
