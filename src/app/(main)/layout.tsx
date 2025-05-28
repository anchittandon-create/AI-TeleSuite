
"use client"; 

import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
// import { useAuth } from '@/hooks/useAuth'; // Removed
// import { useRouter } from 'next/navigation'; // Removed
// import { useEffect } from 'react'; // Removed
// import { LoadingSpinner } from '@/components/common/loading-spinner'; // Removed

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // const { loggedInAgent, isLoading } = useAuth(); // Removed
  // const router = useRouter(); // Removed

  // useEffect(() => { // Removed
  //   if (!isLoading && !loggedInAgent) {
  //     router.replace('/login');
  //   }
  // }, [loggedInAgent, isLoading, router]);

  // if (isLoading || !loggedInAgent) { // Removed (or simply !loggedInAgent if isLoading is also removed)
  //   return ( // This loading state for auth is no longer needed
  //     <div className="flex h-screen w-screen items-center justify-center bg-background">
  //       <LoadingSpinner size={48} />
  //       <p className="ml-3 text-muted-foreground">Authenticating...</p>
  //     </div>
  //   );
  // }

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset className="bg-background">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
