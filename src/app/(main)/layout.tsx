
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
  const [isPageLoading, setIsPageLoading] = useState(true); 
  const pathname = usePathname(); 
  const previousPathname = useRef(pathname);

  useEffect(() => {
    // If the pathname changes from its previous value, set loading to true.
    // This will trigger the loading overlay for any navigation.
    if (previousPathname.current !== pathname) {
      setIsPageLoading(true);
      previousPathname.current = pathname;
    }
  }, [pathname]);

  useEffect(() => {
    // This effect runs when the actual pathname changes (after the one above),
    // or on initial load after the first render cycle.
    // It also runs when isPageLoading becomes true to ensure loader stays for a minimum duration.
    let timer: NodeJS.Timeout;
    if (isPageLoading) { // Only set a timer to hide if it's currently loading
        timer = setTimeout(() => {
            setIsPageLoading(false); // Hide loader after a delay
        }, 100); // Reduced delay from 500ms to 100ms for quicker disappearance
    }
    
    return () => clearTimeout(timer);
  }, [pathname, isPageLoading]); // Re-run if pathname changes or isPageLoading becomes true


  return (
    <SidebarProvider defaultOpen={true}> 
      <AppSidebar setIsPageLoading={setIsPageLoading} /> 
      <SidebarInset className="bg-background relative"> 
        {isPageLoading && (
          <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
            <LoadingSpinner size={64} className="text-primary" />
            <p className="mt-4 text-xl font-semibold text-primary">Loading page...</p>
          </div>
        )}
        {/* Conditionally render children to ensure loading overlay is fully effective,
            or use opacity to fade in once loading is false. */}
        <div className={isPageLoading ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}>
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
