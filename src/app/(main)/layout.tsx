
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
  const [isPageLoading, setIsPageLoading] = useState(false); // Initialize to false
  const pathname = usePathname();
  const previousPathname = useRef<string | null>(null); // Store the previous pathname
  const pageLoadTimerRef = useRef<NodeJS.Timeout | null>(null); // Ref for the timer

  useEffect(() => {
    // This effect runs on mount and whenever the pathname changes.

    // Clear any existing timer to prevent premature hiding of the loader
    if (pageLoadTimerRef.current) {
      clearTimeout(pageLoadTimerRef.current);
    }

    if (previousPathname.current === null) {
      // This is the initial mount after client-side hydration.
      // We don't want to show a loader typically unless a link was clicked very early.
      previousPathname.current = pathname;
      // Ensure loader is off if it was somehow set true before this effect ran.
      // setIsPageLoading(false); // Let sidebar click handle initial true if needed.
                               // If initial page is heavy, Next.js Suspense is better.
    } else if (previousPathname.current !== pathname) {
      // Pathname has changed, indicating a navigation has occurred.
      // The sidebar's onClick (or homepage link's onClick if we add it there)
      // should have already set isPageLoading to true.
      // We primarily manage hiding it here after a delay.
      
      // Ensure loader is visible (it should be if navigation was triggered by a click)
      // If not, this implies a programmatic navigation or browser back/forward.
      if (!isPageLoading) { // If loader wasn't set by a click handler
          setIsPageLoading(true);
      }
      
      previousPathname.current = pathname; // Update to the new pathname

      // Set a timer to hide the loader.
      // This delay allows the new page's components to start rendering.
      pageLoadTimerRef.current = setTimeout(() => {
        setIsPageLoading(false);
      }, 300); // Adjusted delay (e.g., 300ms). Fine-tune as needed.
    }
    // If previousPathname.current === pathname, it means no navigation occurred,
    // so we don't need to change the loading state here.

    // Cleanup function for the effect
    return () => {
      if (pageLoadTimerRef.current) {
        clearTimeout(pageLoadTimerRef.current);
      }
    };
  }, [pathname, isPageLoading]); // Add isPageLoading to dependencies to react if it's set externally.

  // The AppSidebar component's link onClick handlers call setIsPageLoading(true).
  // This useEffect is now primarily responsible for turning it off after navigation.

  return (
    <SidebarProvider defaultOpen={true}>
      {/* Pass setIsPageLoading to AppSidebar so it can trigger the loader */}
      <AppSidebar setIsPageLoading={setIsPageLoading} />
      <SidebarInset className="bg-background relative">
        {isPageLoading && (
          <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
            <LoadingSpinner size={64} className="text-primary" />
            <p className="mt-4 text-xl font-semibold text-primary">Loading page...</p>
          </div>
        )}
        {/* Use opacity for smooth transition instead of conditional rendering of children */}
        <div className={isPageLoading ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}>
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
