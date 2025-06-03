
"use client";

import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import React, { useState, useEffect } from 'react';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { usePathname } from 'next/navigation';


export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isPageLoading, setIsPageLoading] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // This effect will ensure the loading spinner is turned off if a page transition
    // somehow completes without the sidebar explicitly turning it off (e.g., browser back/forward not initiated by sidebar).
    // The sidebar is the primary controller for turning it *on* and *off* for its navigations.
    setIsPageLoading(false);
  }, [pathname]);


  return (
    <SidebarProvider defaultOpen={true}> {/* Ensure sidebar is open by default on larger screens */}
      <AppSidebar setIsPageLoading={setIsPageLoading} /> {/* Pass setter to sidebar */}
      <SidebarInset className="bg-background relative"> {/* Added relative for positioning spinner */}
        {isPageLoading && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <LoadingSpinner size={48} />
            <p className="ml-3 text-muted-foreground">Loading page...</p>
          </div>
        )}
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}

