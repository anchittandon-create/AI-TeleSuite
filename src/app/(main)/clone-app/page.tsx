
"use client";

import React, { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DownloadCloud, Loader2, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import JSZip from 'jszip';

// Directly import the content of the markdown and other relevant files
import replicationPrompt from '!!raw-loader!../../../REPLICATION_PROMPT.md';
import projectDescription from '!!raw-loader!../../../PROJECT_DESCRIPTION.md';
import packageJson from '!!raw-loader!../../../../package.json';
import tailwindConfig from '!!raw-loader!../../../../tailwind.config.ts';
import globalsCss from '!!raw-loader!../../globals.css';
import nextConfig from '!!raw-loader!../../../../next.config.js';


const filesToZip = [
    { name: "REPLICATION_PROMPT.md", content: replicationPrompt },
    { name: "PROJECT_DESCRIPTION.md", content: projectDescription },
    { name: "package.json", content: packageJson },
    { name: "tailwind.config.ts", content: tailwindConfig },
    { name: "src/app/globals.css", content: globalsCss },
    { name: "next.config.js", content: nextConfig },
];


export default function CloneAppPage() {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleDownloadZip = async () => {
        setIsLoading(true);
        toast({ title: "Processing...", description: "Creating ZIP archive of core project files." });

        try {
            const zip = new JSZip();
            
            for (const file of filesToZip) {
                zip.file(file.name, file.content);
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = "AI_TeleSuite_Core_Files.zip";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            toast({ title: "Success!", description: "Core project files ZIP archive has been downloaded." });

        } catch (error) {
            console.error("Failed to create or download ZIP file", error);
            toast({
                variant: "destructive",
                title: "Error Creating ZIP",
                description: `There was an issue creating the ZIP file. ${error instanceof Error ? error.message : ''}`,
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleCopyToClipboard = () => {
        navigator.clipboard.writeText(replicationPrompt)
            .then(() => toast({ title: "Success", description: "Replication prompt copied to clipboard!" }))
            .catch((err) => toast({ variant: "destructive", title: "Error", description: "Failed to copy prompt." }));
    };


    return (
        <div className="flex flex-col h-full">
            <PageHeader title="Clone App Prompt & Core Files" />
            <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                <Card className="w-full max-w-4xl mx-auto">
                    <CardHeader>
                        <CardTitle className="text-xl">Download Core Project Files</CardTitle>
                        <CardDescription>
                            Download a ZIP archive containing the core configuration and prompt files needed to replicate this application.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleDownloadZip} disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Zipping Files...
                                </>
                            ) : (
                                <>
                                    <DownloadCloud className="mr-2 h-4 w-4" />
                                    Download Core Files as .ZIP
                                </>
                            )}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2">
                            This archive includes: REPLICATION_PROMPT.md, PROJECT_DESCRIPTION.md, package.json, tailwind.config.ts, globals.css, and next.config.js.
                        </p>
                    </CardContent>
                </Card>

                <Card className="w-full max-w-4xl mx-auto">
                    <CardHeader>
                         <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="text-xl">Replication Prompt</CardTitle>
                                <CardDescription>
                                    This is the detailed prompt used to generate the application from scratch.
                                </CardDescription>
                            </div>
                            <Button variant="outline" onClick={handleCopyToClipboard}><Copy className="mr-2 h-4 w-4"/>Copy Prompt</Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[60vh] border rounded-md p-4 bg-muted/20">
                            <pre className="text-sm whitespace-pre-wrap font-sans">{replicationPrompt}</pre>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
