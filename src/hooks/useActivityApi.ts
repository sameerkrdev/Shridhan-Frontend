import { useQuery } from "@tanstack/react-query";
import { listActivities, type ActivityEntityType } from "@/lib/activityApi";

export const useActivitiesQuery = (
  societyId: string | null,
  filters: {
    entityType?: ActivityEntityType | null;
    entityId?: string | null;
    actionType?: string;
    actorMembershipId?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    pageSize?: number;
  },
) => {
  return useQuery({
    queryKey: ["activities", societyId, filters],
    queryFn: () =>
      listActivities(societyId!, {
        entityType: filters.entityType ?? undefined,
        entityId: filters.entityId ?? undefined,
        actionType: filters.actionType,
        actorMembershipId: filters.actorMembershipId,
        search: filters.search,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? 20,
      }),
    enabled: Boolean(societyId),
  });
};
