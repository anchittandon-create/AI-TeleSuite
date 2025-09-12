
"use client";

import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Share2, Info, Copy } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import workflowJson from '!!raw-loader!../../../../n8n_workflow.json';


export default function N8nWorkflowPage() {
  const { toast } = useToast();

  const handleDownload = () => {
    try {
        const blob = new Blob([workflowJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'AI_TeleSuite_n8n_Workflow.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast({
            title: "Download Started",
            description: "The n8n workflow JSON file is downloading."
        });
    } catch(err: any) {
        console.error("Failed to download n8n workflow:", err);
        toast({
            variant: "destructive",
            title: "Download Failed",
            description: err.message
        });
    }
  };
  
  const handleCopyJson = () => {
    navigator.clipboard.writeText(workflowJson)
      .then(() => {
        toast({
          title: "JSON Copied!",
          description: "The n8n workflow JSON has been copied to your clipboard.",
        });
      })
      .catch(err => {
        console.error("Failed to copy workflow JSON:", err);
        toast({
          variant: "destructive",
          title: "Copy Failed",
          description: "Could not copy the JSON to your clipboard.",
        });
      });
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="n8n Workflow Exporter" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-6">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
              <Share2 className="mr-3 h-6 w-6 text-primary" />
              Download n8n Workflow
            </CardTitle>
            <CardDescription>
              Download a JSON file containing a full n8n workflow. This workflow represents a machine-readable blueprint of the entire application, including all its files and content.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>How to Use</AlertTitle>
                <AlertDescription>
                    1. Click the button below to download the `AI_TeleSuite_n8n_Workflow.json` file.
                    <br/>
                    2. In your n8n canvas, go to `File` > `Import from File...` and select the downloaded JSON file.
                    <br/>
                    3. The full application blueprint will be imported as a series of connected nodes.
                </AlertDescription>
            </Alert>
            <Button onClick={handleDownload} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Download n8n Workflow JSON
            </Button>
          </CardContent>
        </Card>

        <Card className="w-full max-w-3xl">
            <CardHeader>
                <CardTitle className="text-xl flex items-center">
                    Workflow JSON Content
                </CardTitle>
                <CardDescription>
                    The full JSON content of the n8n workflow is displayed below.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <ScrollArea className="h-96 border rounded-md">
                    <Textarea 
                        readOnly 
                        value={workflowJson}
                        className="h-full min-h-[384px] w-full text-xs p-3 font-mono resize-none border-0 focus-visible:ring-0"
                    />
                </ScrollArea>
                 <Button onClick={handleCopyJson} className="w-full" variant="outline">
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Workflow JSON
                </Button>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
