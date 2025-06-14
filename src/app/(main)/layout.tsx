
"use client";

import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
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
  // useRef to store the pathname from the *previous* render cycle for comparison
  const previousPathname = useRef(pathname); 
  const pageLoadTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // This effect runs after the render, and `pathname` has its new value.
    // `previousPathname.current` still holds the value from before this render.

    if (pageLoadTimerRef.current) {
        clearTimeout(pageLoadTimerRef.current);
    }

    // Check if a navigation actually occurred by comparing current pathname with the one from previous render
    if (previousPathname.current !== pathname) {
        // Navigation happened. Sidebar might have already set isPageLoading to true.
        // If not (e.g., homepage widget click), set it now.
        if (!isPageLoading) { // Only set if not already true, to avoid extra re-render if sidebar set it
            setIsPageLoading(true);
        }
    }

    // Whether loading was set by this effect (due to path change) or by the sidebar (before path change),
    // if we are in a loading state (isPageLoading is true), set a timer to turn it off.
    if (isPageLoading) {
        pageLoadTimerRef.current = setTimeout(() => {
            setIsPageLoading(false);
        }, 400); // Adjust duration as needed
    }

    // After all logic for this render/effect, update previousPathname for the next cycle.
    previousPathname.current = pathname;

    // Cleanup the timer if the component unmounts or if the pathname changes again
    // before this timer fires.
    return () => {
        if (pageLoadTimerRef.current) {
            clearTimeout(pageLoadTimerRef.current);
        }
    };
  }, [pathname, isPageLoading, setIsPageLoading]); // isPageLoading and setIsPageLoading are included as they are part of the logic flow

  return (
    <SidebarProvider defaultOpen={true}>
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
    </SidebarProvider>
  );
}
