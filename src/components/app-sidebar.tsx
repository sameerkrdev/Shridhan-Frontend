import * as React from "react";
import {
  IconChartBar,
  IconCreditCard,
  IconDashboard,
  IconHelp,
  IconInnerShadowTop,
  IconSearch,
  IconSettings,
  IconShield,
  IconUsers,
} from "@tabler/icons-react";

import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link } from "react-router";
import { useAuthSessionStore } from "@/store/authSessionStore";
import { hasPermission } from "@/components/Can";
import { useResolveSelectedSocietyMutation } from "@/hooks/useAuthApi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const navSecondary = [
  { title: "Settings", url: "#", icon: IconSettings },
  { title: "Get Help", url: "#", icon: IconHelp },
  { title: "Search", url: "#", icon: IconSearch },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const user = useAuthSessionStore((s) => s.user);
  const memberships = useAuthSessionStore((s) => s.memberships);
  const selectedMembership = useAuthSessionStore((s) => s.selectedMembership);
  const permissions = useAuthSessionStore((s) => s.selectedMembership?.permissions);
  const setResolvedSociety = useAuthSessionStore((s) => s.setResolvedSociety);
  const resolveMutation = useResolveSelectedSocietyMutation();

  const handleSocietySwitch = async (societyId: string) => {
    try {
      const resolved = await resolveMutation.mutateAsync(societyId);
      setResolvedSociety(resolved);
    } catch {
      // Error handled by mutation.
    }
  };

  const navMain = React.useMemo(() => {
    const items = [
      { title: "Dashboard", url: "/", icon: IconDashboard },
    ];

    if (hasPermission(permissions, "membership.list")) {
      items.push({ title: "Members", url: "/members", icon: IconUsers });
    }

    items.push({ title: "Analytics", url: "#", icon: IconChartBar });

    if (hasPermission(permissions, "role.read")) {
      items.push({ title: "Role Settings", url: "/role-settings", icon: IconShield });
    }

    items.push({ title: "Billing", url: "/billing", icon: IconCreditCard });

    return items;
  }, [permissions]);

  const userData = {
    name: user?.name ?? "User",
    email: user?.email ?? user?.phone ?? "",
    avatar: user?.avatar ?? "",
  };

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:p-1.5!">
              <Link to="#">
                <IconInnerShadowTop className="size-5!" />
                <span className="text-base font-semibold">Shridhan</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {memberships.length > 1 && selectedMembership ? (
          <div className="px-2">
            <Select
              value={selectedMembership.societyId}
              onValueChange={handleSocietySwitch}
              disabled={resolveMutation.isPending}
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {memberships.map((membership) => (
                  <SelectItem key={membership.societyId} value={membership.societyId}>
                    {membership.societyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  );
}
