
"use client";

import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Info } from 'lucide-react';
import { AppVersionSwitcher } from '@/components/layout/app-version-switcher';
import { useAppVersion } from '@/context/app-version-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
  const { appVersion } = useAppVersion();
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
        <div className="sticky top-0 z-30 flex flex-col gap-0 border-b bg-background/95 px-4 py-2 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-muted-foreground">
              Select which build of the app you want to use.
            </div>
            <AppVersionSwitcher />
          </div>
          {appVersion === 'open-source' && (
            <Alert className="mt-2 border-amber-300 bg-amber-50 text-amber-900">
              <Info className="h-4 w-4" />
              <AlertTitle>Open Source Mode</AlertTitle>
              <AlertDescription>
                Paid AI services are disabled. Features such as voice agents and call scoring run in read-only/demo mode using only open-source libraries.
              </AlertDescription>
            </Alert>
          )}
        </div>
        <div className="p-4">
          {children}
        </div>
      </SidebarInset>
    </>
  );
}
