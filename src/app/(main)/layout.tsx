
"use client";

import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const AUTH_STORAGE_KEY = 'aiTeleSuiteDemoAuth';

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The state for the loading overlay is being removed.
  // A simple state is kept for the sidebar's setIsPageLoading prop, though it won't have a visible effect anymore.
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const session = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!session) {
      router.replace('/login');
      return;
    }
    setIsAuthorized(true);
  }, [router]);

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Validating access…</p>
        </div>
      </div>
    );
  }

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
