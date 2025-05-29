
import type {Metadata} from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { UserProfileProvider } from '@/hooks/useUserProfile'; // Import UserProfileProvider

export const metadata: Metadata = {
  title: 'AI_TeleSuite',
  description: 'Telesales productivity assistant by Firebase Studio',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <UserProfileProvider> {/* Wrap with UserProfileProvider */}
          {children}
          <Toaster />
        </UserProfileProvider>
      </body>
    </html>
  );
}
