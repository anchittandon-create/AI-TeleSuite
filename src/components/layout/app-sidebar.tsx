
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/icons/logo";
import { cn } from "@/lib/utils";
import { Home, Lightbulb, MessageSquareReply, LayoutDashboard, Database, BookOpen, ListChecks, Mic2, AreaChart, UserCircle, Users } from "lucide-react";
// Select components are no longer needed as profile is fixed
import { Label } from "@/components/ui/label";

const navItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/pitch-generator", label: "Pitch Generator", icon: Lightbulb },
  { href: "/rebuttal-generator", label: "Rebuttal Assistant", icon: MessageSquareReply },
  { href: "/transcription", label: "Transcription", icon: Mic2 },
  { href: "/call-scoring", label: "Call Scoring", icon: ListChecks },
  { href: "/call-scoring-dashboard", label: "Scoring Dashboard", icon: AreaChart },
  { href: "/knowledge-base", label: "Knowledge Base", icon: Database },
  { href: "/create-training-deck", label: "Create Training Deck", icon: BookOpen },
  { href: "/activity-dashboard", label: "Activity Dashboard", icon: LayoutDashboard },
];

export function AppSidebar() {
  const pathname = usePathname();
  // useUserProfile hook is still used by useActivityLogger implicitly
  // const { currentProfile } = useUserProfile(); // Not directly needed here anymore for display

  return (
    <Sidebar variant="sidebar" collapsible="icon" side="left">
      <SidebarHeader className="p-4 items-center">
        <Link href="/home" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <Logo className="shrink-0" />
          <span className="font-semibold text-lg text-primary group-data-[collapsible=icon]:hidden">
            AI_TeleSuite
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => {
            const isActive = item.href === "/home" ? pathname === item.href : pathname.startsWith(item.href) && item.href !== "/home";
            return (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} legacyBehavior passHref>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={{ children: item.label, className: "bg-card text-card-foreground border-border" }}
                    className={cn(
                      "justify-start",
                      isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/80",
                      "transition-colors duration-150 ease-in-out"
                    )}
                  >
                    <a>
                      <item.icon className="shrink-0" />
                      <span>{item.label}</span>
                    </a>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter className="p-2 space-y-2">
        <div className="group-data-[collapsible=icon]:hidden px-2 py-1 space-y-1">
          <Label className="text-xs text-sidebar-foreground/80 flex items-center gap-1.5">
              <UserCircle size={14} />
              Profile: Anchit
          </Label>
          {/* Profile selection Select component is removed */}
        </div>
        <div className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:items-center hidden">
          <UserCircle size={20} title="Profile: Anchit" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
