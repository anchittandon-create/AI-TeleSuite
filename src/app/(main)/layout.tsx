
"use client";

import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
// Authentication checks are removed

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No authentication check needed here anymore
  // const { loggedInAgent, isLoading } = useAuth();
  // const router = useRouter();

  // useEffect(() => {
  //   if (!isLoading && !loggedInAgent) {
  //     router.replace('/login'); // Or a public home page if login is not mandatory
  //   }
  // }, [loggedInAgent, isLoading, router]);

  // if (isLoading || !loggedInAgent) {
  //   return (
  //     <div className="flex h-screen w-screen items-center justify-center bg-background">
  //       <LoadingSpinner size={48} />
  //       <p className="ml-3 text-muted-foreground">Authenticating...</p>
  //     </div>
  //   );
  // }

  return (
    <SidebarProvider defaultOpen={true}> {/* Ensure sidebar is open by default on larger screens */}
      <AppSidebar />
      <SidebarInset className="bg-background">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
