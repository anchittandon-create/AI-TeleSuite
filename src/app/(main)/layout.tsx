
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
  const pathname = usePathname(); // Using pathname from Next.js

  // Effect to turn off spinner when pathname changes (navigation completes)
  // This handles browser back/forward and direct URL changes as well.
  useEffect(() => {
    setIsPageLoading(false);
  }, [pathname]);


  return (
    <SidebarProvider defaultOpen={true}> 
      <AppSidebar setIsPageLoading={setIsPageLoading} /> 
      <SidebarInset className="bg-background relative"> 
        {isPageLoading && (
          <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
            <LoadingSpinner size={48} /> {/* Increased size */}
            <p className="mt-3 text-lg text-muted-foreground">Loading page...</p> {/* Added text */}
          </div>
        )}
        {!isPageLoading && children} {/* Render children only when not loading to avoid flicker */}
      </SidebarInset>
    </SidebarProvider>
  );
}
