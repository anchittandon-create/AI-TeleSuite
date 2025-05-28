
import type {Metadata} from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
// Removed AuthProvider import

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
        {/* Removed AuthProvider wrapper */}
        {children}
        <Toaster />
      </body>
    </html>
  );
}
