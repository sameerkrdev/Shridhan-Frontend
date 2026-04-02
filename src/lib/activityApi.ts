import { apiClient } from "@/lib/apiClient";

export type ActivityEntityType =
  | "FD_PROJECT_TYPE"
  | "MIS_PROJECT_TYPE"
  | "RD_PROJECT_TYPE"
  | "FD_ACCOUNT"
  | "MIS_ACCOUNT"
  | "RD_ACCOUNT";

export interface ActivityItem {
  id: string;
  entityType: ActivityEntityType;
  entityId: string;
  actionType: string;
  actorName: string;
  actorPhone: string;
  actorRoleName: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ActivityListResponse {
  items: ActivityItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const listActivities = async (
  societyId: string,
  params: {
    entityType?: ActivityEntityType;
    entityId?: string;
    actionType?: string;
    actorMembershipId?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    pageSize?: number;
  },
) => {
  const response = await apiClient.get<ActivityListResponse>("/activity", {
    headers: { "x-society-id": societyId },
    params,
  });
  return response.data;
};
