"use client";

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, ShieldCheck, LockKeyhole, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const AUTH_STORAGE_KEY = 'aiTeleSuiteDemoAuth';
const DEMO_USERNAME = 'Anchit';
const DEMO_PASSWORD = 'AnchitAnya';

export default function LoginPage() {
  const router = useRouter();
  const [credentials, setCredentials] = useState({ identifier: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusVariant, setStatusVariant] = useState<'default' | 'error' | 'success'>('default');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const session = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (session) {
      router.replace('/home');
    }
  }, [router]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);
    setStatusVariant('default');

    setTimeout(() => {
      const identifier = credentials.identifier.trim();
      const password = credentials.password.trim();

      if (identifier === DEMO_USERNAME && password === DEMO_PASSWORD) {
        window.localStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({
            user: DEMO_USERNAME,
            issuedAt: new Date().toISOString(),
          })
        );
        setStatusVariant('success');
        setStatusMessage('Credentials verified. Redirecting to dashboard...');
        setTimeout(() => {
          router.replace('/home');
        }, 500);
      } else {
        setStatusVariant('error');
        setStatusMessage('The username or password you entered is incorrect.');
      }
      setIsSubmitting(false);
    }, 350);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Secure Sign In</CardTitle>
          <CardDescription>
            No usernames or passwords are displayed anywhere on this page. Provide your credentials only when the official
            authentication service is enabled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="identifier">Email or Username</Label>
              <Input
                id="identifier"
                autoComplete="username"
                placeholder="you@company.com"
                value={credentials.identifier}
                onChange={(event) =>
                  setCredentials((prev) => ({ ...prev, identifier: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={credentials.password}
                  onChange={(event) =>
                    setCredentials((prev) => ({ ...prev, password: event.target.value }))
                  }
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 flex items-center rounded-full p-1 text-muted-foreground hover:text-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary outline-none transition-colors"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="sr-only">Toggle password visibility</span>
                </button>
              </div>
            </div>
            {statusMessage && (
              <Alert variant={statusVariant === 'error' ? 'destructive' : 'default'} className="text-sm gap-2">
                {statusVariant === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <LockKeyhole className="h-4 w-4" />
                )}
                <AlertDescription>{statusMessage}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Securing..." : "Sign In"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => router.push('/home')}
            >
              Back to Home
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground mt-6 text-center max-w-sm">
        Demo environment — Integrate OAuth, SAML, or JWT based auth before using this screen in production.
      </p>
    </div>
  );
}
