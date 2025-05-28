
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth, PREDEFINED_AGENTS } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Logo } from '@/components/icons/logo';

const LoginFormSchema = z.object({
  agentId: z.string().min(1, "Please select an agent."),
  password: z.string().optional(),
});

type LoginFormValues = z.infer<typeof LoginFormSchema>;

export default function LoginPage() {
  const { login, isLoading: authIsLoading } = useAuth(); 
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [formIsSubmitting, setFormIsSubmitting] = useState(false); 
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(LoginFormSchema),
    defaultValues: {
      agentId: '',
      password: '',
    },
  });

  const selectedAgent = PREDEFINED_AGENTS.find(a => a.id === selectedAgentId);
  const agentRequiresPassword = selectedAgent?.requiresPassword ?? false;

  const onSubmit = async (data: LoginFormValues) => {
    setFormIsSubmitting(true);
    setError(null);
    try {
      const success = await login(data.agentId, data.password);
      if (success) {
        router.push('/home'); 
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } catch (e) {
      console.error("Login error:", e);
      setError(e instanceof Error ? e.message : 'An unexpected error occurred.');
    } finally {
      setFormIsSubmitting(false);
    }
  };
  
  if (authIsLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <LoadingSpinner size={48} />
        <p className="mt-4 text-muted-foreground">Loading authentication...</p>
      </div>
    );
  }


  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Logo width={60} height={60} />
          </div>
          <CardTitle className="text-2xl font-bold text-primary">Welcome to AI_TeleSuite</CardTitle>
          <CardDescription>Please select an agent to log in.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="agentId">Agent</Label>
              <Select
                value={selectedAgentId}
                onValueChange={(value) => {
                  setSelectedAgentId(value);
                  form.setValue('agentId', value);
                  if (!PREDEFINED_AGENTS.find(a => a.id === value)?.requiresPassword) {
                    form.setValue('password', ''); 
                  }
                  setError(null); 
                }}
                disabled={formIsSubmitting}
              >
                <SelectTrigger id="agentId">
                  <SelectValue placeholder="Select Agent" />
                </SelectTrigger>
                <SelectContent>
                  {PREDEFINED_AGENTS.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.agentId && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.agentId.message}</p>
              )}
            </div>

            {agentRequiresPassword && (
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter numerical password"
                  {...form.register('password', {
                    pattern: {
                      value: /^[0-9]*$/,
                      message: "Password must be numeric."
                    }
                  })}
                  inputMode="numeric"
                  disabled={formIsSubmitting}
                />
                 {form.formState.errors.password && (
                  <p className="text-xs text-destructive mt-1">{form.formState.errors.password.message}</p>
                )}
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Login Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={formIsSubmitting || !selectedAgentId}>
              {formIsSubmitting ? <LoadingSpinner size={16} className="mr-2" /> : null}
              {formIsSubmitting ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground mt-8">
        &copy; {new Date().getFullYear()} AI_TeleSuite.
      </p>
    </div>
  );
}
