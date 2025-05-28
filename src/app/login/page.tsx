
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/icons/logo";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const router = useRouter();

  // Automatically redirect to home since login is disabled
  useEffect(() => {
    router.replace('/home');
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Logo width={60} height={60} />
          </div>
          <CardTitle className="text-2xl font-bold text-primary">Login Disabled</CardTitle>
          <CardDescription>The login functionality is temporarily disabled.</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-4 text-muted-foreground">
            Redirecting to the application...
          </p>
          <Link href="/home">
            <Button>Go to Home</Button>
          </Link>
        </CardContent>
      </Card>
       <p className="text-xs text-muted-foreground mt-8">
        &copy; {new Date().getFullYear()} AI_TeleSuite.
      </p>
    </div>
  );
}
