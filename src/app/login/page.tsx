"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    // This page is a placeholder as authentication is not implemented.
    // It provides a clear path back to the main application.
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Login Disabled</CardTitle>
          <CardDescription>
            User authentication is currently not enabled for this application.
            You can switch profiles in the sidebar for activity logging purposes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/home">
            <Button>Go to Home Page</Button>
          </Link>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground mt-8">
        &copy; {new Date().getFullYear()} AI_TeleSuite.
      </p>
    </div>
  );
}
