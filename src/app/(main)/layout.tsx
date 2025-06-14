
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
  const previousPathnameRef = useRef(pathname); // Use a ref to store previous pathname
  const pageLoadTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (pageLoadTimerRef.current) {
        clearTimeout(pageLoadTimerRef.current);
    }

    // Check if actual navigation has occurred
    if (previousPathnameRef.current !== pathname) {
        setIsPageLoading(true); // Show loader immediately on path change
        previousPathnameRef.current = pathname; // Update the ref to the new path
    }

    // If loader is active (either due to pathname change or explicitly set by sidebar),
    // set a timer to hide it. This ensures the loader is visible for a minimum duration.
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
  }, [pathname, isPageLoading]); // Re-run if pathname changes or if isPageLoading is externally toggled


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
