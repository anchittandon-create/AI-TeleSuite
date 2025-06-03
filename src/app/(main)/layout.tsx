
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
    setIsPageLoading(false);
  }, [pathname]);


  return (
    <SidebarProvider defaultOpen={true}> 
      <AppSidebar setIsPageLoading={setIsPageLoading} /> 
      <SidebarInset className="bg-background relative"> 
        {isPageLoading && (
          <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-background/90 backdrop-blur-md"> {/* Increased opacity and blur */}
            <LoadingSpinner size={64} className="text-primary" /> {/* Larger spinner, explicit color */}
            <p className="mt-4 text-xl font-semibold text-primary">Loading page...</p> {/* More prominent text */}
          </div>
        )}
        <div className={isPageLoading ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}> {/* Hide children content during load, then fade in */}
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
