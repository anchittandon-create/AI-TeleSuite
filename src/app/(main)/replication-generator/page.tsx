"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Download, Loader2, Bot, Copy, FileText, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { exportPlainTextFile } from '@/lib/export';

// We import the raw markdown as a string.
// The raw-loader configured in next.config.js makes this possible.
import replicationPromptContent from '!!raw-loader!../../../../REPLICATION_PROMPT.md';

export default function ReplicationPromptGeneratorPage() {
  const [isFetchingPrompt, setIsFetchingPrompt] = useState(true);
  const [masterPrompt, setMasterPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    if (replicationPromptContent) {
        setMasterPrompt(replicationPromptContent);
    } else {
        setError("Failed to load the master replication prompt content.");
    }
    setIsFetchingPrompt(false);
  }, []);


  const handleCopyPrompt = () => {
    if (!masterPrompt) return;
    navigator.clipboard.writeText(masterPrompt)
      .then(() => toast({ title: "Prompt Copied!", description: "The master replication prompt has been copied to your clipboard." }))
      .catch(() => toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy the prompt." }));
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Replication Prompt Generator" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-6">
        
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
              <Bot className="mr-3 h-6 w-6 text-primary" />
              Master Replication Prompt
            </CardTitle>
            <CardDescription>
              Use this comprehensive prompt to have an AI agent like Google's Gemini in AI Studio replicate this application from scratch. It contains the full specification for every feature.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96 border rounded-md bg-muted/30">
              <Textarea 
                readOnly
                value={isFetchingPrompt ? "Loading master prompt..." : (error || masterPrompt)}
                className="h-full min-h-[384px] w-full text-xs p-3 font-mono resize-none border-0 focus-visible:ring-0"
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
