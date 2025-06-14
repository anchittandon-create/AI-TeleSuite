
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
  const [isPageLoading, setIsPageLoading] = useState(false); // Default to false
  const pathname = usePathname();
  const previousPathnameRef = useRef<string | null>(null);
  const pageLoadTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (previousPathnameRef.current === null) {
      // This is the initial mount after client-side hydration.
      previousPathnameRef.current = pathname;
      // Don't show loader on initial page load
      setIsPageLoading(false); 
      return;
    }

    if (previousPathnameRef.current !== pathname) {
      // Pathname has changed, indicating a navigation has started or is in progress.
      
      // Clear any existing "hide" timer because a new navigation is happening.
      if (pageLoadTimerRef.current) {
        clearTimeout(pageLoadTimerRef.current);
      }
      
      setIsPageLoading(true); // Show the loader
      previousPathnameRef.current = pathname; // Update the ref to the new current pathname

      // Set a timer to hide the loader after a short delay.
      // This allows the new page's components to start rendering.
      pageLoadTimerRef.current = setTimeout(() => {
        setIsPageLoading(false);
      }, 400); // Delay of 400ms. This can be fine-tuned.
    }
    // If previousPathnameRef.current === pathname, it means the effect might be running
    // due to other state changes but not a route change, so we don't toggle the loader here.

    // Cleanup function for the effect
    return () => {
      if (pageLoadTimerRef.current) {
        clearTimeout(pageLoadTimerRef.current);
      }
    };
  }, [pathname]); // Re-run this effect when `pathname` changes.


  // AppSidebar calls setIsPageLoading(true) directly on its link clicks for immediate feedback.
  // This useEffect in MainAppLayout handles transitions triggered by other means (like homepage links) 
  // and ensures the loader is consistently hidden after sidebar-triggered navigations as well.

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
        {/* Use opacity for smooth transition instead of conditional rendering of children */}
        <div className={isPageLoading ? 'opacity-0' : 'opacity-100 transition-opacity duration-200'}>
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
