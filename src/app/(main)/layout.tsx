
"use client"; 

import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth'; // Re-added
import { useRouter } from 'next/navigation'; // Re-added
import { useEffect } from 'react'; // Re-added
import { LoadingSpinner } from '@/components/common/loading-spinner'; // Re-added

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loggedInAgent, isLoading } = useAuth(); // Re-added
  const router = useRouter(); // Re-added

  useEffect(() => { // Re-added
    if (!isLoading && !loggedInAgent) {
      router.replace('/login');
    }
  }, [loggedInAgent, isLoading, router]);

  if (isLoading || !loggedInAgent) { // Re-added authentication check
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
