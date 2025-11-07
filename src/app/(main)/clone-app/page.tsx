"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Download, Loader2, Server, Bot, Copy, FileText, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { exportPlainTextFile } from '@/lib/export';

async function fetchMasterPrompt(): Promise<string> {
    const response = await fetch('/api/clone-docs');
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to parse error from server." }));
        throw new Error(errorData.error || `Server responded with ${response.status}`);
    }
    const files: Array<{ path: string; content: string }> = await response.json();
    
    // Find and prioritize the main orchestrator prompt
    const mainPromptFile = files.find(f => f.path.endsWith('REPLICATION_PROMPT.md'));
    
    if (!mainPromptFile) {
        throw new Error("Master replication prompt file (REPLICATION_PROMPT.md) was not found on the server.");
    }
    
    // The API now only serves the single, definitive prompt, so we just return its content.
    return mainPromptFile.content;
}


export default function CloneAppPage() {
  const [isDownloadingProject, setIsDownloadingProject] = useState(false);
  const [isFetchingPrompt, setIsFetchingPrompt] = useState(true);
  const [masterPrompt, setMasterPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    fetchMasterPrompt()
      .then(content => setMasterPrompt(content))
      .catch((err: unknown) => {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error("Failed to fetch master prompt:", err);
          setError(`Failed to load master prompt: ${errorMessage}`);
      })
      .finally(() => setIsFetchingPrompt(false));
  }, []);

  const handleDownloadProject = async () => {
    setIsDownloadingProject(true);
    setError(null);
    try {
      const response = await fetch('/api/clone-app');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server responded with ${response.status}.`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'AI_TeleSuite_Clone.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Download Started", description: "Your project source code 'AI_TeleSuite_Clone.zip' is downloading." });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      toast({ variant: "destructive", title: "Project Download Failed", description: errorMessage });
    } finally {
      setIsDownloadingProject(false);
    }
  };

  const handleCopyPrompt = () => {
    if (!masterPrompt) return;
    navigator.clipboard.writeText(masterPrompt)
      .then(() => toast({ title: "Prompt Copied!", description: "The master replication prompt has been copied to your clipboard." }))
      .catch(() => toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy the prompt." }));
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Clone This Application" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-6">
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
              <Server className="mr-3 h-6 w-6 text-primary" />
              Download Full Project Source Code
            </CardTitle>
            <CardDescription>
              Click the button below to download a ZIP archive containing the complete source code for this application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleDownloadProject} disabled={isDownloadingProject} className="w-full">
              {isDownloadingProject ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Zipping Project...</>
              ) : (
                <><Download className="mr-2 h-4 w-4" /> Download Project ZIP</>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
              <Bot className="mr-3 h-6 w-6 text-primary" />
              Master Replication Prompt (v1.1)
            </CardTitle>
            <CardDescription>
              Use this comprehensive prompt to have an AI agent replicate this application from scratch. It contains the full specification.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80 border rounded-md bg-muted/30">
              <Textarea 
                readOnly
                value={isFetchingPrompt ? "Loading master prompt..." : (error || masterPrompt)}
                className="h-full min-h-[320px] w-full text-xs p-3 font-mono resize-none border-0 focus-visible:ring-0"
              />
            </ScrollArea>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCopyPrompt} disabled={isFetchingPrompt || !!error}>
                <Copy className="mr-2 h-4 w-4" /> Copy Prompt
            </Button>
             <Button onClick={() => exportPlainTextFile("AI_TeleSuite_Master_Replication_Prompt.txt", masterPrompt)} disabled={isFetchingPrompt || !!error}>
                <FileText className="mr-2 h-4 w-4" /> Download Prompt (.txt)
            </Button>
          </CardFooter>
        </Card>
        
        {error && (
            <Alert variant="destructive" className="mt-4 w-full max-w-4xl">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

      </main>
    </div>
  );
}
