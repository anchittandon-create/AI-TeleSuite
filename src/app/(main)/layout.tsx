
"use client"; 

import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingSpinner } from '@/components/common/loading-spinner';

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loggedInAgent, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !loggedInAgent) {
      router.replace('/login');
    }
  }, [loggedInAgent, isLoading, router]);

  if (isLoading || !loggedInAgent) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <LoadingSpinner size={48} />
        <p className="ml-3 text-muted-foreground">Authenticating...</p>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset className="bg-background">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
