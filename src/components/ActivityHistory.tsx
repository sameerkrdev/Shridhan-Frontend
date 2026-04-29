import { useActivitiesQuery } from "@/hooks/useActivityApi";
import type { ActivityEntityType } from "@/lib/activityApi";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/dateFormat";
import { formatActivityDetails } from "@/lib/activityDetails";

export const ActivityHistory = ({
  societyId,
  entityType,
  entityId,
  title = "Activity History",
}: {
  societyId: string;
  entityType?: ActivityEntityType;
  entityId: string | null;
  title?: string;
}) => {
  const { data, isLoading } = useActivitiesQuery(societyId, {
    entityType: entityType ?? undefined,
    entityId,
    page: 1,
    pageSize: 10,
  });
  const items = [...(data?.items ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="min-w-0 space-y-3">
      <h3 className="font-semibold">{title}</h3>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading activities...</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">No activities yet.</p>
      ) : (
        <div className="w-full max-w-full overflow-x-auto rounded-md border">
          <Table className="min-w-[760px] table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead className="min-w-[220px]">Action</TableHead>
                <TableHead className="min-w-[140px]">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(item.createdAt)}
                  </TableCell>
                  <TableCell className="max-w-[220px] whitespace-normal wrap-break-word">
                    {item.actorName} ({item.actorPhone}) • {item.actorRoleName}
                  </TableCell>
                  <TableCell className="min-w-[220px]">
                    {item.actionType.replaceAll("_", " ")}
                  </TableCell>
                  <TableCell className="max-w-[min(280px,40vw)] whitespace-normal wrap-break-word text-muted-foreground">
                    {formatActivityDetails(item)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
