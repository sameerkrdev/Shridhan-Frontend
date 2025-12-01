import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IconSearch, IconEdit, IconTrash, IconUserPlus } from "@tabler/icons-react";
import tableData from "@/app/dashboard/data.json";
import { AddMemberDialog } from "@/dialogs/AddMemberDialog";
import { EditMemberDialog } from "@/dialogs/EditMemberDialog";
import { RemoveMemberDialog } from "@/dialogs/RemoveMemberDialog";

interface TeamMember {
  id: number;
  name: string;
  email: string;
  phoneNumber: string;
  role: string;
}

const AVAILABLE_ROLES = [
  "Project Manager",
  "Senior Developer",
  "Technical Lead",
  "Risk Analyst",
  "Compliance Officer",
  "API Developer",
  "UI/UX Designer",
  "Database Administrator",
  "QA Engineer",
  "Market Analyst",
  "DevOps Engineer",
  "UX Researcher",
  "Performance Engineer",
  "Localization Specialist",
  "Mobile Developer",
  "Legal Counsel",
  "CI/CD Engineer",
  "Security Engineer",
  "Monitoring Specialist",
  "Product Owner",
];

const TeamsPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [data, setData] = useState<TeamMember[]>(tableData);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.phoneNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.role.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [data, searchQuery]);

  const handleEditClick = (member: TeamMember) => {
    setSelectedMember(member);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (member: TeamMember) => {
    setSelectedMember(member);
    setIsDeleteModalOpen(true);
  };

  const handleAddClick = () => {
    setIsAddModalOpen(true);
  };

  const handleEditSave = (updatedData: Omit<TeamMember, "id">) => {
    if (selectedMember) {
      setData((prevData) =>
        prevData.map((member) =>
          member.id === selectedMember.id ? { ...member, ...updatedData } : member
        )
      );
      setSelectedMember(null);
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedMember) {
      setData((prevData) => prevData.filter((member) => member.id !== selectedMember.id));
      setIsDeleteModalOpen(false);
      setSelectedMember(null);
    }
  };

  const handleAddMember = (newMemberData: Omit<TeamMember, "id">) => {
    const newId = data.length > 0 ? Math.max(...data.map((m) => m.id)) + 1 : 1;
    const newMember: TeamMember = {
      id: newId,
      ...newMemberData,
    };

    setData((prevData) => [...prevData, newMember]);
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="py-6">
        <div>
          <h1 className="text-3xl font-bold bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Teams Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">Manage and track team members</p>
        </div>
      </div>

      <div className="py-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, phone, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>

          <Button className="gap-2" onClick={handleAddClick}>
            <IconUserPlus className="h-4 w-4" />
            Add Member
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto py-6">
        <div>
          <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/70">
                  <TableHead className="w-20 font-semibold">S.No.</TableHead>
                  <TableHead className="font-semibold min-w-[200px]">Name</TableHead>
                  <TableHead className="font-semibold min-w-[250px]">Email</TableHead>
                  <TableHead className="font-semibold min-w-[180px]">Phone Number</TableHead>
                  <TableHead className="font-semibold min-w-[200px]">Role</TableHead>
                  <TableHead className="font-semibold text-center w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No results found. Try adjusting your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((member, index) => (
                    <TableRow key={member.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-linear-to-br from-primary/20 to-primary/10 flex items-center justify-center text-sm font-semibold">
                            {member.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </div>
                          <span>{member.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {member.email}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{member.phoneNumber}</TableCell>
                      <TableCell>{member.role}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => handleEditClick(member)}
                          >
                            <IconEdit className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteClick(member)}
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 text-sm text-muted-foreground text-center">
            Showing {filteredData.length} of {data.length} team members
          </div>
        </div>
      </div>

      <AddMemberDialog
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onAddMember={handleAddMember}
        availableRoles={AVAILABLE_ROLES}
      />

      <EditMemberDialog
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        member={selectedMember}
        onSave={handleEditSave}
        availableRoles={AVAILABLE_ROLES}
      />

      <RemoveMemberDialog
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        member={selectedMember}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};

export default TeamsPage;
