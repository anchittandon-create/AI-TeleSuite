
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState, useEffect } from "react";
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
import { Home, Lightbulb, MessageSquareReply, LayoutDashboard, Database, BookOpen, ListChecks, Mic2, AreaChart, UserCircle, FileSearch, BarChart3, Presentation, ListTree } from "lucide-react";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/common/loading-spinner";


const navItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/pitch-generator", label: "Pitch Generator", icon: Lightbulb },
  { href: "/rebuttal-generator", label: "Rebuttal Assistant", icon: MessageSquareReply },
  { href: "/transcription", label: "Transcription", icon: Mic2 },
  { href: "/transcription-dashboard", label: "Transcript Dashboard", icon: ListTree },
  { href: "/call-scoring", label: "Call Scoring", icon: ListChecks },
  { href: "/call-scoring-dashboard", label: "Scoring Dashboard", icon: AreaChart },
  { href: "/knowledge-base", label: "Knowledge Base", icon: Database },
  { href: "/create-training-deck", label: "Training Material Creator", icon: BookOpen },
  { href: "/training-material-dashboard", label: "Material Dashboard", icon: Presentation },
  { href: "/data-analysis", label: "Data Analysis", icon: FileSearch },
  { href: "/data-analysis-dashboard", label: "Analysis Dashboard", icon: BarChart3 },
  { href: "/activity-dashboard", label: "Activity Dashboard", icon: LayoutDashboard },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [isTransitioningTo, setIsTransitioningTo] = useState<string | null>(null);

  const handleLinkClick = (href: string) => {
    if (pathname !== href) { // Only set if navigating to a new page
      setIsTransitioningTo(href);
    }
  };

  useEffect(() => {
    // When the pathname changes (navigation completes) to the path we were transitioning to,
    // or if isTransitioningTo is set but the current path is different (e.g. user navigated away manually),
    // reset the transitioning state if the current path matches the target.
    if (isTransitioningTo && pathname === isTransitioningTo) {
      setIsTransitioningTo(null);
    }
    // If isTransitioningTo is set, but the user has navigated elsewhere (e.g. browser back/forward)
    // and the current path is NOT the one we were transitioning to, we should also clear it.
    // However, this is tricky because the user might click another link.
    // The primary mechanism is clearing when pathname === isTransitioningTo.
  }, [pathname, isTransitioningTo]);

  return (
    <Sidebar variant="sidebar" collapsible="icon" side="left">
      <SidebarHeader className="p-4 items-center">
        <Link href="/home" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center" onClick={() => handleLinkClick("/home")}>
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
            // Show loading indicator if we are actively transitioning to this item AND we are not yet on this item's page
            const showLoadingForThisItem = isTransitioningTo === item.href && pathname !== item.href;
            
            return (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} legacyBehavior passHref>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive && !showLoadingForThisItem} // Item is active only if not currently loading to it
                    onClick={() => handleLinkClick(item.href)}
                    tooltip={{ children: item.label, className: "bg-card text-card-foreground border-border" }}
                    className={cn(
                      "justify-start",
                      showLoadingForThisItem
                        ? "bg-primary/10 text-primary font-medium opacity-80 cursor-wait" // Style when loading this item
                        : isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" // Style when active
                          : "hover:bg-sidebar-accent/80", // Default hover
                      "transition-colors duration-150 ease-in-out"
                    )}
                  >
                    <a>
                      {showLoadingForThisItem ? (
                        <LoadingSpinner size={16} className="shrink-0 text-primary" />
                      ) : (
                        <item.icon className="shrink-0" />
                      )}
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
        </div>
        <div className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:items-center hidden">
          <UserCircle size={20} title="Profile: Anchit" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
