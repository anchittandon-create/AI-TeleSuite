# 🔁 AI_TeleSuite: Full Replication Prompt (v1.1) - Part 2

## **Part 2: Global Styles & Layout**

This document contains the full code for global styles (`globals.css`), the root `layout.tsx`, the main authenticated layout, and the core layout components responsible for the application's shell, including the sidebar and page header.

---

### **2.1. Global Styles**

#### **File: `src/app/globals.css`**
**Purpose:** Defines the application's color scheme using CSS variables for the light theme and includes base Tailwind CSS layers.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: var(--font-geist-sans), Arial, Helvetica, sans-serif;
}

@layer base {
  :root {
    --background: 192 67% 94%; /* Light Blue (#E5F5F9) */
    --foreground: 200 10% 25%; /* Darker gray for readability */
    --card: 0 0% 100%;
    --card-foreground: 200 10% 25%;
    --popover: 0 0% 100%;
    --popover-foreground: 200 10% 25%;
    --primary: 197 74% 52%; /* Vibrant Blue (#29ABE2) */
    --primary-foreground: 0 0% 100%; /* White */
    --secondary: 192 50% 88%; /* Lighter shade of background for secondary elements */
    --secondary-foreground: 200 10% 20%;
    --muted: 192 40% 80%;
    --muted-foreground: 200 10% 40%;
    --accent: 36 100% 63%; /* Warm Orange (#FFB347) */
    --accent-foreground: 24 95% 15%; /* Dark brown/black for readability on orange */
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 192 30% 75%; /* Slightly darker border for definition */
    --input: 0 0% 100%; /* White input background */
    --input-border: 192 30% 70%; /* Border for inputs */
    --ring: 197 74% 52%; /* Primary color for rings */
    --chart-1: 12 76% 61%;
    --chart-2: 173 58% 39%;
    --chart-3: 197 37% 24%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
    --radius: 0.5rem;

    /* Sidebar specific vars, aligning with the main theme */
    --sidebar-background: 200 20% 96%; /* Slightly off-white/light-gray for sidebar */
    --sidebar-foreground: 200 10% 25%;
    --sidebar-primary: 197 74% 52%; /* Use main primary */
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 36 100% 63%; /* Use main accent */
    --sidebar-accent-foreground: 24 95% 15%;
    --sidebar-border: 200 15% 88%;
    --sidebar-ring: 197 74% 52%;
  }
  .dark {
    /* Dark mode is defined but not the primary theme */
    --background: 200 10% 10%;
    --foreground: 192 67% 94%;
    /* ... (rest of dark mode variables) ... */
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  ::-webkit-scrollbar-track {
    @apply bg-muted/50;
    border-radius: 10px;
  }
  ::-webkit-scrollbar-thumb {
    @apply bg-primary/50;
    border-radius: 10px;
  }
  ::-webkit-scrollbar-thumb:hover {
    @apply bg-primary/70;
  }
}
```

---

#### **File: `src/styles/transcript.css`**
**Purpose:** Provides specific styling for the conversation transcript view, creating the "chat bubble" effect.

```css
.agent-line {
    justify-content: flex-start;
}

.user-line {
    justify-content: flex-end;
}

.agent-line .bg-background {
    background-color: hsl(var(--secondary) / 0.5);
    border-radius: 1rem 1rem 1rem 0.25rem;
}

.user-line .bg-accent/80 {
    border-radius: 1rem 1rem 0.25rem 1rem;
}

.user-line .text-foreground {
    color: hsl(var(--primary-foreground) / 0.9);
}
```

---

### **2.2. Root Layout & Main Application Layout**

#### **File: `src/app/layout.tsx`**
**Purpose:** The absolute root layout of the application. It sets up the basic HTML structure, fonts, and providers that wrap every page, including the main app and login page.

```typescript
import type {Metadata} from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { SidebarProvider } from '@/components/ui/sidebar';
import { ProductProvider } from '@/hooks/useProductContext';

export const metadata: Metadata = {
  title: 'AI_TeleSuite',
  description: 'AI-powered Sales and Support Suite',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <ProductProvider>
          <SidebarProvider defaultOpen={true}>
            {children}
          </SidebarProvider>
        </ProductProvider>
        <Toaster />
      </body>
    </html>
  );
}
```

---

#### **File: `src/app/(main)/layout.tsx`**
**Purpose:** The main layout for the authenticated part of the application. It includes the `AppSidebar` and a page loading overlay for better UX during navigation.

```typescript
"use client";

import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import React, { useState, useEffect, useRef } from 'react';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { usePathname } from 'next/navigation';

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isPageLoading, setIsPageLoading] = useState(false);
  const pathname = usePathname();
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      setIsPageLoading(true);
      previousPathnameRef.current = pathname;
    }

    const timer = setTimeout(() => {
      setIsPageLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <>
      <AppSidebar setIsPageLoading={setIsPageLoading} />
      <SidebarInset className="bg-background relative">
        {isPageLoading && (
          <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
            <LoadingSpinner size={64} className="text-primary" />
            <p className="mt-4 text-xl font-semibold text-primary">Loading page...</p>
          </div>
        )}
        <div className={isPageLoading ? 'opacity-0' : 'opacity-100 transition-opacity duration-200'}>
          {children}
        </div>
      </SidebarInset>
    </>
  );
}
```

---

### **2.3. Core Layout Components**

#### **File: `src/components/layout/app-sidebar.tsx`**
**Purpose:** The main collapsible sidebar navigation for the application.

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState, useEffect, useMemo } from "react";
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
import { 
    Home, Lightbulb, MessageSquareReply, LayoutDashboard, Database, BookOpen, 
    ListChecks, Mic2, AreaChart, UserCircle, FileSearch, BarChart3, 
    Presentation, ListTree, Voicemail, Ear, Users as UsersIcon, BarChartHorizontalIcon,
    Briefcase, Headset, FileLock2, BarChartBig, Activity, ChevronDown, DownloadCloud, PieChart, ShoppingBag, Radio, CodeSquare, PlusCircle, Server, Workflow
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { useUserProfile } from '@/hooks/useUserProfile';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ProductSelector } from "./product-selector";

interface AppSidebarProps {
  setIsPageLoading: (isLoading: boolean) => void;
}

const navStructure = [
  { type: 'item', href: "/home", label: "Home", icon: Home },
  { type: 'item', href: "/products", label: "Products", icon: ShoppingBag },
  { type: 'item', href: "/knowledge-base", label: "Knowledge Base", icon: Database },
  { type: 'separator' },
  { 
    type: 'group', 
    label: "Sales & Support Tools", 
    icon: Briefcase,
    items: [
      { href: "/pitch-generator", label: "AI Pitch Generator", icon: Lightbulb },
      { href: "/rebuttal-generator", label: "AI Rebuttal Assistant", icon: MessageSquareReply },
    ]
  },
  { 
    type: 'group', 
    label: "Analysis & Reporting", 
    icon: BarChartBig,
    items: [
      { href: "/transcription", label: "Audio Transcription", icon: Mic2 },
      { href: "/transcription-dashboard", label: "Transcription Dashboard", icon: ListTree },
      { href: "/call-scoring", label: "AI Call Scoring", icon: ListChecks },
      { href: "/call-scoring-dashboard", label: "Scoring Dashboard", icon: AreaChart },
      { href: "/combined-call-analysis", label: "Combined Call Analysis", icon: PieChart },
      { href: "/combined-call-analysis-dashboard", label: "Combined Analysis DB", icon: PieChart },
    ]
  },
   { 
    type: 'group', 
    label: "Voice Agents", 
    icon: Headset,
    items: [
      { href: "/voice-sales-agent", label: "AI Voice Sales Agent", icon: Voicemail },
      { href: "/voice-sales-dashboard", label: "Voice Sales Dashboard", icon: Radio },
      { href: "/voice-support-agent", label: "AI Voice Support Agent", icon: Ear },
      { href: "/voice-support-dashboard", label: "Voice Support Dashboard", icon: UsersIcon },
    ]
  },
  { 
    type: 'group', 
    label: "Content & Data Tools", 
    icon: CodeSquare,
    items: [
      { href: "/create-training-deck", label: "Training Material Creator", icon: BookOpen },
      { href: "/training-material-dashboard", label: "Material Dashboard", icon: Presentation },
      { href: "/data-analysis", label: "AI Data Analyst", icon: FileSearch },
      { href: "/data-analysis-dashboard", label: "Analysis Dashboard", icon: BarChart3 },
      { href: "/batch-audio-downloader", label: "Batch Audio Downloader", icon: DownloadCloud },
    ]
  },
  { type: 'separator' },
  { type: 'item', href: "/activity-dashboard", label: "Global Activity Log", icon: Activity },
  { type: 'item', href: "/clone-app", label: "Clone Full App", icon: Server },
  { type: 'item', href: "/n8n-workflow", label: "n8n Workflow", icon: Workflow },
];

const getItemIsActive = (itemHref: string, currentPath: string): boolean => {
  const currentCleanPathname = currentPath.endsWith('/') && currentPath.length > 1 ? currentPath.slice(0, -1) : currentPath;
  const currentCleanItemHref = itemHref.endsWith('/') && itemHref.length > 1 ? itemHref.slice(0, -1) : itemHref;

  if (currentCleanItemHref === "/home") {
      return currentCleanPathname === currentCleanItemHref;
  }
  return currentCleanPathname === currentCleanItemHref || currentCleanPathname.startsWith(currentCleanItemHref + '/');
};


export function AppSidebar({ setIsPageLoading }: AppSidebarProps) {
  const pathname = usePathname();
  const [isTransitioningTo, setIsTransitioningTo] = useState<string | null>(null);
  const { currentProfile } = useUserProfile();

  const activeGroupLabel = useMemo(() => {
    const activeGroup = navStructure.find(group => 
        group.type === 'group' && group.items.some(item => getItemIsActive(item.href, pathname))
    );
    return activeGroup?.label;
  }, [pathname]);

  const [openAccordionItems, setOpenAccordionItems] = useState<string[]>(activeGroupLabel ? [activeGroupLabel] : []);
  
  useEffect(() => {
    if (activeGroupLabel && !openAccordionItems.includes(activeGroupLabel)) {
      setOpenAccordionItems(prev => [...prev, activeGroupLabel]);
    }
  }, [activeGroupLabel, openAccordionItems]);


  const handleLinkClick = (href: string) => {
    const cleanPathname = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
    const cleanHref = href.endsWith('/') && href.length > 1 ? href.slice(0, -1) : href;

    if (cleanPathname !== cleanHref) {
      setIsTransitioningTo(href); 
      setIsPageLoading(true);     
    } else {
      setIsTransitioningTo(null);
      setIsPageLoading(false); 
    }
  };

  const renderNavItem = (item: any, isSubItem = false) => {
    const isActiveForStyling = getItemIsActive(item.href, pathname);
    const showItemSpecificLoading = isTransitioningTo === item.href;

    const commonButtonProps = {
      isActive: isActiveForStyling,
      tooltip: { children: item.label, className: "bg-card text-card-foreground border-border" },
      className: cn(
        "justify-start w-full",
        showItemSpecificLoading ? "opacity-70 cursor-wait" : "",
        "transition-colors duration-150 ease-in-out",
        isSubItem ? "text-xs py-1.5 pl-8 pr-2 hover:bg-sidebar-accent/70" : "",
        isActiveForStyling && isSubItem ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : ""
      ),
    };
    
    const content = (
        <>
            {showItemSpecificLoading ? (
                <LoadingSpinner size={16} className="shrink-0 text-primary" />
            ) : (
                <item.icon className={cn("shrink-0", isSubItem ? "h-3.5 w-3.5" : "h-4 w-4")} />
            )}
            <span>{item.label}</span>
        </>
    );

    return (
      <SidebarMenuItem key={item.href}>
        <Link href={item.href} onClick={() => handleLinkClick(item.href)} className="w-full block">
          {isSubItem ? (
            <div
              className={cn(
                "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[color,background-color] duration-150 ease-in-out hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50",
                commonButtonProps.className
              )}
              data-active={isActiveForStyling}
            >
              {content}
            </div>
          ) : (
            <SidebarMenuButton {...commonButtonProps}>
              {content}
            </SidebarMenuButton>
          )}
        </Link>
      </SidebarMenuItem>
    );
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
            <Accordion 
                type="multiple" 
                value={openAccordionItems} 
                onValueChange={setOpenAccordionItems} 
                className="w-full group-data-[collapsible=icon]:hidden"
            >
            {navStructure.map((navSection, idx) => {
                if (navSection.type === 'separator') {
                    return <SidebarSeparator key={`sep-${idx}`} className="my-1 group-data-[collapsible=icon]:hidden"/>
                }
                if (navSection.type === 'item') {
                    return renderNavItem(navSection);
                }
                if (navSection.type === 'group') {
                    const GroupIcon = navSection.icon;
                    return (
                        <AccordionItem value={navSection.label} key={navSection.label} className="border-b-0">
                            <AccordionTrigger className="py-2 px-2 hover:no-underline hover:bg-sidebar-accent/50 rounded-md text-sm font-medium text-sidebar-foreground/90 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-2 [&>svg]:ml-auto">
                                <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
                                    <GroupIcon className="shrink-0 h-4 w-4" />
                                    <span>{navSection.label}</span>
                                </div>
                                <GroupIcon className="shrink-0 h-5 w-5 hidden group-data-[collapsible=icon]:block" title={navSection.label}/>
                            </AccordionTrigger>
                            <AccordionContent className="pt-1 pb-0 pl-1 group-data-[collapsible=icon]:hidden">
                                <SidebarMenu className="ml-2 border-l border-sidebar-border/50 pl-3 py-1">
                                    {navSection.items.map(item => renderNavItem(item, true))}
                                </SidebarMenu>
                            </AccordionContent>
                        </AccordionItem>
                    );
                }
                return null;
            })}
            </Accordion>
            
            <div className="hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1">
                 {navStructure.map((navSection, idx) => {
                    if(navSection.type === 'separator') return <SidebarSeparator key={`isep-${idx}`} />;
                    if (navSection.type === 'item') {
                        return renderNavItem(navSection);
                    }
                    if (navSection.type === 'group') {
                        return (
                            <React.Fragment key={`${navSection.label}-collapsed-group`}>
                                {navSection.items.map(item => renderNavItem(item))}
                            </React.Fragment>
                        );
                    }
                    return null;
                })}
            </div>

        </SidebarMenu>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter className="p-2 space-y-2">
        <div className="group-data-[collapsible=icon]:hidden px-2 py-1 space-y-1">
          <Label className="text-xs text-sidebar-foreground/80 flex items-center gap-1.5">
              <UserCircle size={14} />
              Profile: {currentProfile}
          </Label>
        </div>
        <div className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:items-center hidden">
          <UserCircle size={20} title={`Profile: ${currentProfile}`} />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
```

---

#### **File: `src/components/layout/page-header.tsx`**
**Purpose:** A sticky header displaying the page title and a hamburger menu trigger on mobile.

```typescript
"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu } from "lucide-react";
import { PageTitle } from "@/components/common/page-title";

interface PageHeaderProps {
  title: string;
}

export function PageHeader({ title }: PageHeaderProps) {
  const isMobile = useIsMobile();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      {isMobile && (
        <SidebarTrigger variant="ghost" size="icon" className="md:hidden -ml-2">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle Sidebar</span>
        </SidebarTrigger>
      )}
      <PageTitle text={title} className="flex-1" />
    </header>
  );
}
```

---

This concludes Part 2.
