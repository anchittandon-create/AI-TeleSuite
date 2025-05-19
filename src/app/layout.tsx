
import type {Metadata} from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

// Removed the incorrect function calls for GeistSans and GeistMono
// They are objects, not functions to be called with options here.
// Their .className property will apply the font and define CSS variables.

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
    <html lang="en" className={`${GeistSans.className} ${GeistMono.className}`} suppressHydrationWarning>
      {/*
        GeistSans.className and GeistMono.className apply the necessary font styles
        and define CSS variables like --font-geist-sans and --font-geist-mono.
        Your globals.css already uses var(--font-geist-sans) for the body.
      */}
      <body className={`font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
