
"use client"; // Required for using hooks like useRouter and useAuth

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { LoadingSpinner } from '@/components/common/loading-spinner'; // For loading state

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loggedInAgent, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !loggedInAgent) {
      router.replace('/login'); // Use replace to avoid login page in history
    }
  }, [loggedInAgent, isLoading, router]);

  if (isLoading || !loggedInAgent) {
    // Show a loading spinner or a blank page while checking auth state or redirecting
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background">
        <LoadingSpinner size={48} />
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
