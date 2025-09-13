
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Workflow, Server, Copy } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

// We import the raw JSON as a string.
// The raw-loader configured in next.config.js makes this possible.
import workflowJson from '!!raw-loader!../../../../n8n_workflow.json';

export default function N8nWorkflowPage() {
    const { toast } = useToast();
    const [workflowContent, setWorkflowContent] = useState("Loading workflow...");

    useEffect(() => {
        try {
            // Since the import is now a string of JSON, we parse and then stringify
            // it with formatting for display.
            const parsedJson = JSON.parse(workflowJson);
            setWorkflowContent(JSON.stringify(parsedJson, null, 2));
        } catch (e) {
            console.error("Failed to parse n8n workflow JSON:", e);
            setWorkflowContent("Error: Could not load or parse the n8n workflow JSON file. It may be malformed.");
        }
    }, []);

    const handleCopyJson = () => {
        if (workflowContent.startsWith("Error:")) {
            toast({
                variant: "destructive",
                title: "Copy Failed",
                description: "Cannot copy content because the workflow file failed to load."
            });
            return;
        }
        navigator.clipboard.writeText(workflowContent)
          .then(() => {
            toast({
              title: "Workflow Copied!",
              description: "The n8n workflow JSON has been copied to your clipboard.",
            });
          })
          .catch(err => {
            console.error("Failed to copy workflow:", err);
            toast({
              variant: "destructive",
              title: "Copy Failed",
              description: "Could not copy the workflow to your clipboard.",
            });
          });
    };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="n8n Workflow" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-6">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
              <Workflow className="mr-3 h-6 w-6 text-primary" />
              Download n8n Workflow
            </CardTitle>
            <CardDescription>
              Click the button below to download the n8n workflow JSON file. This file can be imported into your n8n instance to replicate the application's structure.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-lg bg-muted/50">
              <h4 className="font-semibold mb-2 flex items-center">
                <Server className="mr-2 h-5 w-5" />
                How It Works
              </h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>This button links to a dynamically generated workflow via an API endpoint.</li>
                <li>The server reads all project files and serializes them into a valid JSON structure for n8n.</li>
                <li>This ensures the downloaded file is always a valid and importable n8n workflow.</li>
              </ul>
            </div>
            <Link href="/api/n8n-workflow" passHref legacyBehavior>
                <a download="AI_TeleSuite_n8n_Workflow.json">
                    <Button className="w-full">
                        <Download className="mr-2 h-4 w-4" />
                        Download n8n Workflow JSON
                    </Button>
                </a>
            </Link>
          </CardContent>
        </Card>

        <Card className="w-full max-w-3xl">
            <CardHeader>
                <CardTitle className="text-xl flex items-center">
                   Workflow JSON Content
                </CardTitle>
                <CardDescription>
                    Below is the content of the n8n workflow file. You can review it or copy it directly.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <ScrollArea className="h-96 border rounded-md">
                    <Textarea 
                        readOnly 
                        value={workflowContent}
                        className="h-full min-h-[384px] w-full text-xs p-3 font-mono resize-none border-0 focus-visible:ring-0"
                    />
                </ScrollArea>
                 <Button onClick={handleCopyJson} className="w-full">
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Workflow JSON
                </Button>
            </CardContent>
        </Card>

      </main>
    </div>
  );
}
