
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
      // If clicking the current page link, ensure loading is off (though not strictly necessary with new useEffect)
      setIsPageLoading(false); 
    }
  };

  useEffect(() => {
    // Whenever pathname changes, the page transition is considered complete or a new page has loaded.
    setIsTransitioningTo(null); // Reset any active transition tracking
    setIsPageLoading(false);   // Always turn off the global loading spinner
  }, [pathname, setIsPageLoading]); // Depend on pathname and setIsPageLoading

  const getIsActive = (itemHref: string) => {
    const cleanPathname = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
    const cleanItemHref = itemHref.endsWith('/') && itemHref.length > 1 ? itemHref.slice(0, -1) : itemHref;

    if (cleanItemHref === "/home") {
        return cleanPathname === cleanItemHref;
    }
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
                        ? "opacity-70 cursor-wait"
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
