import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { getApiErrorMessage } from "@/lib/apiError"
import {
  useAssignRoleToMemberMutation,
  useMemberRolesQuery,
  useRemoveRoleFromMemberMutation,
  useRolesQuery,
} from "@/hooks/useAccessControlApi"

const MemberRoleAssignmentPage = () => {
  const [search, setSearch] = useState("")
  const [roleDraftByMember, setRoleDraftByMember] = useState<Record<string, string>>({})

  const { data: members = [], isLoading: isMembersLoading } = useMemberRolesQuery()
  const { data: roles = [] } = useRolesQuery()
  const assignRoleMutation = useAssignRoleToMemberMutation()
  const removeRoleMutation = useRemoveRoleFromMemberMutation()

  const filteredMembers = useMemo(
    () =>
      members.filter((member) => {
        const lookup = `${member.name} ${member.phone} ${member.email ?? ""}`.toLowerCase()
        return lookup.includes(search.toLowerCase())
      }),
    [members, search]
  )

  const handleAssignRole = async (memberId: string) => {
    const selectedRoleId = roleDraftByMember[memberId]
    if (!selectedRoleId) {
      toast.error("Select a role first")
      return
    }

    try {
      await assignRoleMutation.mutateAsync({
        memberId,
        roleId: selectedRoleId,
      })
      toast.success("Role assigned")
      setRoleDraftByMember((previous) => ({
        ...previous,
        [memberId]: "",
      }))
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to assign role"))
    }
  }

  const handleRemoveRole = async (memberId: string, roleId: string, roleName: string) => {
    if (!window.confirm(`Remove role '${roleName}' from this member?`)) {
      return
    }

    try {
      await removeRoleMutation.mutateAsync({
        memberId,
        roleId,
      })
      toast.success("Role removed")
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to remove role"))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Member Role Assignment</h1>
        <p className="text-muted-foreground mt-2">
          Assign and remove society roles for each member.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>Manage role assignments per member.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {isMembersLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="border rounded-md p-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="space-y-2">
                    <div className="font-semibold">{member.name}</div>
                    <div className="text-sm text-muted-foreground">{member.phone}</div>
                    <div className="text-sm text-muted-foreground">{member.email || "-"}</div>
                    <div className="flex flex-wrap gap-2">
                      {member.assignedRoles.map((assignment) => (
                        <Badge key={assignment.id} variant="outline" className="gap-2">
                          {assignment.role.name}
                          <button
                            type="button"
                            className="text-destructive text-xs cursor-pointer"
                            onClick={() =>
                              handleRemoveRole(member.id, assignment.role.id, assignment.role.name)
                            }
                          >
                            Remove
                          </button>
                        </Badge>
                      ))}
                      {!member.assignedRoles.length ? (
                        <span className="text-sm text-muted-foreground">No roles assigned</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex gap-2 items-center">
                    <Select
                      value={roleDraftByMember[member.id] ?? ""}
                      onValueChange={(value) =>
                        setRoleDraftByMember((previous) => ({
                          ...previous,
                          [member.id]: value,
                        }))
                      }
                    >
                      <SelectTrigger className="min-w-[220px]">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button onClick={() => handleAssignRole(member.id)} disabled={assignRoleMutation.isPending}>
                      Assign
                    </Button>
                  </div>
                </div>
              ))}
              {!filteredMembers.length ? (
                <p className="text-sm text-muted-foreground text-center py-4">No members found.</p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default MemberRoleAssignmentPage
