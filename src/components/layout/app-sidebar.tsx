
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
// Removed Button for Logout and useAuth
import { cn } from "@/lib/utils";
import { Home, Lightbulb, MessageSquareReply, LayoutDashboard, Database, BookOpen, ListChecks, Mic2, AreaChart } from "lucide-react"; // Removed LogOut, UserCircle

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
  // Removed useAuth

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
        {/* Removed agent name display and logout button */}
         <div className="text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden p-2 text-center">
            AI_TeleSuite
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
