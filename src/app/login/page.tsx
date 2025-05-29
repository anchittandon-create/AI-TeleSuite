
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/icons/logo";
import { useAuth, PREDEFINED_AGENTS } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/common/loading-spinner";

export default function LoginPage() {
  const router = useRouter();
  const { login, loggedInAgent, isLoading: authIsLoading } = useAuth();
  const { toast } = useToast();
  const [selectedAgentId, setSelectedAgentId] = useState<string>(PREDEFINED_AGENTS[0]?.id || "");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedAgentDetails = PREDEFINED_AGENTS.find(a => a.id === selectedAgentId);

  useEffect(() => {
    if (loggedInAgent) {
      router.replace('/home');
    }
  }, [loggedInAgent, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId) {
      toast({ variant: "destructive", title: "Login Failed", description: "Please select an agent." });
      return;
    }
    setIsSubmitting(true);
    const success = await login(selectedAgentId, password);
    if (success) {
      toast({ title: "Login Successful", description: `Welcome, ${selectedAgentDetails?.name}!` });
      router.push('/home');
    } else {
      toast({ variant: "destructive", title: "Login Failed", description: "Invalid credentials. Please try again." });
    }
    setIsSubmitting(false);
  };
  
  if (authIsLoading && !loggedInAgent) { // Show loading only if not yet logged in and auth is resolving
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <LoadingSpinner size={48} />
        <p className="mt-3 text-muted-foreground">Checking authentication...</p>
      </div>
    );
  }
  
  if (loggedInAgent) { // If already logged in (e.g. from localStorage), don't show login form
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
            <p className="text-muted-foreground">Already logged in. Redirecting...</p>
            <LoadingSpinner size={32} className="mt-2"/>
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
          <CardDescription>Please select your profile to continue.</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="agent-select">Select Profile</Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger id="agent-select">
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {PREDEFINED_AGENTS.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedAgentDetails?.requiresPassword && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting || authIsLoading}>
              {isSubmitting || authIsLoading ? <LoadingSpinner size={16} /> : "Login"}
            </Button>
          </CardFooter>
        </form>
      </Card>
       <p className="text-xs text-muted-foreground mt-8">
        &copy; {new Date().getFullYear()} AI_TeleSuite.
      </p>
    </div>
  );
}
