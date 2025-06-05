
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
    // indicating navigation is complete or component is ready.
    // It also runs on initial load after the first render cycle.
    // A slightly longer delay helps ensure rendering completes before hiding overlay.
    const timer = setTimeout(() => {
        setIsPageLoading(false);
    }, 250); // Increased delay from 50ms to 250ms
    
    return () => clearTimeout(timer);
  }, [pathname]); // Dependency on pathname ensures it runs after path update


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
