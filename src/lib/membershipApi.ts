import { apiClient } from "@/lib/apiClient";
import type { MembershipStatus, User } from "@/types/auth";

export interface MembershipWithUser {
  id: string;
  userId: string;
  societyId: string;
  roleId: string;
  role: {
    id: string;
    name: string;
    permissions: string[];
    isSystem: boolean;
  };
  status: MembershipStatus;
  joinedAt: string;
  deletedAt?: string | null;
  user: User;
}

export interface SearchUserResult {
  found: boolean;
  user?: User;
}

export interface SocietyCustomRole {
  id: string;
  societyId: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
  createdAt: string;
}

export interface RolePermissionMatrixRole {
  id: string;
  key: string;
  name: string;
  source: "db";
  editable: boolean;
  permissions: string[];
  assignmentCount: number;
}

export interface PermissionResourceMeta {
  key: string;
  label: string;
  description: string;
}

export interface PermissionMeta {
  key: string;
  resource: string;
  action: string;
  label: string;
  description: string;
}

export interface RolePermissionMatrix {
  permissionKeys: string[];
  permissionCatalog?: {
    resources: PermissionResourceMeta[];
    permissions: PermissionMeta[];
  };
  roles: RolePermissionMatrixRole[];
}

export interface AssignableRoleOption {
  id: string;
  key: string;
  name: string;
  type: "base" | "custom";
}

export interface AssignableRoleOptionsResponse {
  baseRoles: AssignableRoleOption[];
  customRoles: AssignableRoleOption[];
}

export interface UserMembershipProfile {
  membershipId: string;
  societyId: string;
  societyName: string;
  roleId: string;
  role: string;
  status: MembershipStatus;
  joinedAt: string;
  canLeave?: boolean;
}

export const searchUser = async (query: string) => {
  const { data } = await apiClient.post<SearchUserResult>(
    "/memberships/search-user",
    { query },
  );
  return data;
};

export const addMember = async (
  _societyId: string,
  payload: {
    userId?: string;
    emailOrPhone?: string;
    name?: string;
    email?: string;
    phone?: string;
    phoneOtp?: string;
    emailOtp?: string;
    roleId: string;
  },
) => {
  const { data } = await apiClient.post<MembershipWithUser>(
    "/memberships",
    payload,
  );
  return data;
};

export const updateMemberContact = async (
  _societyId: string,
  membershipId: string,
  payload: {
    phone?: string;
    email?: string;
    phoneOtp?: string;
    emailOtp?: string;
  },
) => {
  const { data } = await apiClient.patch<MembershipWithUser>(`/memberships/${membershipId}/contact`, payload);
  return data;
};

export const sendMemberPhoneOtp = async (phone: string) => {
  const { data } = await apiClient.post<{ message: string }>("/otp/phone/send", {
    phone,
    reason: "verify-phone",
  });
  return data;
};

export const verifyMemberPhoneOtp = async (phone: string, otp: string) => {
  const { data } = await apiClient.post<{ message: string }>("/otp/phone/verify", {
    phone,
    otp,
    reason: "verify-phone",
  });
  return data;
};

export const sendMemberEmailOtp = async (email: string) => {
  const { data } = await apiClient.post<{ message: string }>("/otp/email/send", {
    email,
    reason: "verify-email",
  });
  return data;
};

export const verifyMemberEmailOtp = async (email: string, otp: string) => {
  const { data } = await apiClient.post<{ message: string }>("/otp/email/verify", {
    email,
    otp,
    reason: "verify-email",
  });
  return data;
};

export const listMembers = async (_societyId: string, includeDeleted = false) => {
  const { data } = await apiClient.get<{ members: MembershipWithUser[] }>(
    "/memberships",
    {
      params: { includeDeleted: includeDeleted ? "true" : "false" },
    },
  );
  return data.members;
};

export const getMemberDetail = async (_societyId: string, membershipId: string) => {
  const { data } = await apiClient.get<MembershipWithUser>(`/memberships/${membershipId}`);
  return data;
};

export const updateMemberRole = async (
  _societyId: string,
  membershipId: string,
  roleId: string,
) => {
  const { data } = await apiClient.patch<MembershipWithUser>(
    `/memberships/${membershipId}/role`,
    { roleId },
  );
  return data;
};

export const updateMemberStatus = async (
  _societyId: string,
  membershipId: string,
  status: MembershipStatus,
) => {
  const { data } = await apiClient.patch<MembershipWithUser>(
    `/memberships/${membershipId}/status`,
    { status },
  );
  return data;
};

export const removeMember = async (_societyId: string, membershipId: string) => {
  const { data } = await apiClient.delete<{ success: boolean }>(`/memberships/${membershipId}`);
  return data;
};

export const getUserProfile = async () => {
  const { data } = await apiClient.get<User>("/users/me");
  return data;
};

export const updateUserProfile = async (payload: {
  name?: string;
  phone?: string;
  avatar?: string;
}) => {
  const { data } = await apiClient.patch<User>("/users/me", payload);
  return data;
};

export const getMyMemberships = async () => {
  const { data } = await apiClient.get<{ memberships: UserMembershipProfile[] }>("/users/me/memberships");
  return data.memberships;
};

export const leaveCurrentSociety = async (_societyId: string) => {
  void _societyId;
  const { data } = await apiClient.delete<{ success: boolean }>("/memberships/me");
  return data;
};

export const listCustomRoles = async (_societyId: string) => {
  void _societyId;
  const { data } = await apiClient.get<{ roles: SocietyCustomRole[] }>(
    "/memberships/custom-roles",
  );
  return data.roles;
};

export const createCustomRole = async (
  _societyId: string,
  payload: { name: string; permissions: string[] },
) => {
  const { data } = await apiClient.post<SocietyCustomRole>(
    "/memberships/custom-roles",
    payload,
  );
  return data;
};

export const getRolePermissionMatrix = async (_societyId: string) => {
  void _societyId;
  const { data } = await apiClient.get<RolePermissionMatrix>(
    "/memberships/custom-roles/matrix",
  );
  return data;
};

export const updateMatrixRolePermissions = async (
  _societyId: string,
  roleKey: string,
  permissions: string[],
) => {
  const { data } = await apiClient.patch<{ key: string; permissions: string[] }>(
    `/memberships/custom-roles/matrix/${encodeURIComponent(roleKey)}/permissions`,
    { permissions },
  );
  return data;
};

export const getAssignableRoleOptions = async (_societyId: string) => {
  void _societyId;
  const { data } = await apiClient.get<AssignableRoleOptionsResponse>(
    "/memberships/role-options",
  );
  return data;
};
