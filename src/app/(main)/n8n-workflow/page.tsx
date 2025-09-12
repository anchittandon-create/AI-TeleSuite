
"use client";

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Workflow, Server } from 'lucide-react';
import Link from 'next/link';

export default function N8nWorkflowPage() {

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
              Click the button below to download a single JSON file compatible with n8n.
              This workflow contains all the application's source code and configuration,
              allowing you to inspect or replicate the entire project structure within n8n.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-lg bg-muted/50">
              <h4 className="font-semibold mb-2 flex items-center">
                <Server className="mr-2 h-5 w-5" />
                How It Works
              </h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>This button links to a dedicated API endpoint that dynamically generates the workflow JSON.</li>
                <li>The server reads all project files and correctly escapes their content into a valid JSON structure.</li>
                <li>This ensures the downloaded file is always valid and can be imported directly into n8n.</li>
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
      </main>
    </div>
  );
}
