
"use client"; 

import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
// Removed useRouter, useAuth, useEffect, LoadingSpinner as they were for auth

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authentication logic removed
  // Loading state for auth removed

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset className="bg-background">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
