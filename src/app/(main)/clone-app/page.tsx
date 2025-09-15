"use client";

import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Loader2, Server, FileCode, AlertTriangle, Bot } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

export default function CloneAppPage() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDownloadMasterPrompt = async () => {
    setIsDownloading(true);
    setError(null);
    toast({ title: "Generating Master Prompt...", description: "Consolidating all documentation files into a single prompt..." });
    try {
      const response = await fetch('/api/clone-app');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to download. Server responded with ${response.status}.`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'AI_TeleSuite_Master_Replication_Prompt.txt';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Started",
        description: "Your master replication prompt 'AI_TeleSuite_Master_Replication_Prompt.txt' is downloading."
      });

    } catch (err: any) {
      console.error("Failed to download master prompt:", err);
      setError(err.message);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: err.message
      });
    } finally {
      setIsDownloading(false);
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Clone This Application" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-6">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
              <Bot className="mr-3 h-6 w-6 text-primary" />
              Download Full Application Replication Prompt
            </CardTitle>
            <CardDescription>
              Click the button below to download a single, comprehensive text file containing the complete, feature-by-feature specification to replicate this entire application.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-lg bg-muted/50">
              <h4 className="font-semibold mb-2 flex items-center">
                <FileCode className="mr-2 h-5 w-5" />
                What's Included?
              </h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>A master orchestrator prompt.</li>
                <li>The full, multi-part specification detailing every feature, UI component, AI flow, and configuration file.</li>
                <li>All content is consolidated into one single, easy-to-use `.txt` file.</li>
              </ul>
            </div>
            <Button onClick={handleDownloadMasterPrompt} disabled={isDownloading} className="w-full">
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Master Prompt File...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download Single Master Prompt (.txt)
                </>
              )}
            </Button>
            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}