
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

interface AppSidebarProps {
  setIsPageLoading: (isLoading: boolean) => void;
}

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

export function AppSidebar({ setIsPageLoading }: AppSidebarProps) {
  const pathname = usePathname();
  const [isTransitioningTo, setIsTransitioningTo] = useState<string | null>(null);

  useEffect(() => {
    // When pathname actually changes (navigation is complete),
    // clear the 'isTransitioningTo' state for item-specific spinners.
    // The global loader is now managed solely by MainAppLayout.
    setIsTransitioningTo(null);
  }, [pathname]);

  const handleLinkClick = (href: string) => {
    const cleanPathname = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
    const cleanHref = href.endsWith('/') && href.length > 1 ? href.slice(0, -1) : href;

    if (cleanPathname !== cleanHref) {
      setIsTransitioningTo(href); // Set for item-specific spinner
      setIsPageLoading(true);    // Set for global loading overlay
    } else {
      // If clicking the currently active link, ensure loading states are cleared.
      setIsPageLoading(false);
      setIsTransitioningTo(null);
    }
  };

  // Determines if a link should be styled as active based on the current pathname
  const getItemIsActive = (itemHref: string) => {
    const currentCleanPathname = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
    const currentCleanItemHref = itemHref.endsWith('/') && itemHref.length > 1 ? itemHref.slice(0, -1) : itemHref;

    // Special case for home: must be an exact match.
    if (currentCleanItemHref === "/home") {
        return currentCleanPathname === currentCleanItemHref;
    }
    // For other items, check if pathname starts with the item's href 
    // (e.g., /settings should match /settings/profile)
    // Or if it's an exact match.
    return currentCleanPathname === currentCleanItemHref || currentCleanPathname.startsWith(currentCleanItemHref + '/');
  };

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
            const isActiveForStyling = getItemIsActive(item.href);
            const showItemSpecificLoading = isTransitioningTo === item.href;

            return (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} onClick={() => handleLinkClick(item.href)}>
                  <SidebarMenuButton
                    isActive={isActiveForStyling} // This drives the data-active attribute for styling
                    tooltip={{ children: item.label, className: "bg-card text-card-foreground border-border" }}
                    className={cn(
                      "justify-start",
                      showItemSpecificLoading // Apply visual cues if this item is being loaded
                        ? "opacity-70 cursor-wait"
                        : "",
                      "transition-colors duration-150 ease-in-out"
                    )}
                  >
                    {showItemSpecificLoading ? (
                      <LoadingSpinner size={16} className="shrink-0 text-primary" />
                    ) : (
                      <item.icon className="shrink-0" />
                    )}
                    <span>{item.label}</span>
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
