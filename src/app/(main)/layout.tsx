
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
  const previousPathnameRef = useRef<string | null>(null);
  const pageLoadTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (previousPathnameRef.current === null) {
      // This is the initial load of the layout, don't show loader immediately unless a sub-page triggers it.
      previousPathnameRef.current = pathname;
      setIsPageLoading(false); 
      return;
    }

    // Only trigger loader if the path actually changes
    if (previousPathnameRef.current !== pathname) {
      if (pageLoadTimerRef.current) {
        clearTimeout(pageLoadTimerRef.current);
      }
      
      setIsPageLoading(true); // Show loader immediately on path change
      previousPathnameRef.current = pathname; // Update previous path

      // Set a timer to hide the loader
      pageLoadTimerRef.current = setTimeout(() => {
        setIsPageLoading(false);
      }, 400); // Keep loader for 400ms to allow content to start rendering
    }

    // Cleanup timer on component unmount or if pathname changes again before timer fires
    return () => {
      if (pageLoadTimerRef.current) {
        clearTimeout(pageLoadTimerRef.current);
      }
    };
  }, [pathname]); // Effect runs when pathname changes

  return (
    <SidebarProvider defaultOpen={true}>
      {/* Pass setIsPageLoading to AppSidebar to allow it to trigger the loader instantly on click */}
      <AppSidebar setIsPageLoading={setIsPageLoading} />
      <SidebarInset className="bg-background relative">
        {isPageLoading && (
          <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
            <LoadingSpinner size={64} className="text-primary" />
            <p className="mt-4 text-xl font-semibold text-primary">Loading page...</p>
          </div>
        )}
        {/* Apply opacity transition for smoother visual change */}
        <div className={isPageLoading ? 'opacity-0' : 'opacity-100 transition-opacity duration-200'}>
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
