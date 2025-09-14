
import type {Metadata} from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import '@/styles/transcript.css'; // Import transcript styles
import { Toaster } from "@/components/ui/toaster";
import { SidebarProvider } from '@/components/ui/sidebar';
import { ProductProvider } from '@/hooks/useProductContext.tsx';
import { UserProfileProvider } from '@/hooks/useUserProfile.tsx';
import { ActivityLogProvider } from '@/hooks/use-activity-logger.tsx';
import { KnowledgeBaseProvider } from '@/hooks/use-knowledge-base.tsx';

export const metadata: Metadata = {
  title: 'AI_TeleSuite',
  description: 'AI-powered Sales and Support Suite',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <UserProfileProvider>
         <ActivityLogProvider>
          <ProductProvider>
           <KnowledgeBaseProvider>
            <SidebarProvider defaultOpen={true}>
              {children}
            </SidebarProvider>
           </KnowledgeBaseProvider>
          </ProductProvider>
         </ActivityLogProvider>
        </UserProfileProvider>
        <Toaster />
      </body>
    </html>
  );
}
