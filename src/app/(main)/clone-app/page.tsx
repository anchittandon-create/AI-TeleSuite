"use client";

import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Loader2, Server, FileCode, AlertTriangle, Copy, Bot, FileText, FileArchive, ChevronDown } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { exportPlainTextFile } from '@/lib/export';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Import the raw text content of the replication prompt index.
import replicationPrompt from '!!raw-loader!../../../REPLICATION_PROMPT.md';

export default function CloneAppPage() {
  const [isDownloadingProject, setIsDownloadingProject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDownloadProject = async () => {
    setIsDownloadingProject(true);
    setError(null);
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
      a.download = 'AI_TeleSuite_Clone.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Started",
        description: "Your project clone 'AI_TeleSuite_Clone.zip' is downloading."
      });

    } catch (err: any) {
      console.error("Failed to download project clone:", err);
      setError(err.message);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: err.message
      });
    } finally {
      setIsDownloadingProject(false);
    }
  };
  
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(replicationPrompt)
      .then(() => {
        toast({
          title: "Prompt Index Copied!",
          description: "The main replication prompt index has been copied to your clipboard.",
        });
      })
      .catch(err => {
        console.error("Failed to copy prompt:", err);
        toast({
          variant: "destructive",
          title: "Copy Failed",
          description: "Could not copy the prompt to your clipboard. Please try again.",
        });
      });
  };

  const handleDownloadDoc = (format: 'pdf' | 'doc' | 'txt') => {
    const link = document.createElement('a');
    link.href = `/api/clone-docs?format=${format}`;
    link.download = `AI_TeleSuite_Replication_Docs_${format.toUpperCase()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
     toast({
        title: "Download Started",
        description: `Your documentation ZIP (.${format}) is downloading.`
      });
  };
  
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Clone This Application" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-6">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
              <Server className="mr-3 h-6 w-6 text-primary" />
              Download Full Project Source Code
            </CardTitle>
            <CardDescription>
              Click the button below to download a ZIP archive containing all source code, configuration, and documentation files to replicate this application.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-lg bg-muted/50">
              <h4 className="font-semibold mb-2 flex items-center">
                <FileCode className="mr-2 h-5 w-5" />
                What's Included?
              </h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>All source code from the <strong>/src</strong> directory.</li>
                <li>Core configuration files like <strong>package.json</strong>, <strong>tailwind.config.ts</strong>, etc.</li>
                <li>The complete multi-part replication prompt documentation from <strong>/src/replication</strong>.</li>
              </ul>
            </div>
            <Button onClick={handleDownloadProject} disabled={isDownloadingProject} className="w-full">
              {isDownloadingProject ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing ZIP file...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download Full Project ZIP
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

        <Card className="w-full max-w-3xl">
            <CardHeader>
                <CardTitle className="text-xl flex items-center">
                    <Bot className="mr-3 h-6 w-6 text-primary" />
                    Full Application Replication Prompt
                </CardTitle>
                <CardDescription>
                    This application's replication specification is broken into multiple documentation files for reliability. You can copy the main index file below, or use the download options.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <ScrollArea className="h-72 border rounded-md">
                    <Textarea 
                        readOnly 
                        value={replicationPrompt}
                        className="h-full min-h-[288px] w-full text-xs p-3 font-mono resize-none border-0 focus-visible:ring-0"
                    />
                </ScrollArea>
                 <div className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={handleCopyPrompt} className="flex-1">
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Prompt Index
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="secondary" className="flex-1">
                              <FileArchive className="mr-2 h-4 w-4" />
                              Download Documentation ZIP
                              <ChevronDown className="ml-2 h-4 w-4" />
                          </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                         <DropdownMenuItem onClick={() => handleDownloadDoc('pdf')}>
                           <FileText className="mr-2 h-4 w-4"/> As PDF Files
                         </DropdownMenuItem>
                         <DropdownMenuItem onClick={() => handleDownloadDoc('doc')}>
                           <FileText className="mr-2 h-4 w-4"/> As Word Files (.doc)
                         </DropdownMenuItem>
                         <DropdownMenuItem onClick={() => handleDownloadDoc('txt')}>
                           <FileText className="mr-2 h-4 w-4"/> As Text Files (.txt)
                         </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
