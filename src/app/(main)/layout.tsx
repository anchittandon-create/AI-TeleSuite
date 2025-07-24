
"use client";

import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import React, { useState, useEffect, useRef } from 'react';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { usePathname } from 'next/navigation';
import { ProductProvider } from '@/hooks/useProductContext';

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isPageLoading, setIsPageLoading] = useState(false);
  const pathname = usePathname();
  const previousPathnameRef = useRef(pathname); // To track if the path has actually changed

  useEffect(() => {
    // Only set loading to true if the pathname has actually changed
    if (previousPathnameRef.current !== pathname) {
      setIsPageLoading(true);
      previousPathnameRef.current = pathname; // Update the ref to the new current path
    }

    // Regardless of whether it was set to true above, set a timer to turn it off.
    // This handles the initial load case and subsequent navigations.
    const timer = setTimeout(() => {
      setIsPageLoading(false);
    }, 300); // Adjusted timeout slightly, can be tuned

    // Cleanup function to clear the timer if the component unmounts
    // or if the effect re-runs before the timer fires.
    return () => {
      clearTimeout(timer);
    };
  }, [pathname]); // Effect now only depends on pathname

  return (
    <ProductProvider>
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
    </ProductProvider>
  );
}
