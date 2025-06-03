
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

  const handleLinkClick = (href: string) => {
    if (pathname !== href) { 
      setIsTransitioningTo(href);
      setIsPageLoading(true); 
    } else {
      setIsPageLoading(false); 
    }
  };

  useEffect(() => {
    // This effect runs when the pathname actually changes.
    // If isTransitioningTo was set, it means we initiated this change.
    if (isTransitioningTo && pathname === isTransitioningTo) {
      setIsTransitioningTo(null); // Reset transition state
      setIsPageLoading(false); // Turn off global loading spinner
    } else if (pathname !== isTransitioningTo) {
      // Handle browser back/forward navigation or direct URL changes
      setIsTransitioningTo(null); // Ensure transition state is cleared
      setIsPageLoading(false); // Ensure global spinner is off
    }
  }, [pathname, isTransitioningTo, setIsPageLoading]);

  // More precise isActive logic
  const getIsActive = (itemHref: string) => {
    const cleanPathname = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
    const cleanItemHref = itemHref.endsWith('/') && itemHref.length > 1 ? itemHref.slice(0, -1) : itemHref;

    if (cleanItemHref === "/home") {
        return cleanPathname === cleanItemHref;
    }
    // For other items, ensure it's either an exact match or starts with the href followed by a slash (or is exactly the href)
    return cleanPathname === cleanItemHref || cleanPathname.startsWith(cleanItemHref + '/');
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
            const isActive = getIsActive(item.href);
            const showItemSpecificLoading = isTransitioningTo === item.href;
            
            return (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} legacyBehavior passHref>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive && !showItemSpecificLoading} 
                    onClick={() => handleLinkClick(item.href)}
                    tooltip={{ children: item.label, className: "bg-card text-card-foreground border-border" }}
                    className={cn(
                      "justify-start",
                      showItemSpecificLoading
                        ? "opacity-70 cursor-wait" // Keep style simple, global spinner handles feedback
                        : isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                          : "hover:bg-sidebar-accent/80", 
                      "transition-colors duration-150 ease-in-out"
                    )}
                  >
                    <a>
                      {showItemSpecificLoading ? (
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
