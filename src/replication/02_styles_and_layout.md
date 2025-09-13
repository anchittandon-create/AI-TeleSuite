# Replication Prompt: Part 2 - Global Styles & Layout

This document covers the global CSS, root layout, main application layout, and primary navigation components.

---

### **1. Global Styles**

#### **File: `src/app/globals.css`**
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
    /* Dark mode is defined but the app primarily uses the light theme. */
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
  /* Custom scrollbar for webkit browsers */
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
**Purpose:** Defines the application's color theme using CSS variables for both light and dark modes, and adds custom scrollbar styling.

---

#### **File: `src/styles/transcript.css`**
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

.user-line .bg-background {
    background-color: hsl(var(--primary) / 0.1);
    border-radius: 1rem 1rem 0.25rem 1rem;
    border-color: hsl(var(--primary) / 0.3);
}

.user-line .text-foreground {
    color: hsl(var(--primary-foreground) / 0.9);
}
```
**Purpose:** Provides specific styling for the conversation log display, creating distinct "chat bubble" appearances for the user and agent.

---

### **2. Root Layout & Providers**

#### **File: `src/app/layout.tsx`**
```typescript
import type { Metadata } from 'next';
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
**Purpose:** The root layout for the entire application. It sets up fonts, providers (`ProductProvider`, `SidebarProvider`), and the global `Toaster` for notifications.

---

### **3. Main Authenticated Layout**

#### **File: `src/app/(main)/layout.tsx`**
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

    return () => {
      clearTimeout(timer);
    };
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
**Purpose:** The main layout for the authenticated part of the app. It includes the `AppSidebar` and a loading overlay that appears during page navigation.

---

### **4. Core Layout Components**

#### **File: `src/components/layout/app-sidebar.tsx`**
```typescript
"use client";

// ... (full content of app-sidebar.tsx)
```
**Purpose:** The primary navigation component. It defines the collapsible, accordion-style sidebar structure and handles active link state and page loading transitions. *(Note: The full `navStructure` array is included in the actual file but truncated here for index brevity.)*

---

#### **File: `src/components/layout/page-header.tsx`**
```typescript
"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { PageTitle } from "@/components/common/page-title";
import { Settings } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface PageHeaderProps {
  title: string;
}

export function PageHeader({ title }: PageHeaderProps) {
  const isMobile = useIsMobile();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      {isMobile && (
        <SidebarTrigger variant="ghost" size="icon" className="md:hidden -ml-2">
          <Settings className="h-5 w-5" />
          <span className="sr-only">Toggle Sidebar</span>
        </SidebarTrigger>
      )}
      <PageTitle text={title} className="flex-1" />
    </header>
  );
}
```
**Purpose:** A sticky header that displays the current page title and a hamburger menu trigger on mobile devices.