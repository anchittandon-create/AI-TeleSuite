
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
import { AgentNameInput } from "@/components/common/agent-name-input";
import { cn } from "@/lib/utils";
import { Home, Lightbulb, MessageSquareReply, LayoutDashboard, Database, ClipboardCheck, GraduationCap, ListChecks, Mic2 } from "lucide-react";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/pitch-generator", label: "Pitch Generator", icon: Lightbulb },
  { href: "/rebuttal-generator", label: "Rebuttal Assistant", icon: MessageSquareReply },
  { href: "/transcription", label: "Transcription", icon: Mic2 },
  { href: "/call-scoring", label: "Call Performance", icon: ListChecks }, // Renamed, updated icon
  { href: "/knowledge-base", label: "Knowledge Base", icon: Database },
  { href: "/training-hub", label: "Training Hub", icon: GraduationCap },
  { href: "/activity-dashboard", label: "Activity Dashboard", icon: LayoutDashboard },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar variant="sidebar" collapsible="icon" side="left">
      <SidebarHeader className="p-4 items-center">
        <Link href="/" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <Logo className="shrink-0" />
          <span className="font-semibold text-lg text-primary group-data-[collapsible=icon]:hidden">
            PitchPerfect AI
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href} legacyBehavior passHref>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))}
                  tooltip={{ children: item.label, className: "bg-card text-card-foreground border-border" }}
                  className={cn(
                    "justify-start",
                   (pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))) ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : ""
                  )}
                >
                  <a>
                    <item.icon className="shrink-0" />
                    <span>{item.label}</span>
                  </a>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter className="p-4">
        <AgentNameInput />
      </SidebarFooter>
    </Sidebar>
  );
}
