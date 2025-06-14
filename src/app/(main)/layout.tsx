
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
  const previousPathname = useRef(pathname);
  const pageLoadTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (pageLoadTimerRef.current) {
        clearTimeout(pageLoadTimerRef.current);
    }

    if (previousPathname.current !== pathname) {
        // Navigation happened.
        // If loader isn't already active (e.g. from sidebar click), activate it.
        if (!isPageLoading) {
            setIsPageLoading(true);
        }
        // Update previousPathname *after* checking, so this block runs once per navigation.
        previousPathname.current = pathname;
    }

    // If loader is active (either due to pathname change or sidebar click), set timer to hide it.
    if (isPageLoading) {
        pageLoadTimerRef.current = setTimeout(() => {
            setIsPageLoading(false);
        }, 400); // Consistent 400ms delay
    }

    return () => {
        if (pageLoadTimerRef.current) {
            clearTimeout(pageLoadTimerRef.current);
        }
    };
  }, [pathname, isPageLoading]); // setIsPageLoading removed as it causes re-runs when it's set by sidebar.
                                 // The effect now correctly handles being set by sidebar by checking `isPageLoading`'s current value.


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
