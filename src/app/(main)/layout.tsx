
"use client";

import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import React, { useState } from 'react';

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The state for the loading overlay is being removed.
  // A simple state is kept for the sidebar's setIsPageLoading prop, though it won't have a visible effect anymore.
  const [isPageLoading, setIsPageLoading] = useState(false);

  return (
    <>
      <AppSidebar setIsPageLoading={setIsPageLoading} />
      <SidebarInset className="bg-background relative">
        {/* The conditional rendering for the loading overlay has been removed. */}
        {children}
      </SidebarInset>
    </>
  );
}
