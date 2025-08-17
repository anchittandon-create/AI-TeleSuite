
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
import globalsCss from '!!raw-loader!../../../app/globals.css';
import nextConfig from '!!raw-loader!../../../../next.config.js';

// --- Import all source files for zipping ---
// AI Flows
import callScoringFlow from '!!raw-loader!../../../ai/flows/call-scoring.ts';
import combinedAnalysisFlow from '!!raw-loader!../../../ai/flows/combined-call-scoring-analysis.ts';
import dataAnalyzerFlow from '!!raw-loader!../../../ai/flows/data-analyzer.ts';
import pitchGeneratorFlow from '!!raw-loader!../../../ai/flows/pitch-generator.ts';
import rebuttalGeneratorFlow from '!!raw-loader!../../../ai/flows/rebuttal-generator.ts';
import transcriptionFlow from '!!raw-loader!../../../ai/flows/transcription-flow.ts';
import trainingDeckFlow from '!!raw-loader!../../../ai/flows/training-deck-generator.ts';
import voiceSalesAgentFlow from '!!raw-loader!../../../ai/flows/voice-sales-agent-flow.ts';
import voiceSupportAgentFlow from '!!raw-loader!../../../ai/flows/voice-support-agent-flow.ts';
import genkitConfig from '!!raw-loader!../../../ai/genkit.ts';
import fullCallAudioFlow from '!!raw-loader!../../../ai/flows/generate-full-call-audio.ts';
import productDescriptionFlow from '!!raw-loader!../../../ai/flows/product-description-generator.ts';

// App pages and layouts
import mainLayout from '!!raw-loader!../layout.tsx';
import rootLayout from '!!raw-loader!../../layout.tsx';
import rootPage from '!!raw-loader!../../page.tsx';
import homePage from '!!raw-loader!../home/page.tsx';
import productsPage from '!!raw-loader!../products/page.tsx';
import pitchGeneratorPage from '!!raw-loader!../pitch-generator/page.tsx';
import rebuttalGeneratorPage from '!!raw-loader!../rebuttal-generator/page.tsx';
import voiceSalesAgentPage from '!!raw-loader!../voice-sales-agent/page.tsx';
import voiceSupportAgentPage from '!!raw-loader!../voice-support-agent/page.tsx';
import transcriptionPage from '!!raw-loader!../transcription/page.tsx';
import callScoringPage from '!!raw-loader!../call-scoring/page.tsx';
import combinedCallAnalysisPage from '!!raw-loader!../combined-call-analysis/page.tsx';
import knowledgeBasePage from '!!raw-loader!../knowledge-base/page.tsx';
import createTrainingDeckPage from '!!raw-loader!../create-training-deck/page.tsx';
import dataAnalysisPage from '!!raw-loader!../data-analysis/page.tsx';
import batchAudioDownloaderPage from '!!raw-loader!../batch-audio-downloader/page.tsx';
import activityDashboardPage from '!!raw-loader!../activity-dashboard/page.tsx';
import transcriptionDashboardPage from '!!raw-loader!../transcription-dashboard/page.tsx';
import callScoringDashboardPage from '!!raw-loader!../call-scoring-dashboard/page.tsx';
import trainingMaterialDashboardPage from '!!raw-loader!../training-material-dashboard/page.tsx';
import dataAnalysisDashboardPage from '!!raw-loader!../data-analysis-dashboard/page.tsx';
import voiceSalesDashboardPage from '!!raw-loader!../voice-sales-dashboard/page.tsx';
import voiceSupportDashboardPage from '!!raw-loader!../voice-support-dashboard/page.tsx';
import ttsApiRoute from '!!raw-loader!../../api/tts/route.ts';
import selfClonePage from '!!raw-loader!./page.tsx'; // Self-reference

// Components
import appSidebar from '!!raw-loader!../../../components/layout/app-sidebar.tsx';
import pageHeader from '!!raw-loader!../../../components/layout/page-header.tsx';

// Hooks
import useActivityLogger from '!!raw-loader!../../../hooks/use-activity-logger.ts';
import useKnowledgeBase from '!!raw-loader!../../../hooks/use-knowledge-base.ts';
import useLocalStorage from '!!raw-loader!../../../hooks/use-local-storage.ts';
import useProductContext from '!!raw-loader!../../../hooks/use-product-context.tsx';
import useUserProfile from '!!raw-loader!../../../hooks/useUserProfile.ts';
import useWhisper from '!!raw-loader!../../../hooks/useWhisper.ts';

// Libs and types
import utils from '!!raw-loader!../../../lib/utils.ts';
import exportLib from '!!raw-loader!../../../lib/export.ts';
import fileUtils from '!!raw-loader!../../../lib/file-utils.ts';
import pdfUtils from '!!raw-loader!../../../lib/pdf-utils.ts';
import typesIndex from '!!raw-loader!../../../types/index.ts';

const filesToZip = [
    // Project Config
    { name: "REPLICATION_PROMPT.md", content: replicationPrompt },
    { name: "PROJECT_DESCRIPTION.md", content: projectDescription },
    { name: "package.json", content: packageJson },
    { name: "tailwind.config.ts", content: tailwindConfig },
    { name: "next.config.js", content: nextConfig },

    // Source Code
    // Root App
    { name: "src/app/layout.tsx", content: rootLayout },
    { name: "src/app/page.tsx", content: rootPage },
    { name: "src/app/globals.css", content: globalsCss },
    { name: "src/app/api/tts/route.ts", content: ttsApiRoute },
    // Main Layout & Components
    { name: "src/app/(main)/layout.tsx", content: mainLayout },
    { name: "src/components/layout/app-sidebar.tsx", content: appSidebar },
    { name: "src/components/layout/page-header.tsx", content: pageHeader },
    // Pages
    { name: "src/app/(main)/home/page.tsx", content: homePage },
    { name: "src/app/(main)/products/page.tsx", content: productsPage },
    { name: "src/app/(main)/pitch-generator/page.tsx", content: pitchGeneratorPage },
    { name: "src/app/(main)/rebuttal-generator/page.tsx", content: rebuttalGeneratorPage },
    { name: "src/app/(main)/voice-sales-agent/page.tsx", content: voiceSalesAgentPage },
    { name: "src/app/(main)/voice-support-agent/page.tsx", content: voiceSupportAgentPage },
    { name: "src/app/(main)/transcription/page.tsx", content: transcriptionPage },
    { name: "src/app/(main)/call-scoring/page.tsx", content: callScoringPage },
    { name: "src/app/(main)/combined-call-analysis/page.tsx", content: combinedCallAnalysisPage },
    { name: "src/app/(main)/knowledge-base/page.tsx", content: knowledgeBasePage },
    { name: "src/app/(main)/create-training-deck/page.tsx", content: createTrainingDeckPage },
    { name: "src/app/(main)/data-analysis/page.tsx", content: dataAnalysisPage },
    { name: "src/app/(main)/batch-audio-downloader/page.tsx", content: batchAudioDownloaderPage },
    { name: "src/app/(main)/clone-app/page.tsx", content: selfClonePage },
    // Dashboards
    { name: "src/app/(main)/activity-dashboard/page.tsx", content: activityDashboardPage },
    { name: "src/app/(main)/transcription-dashboard/page.tsx", content: transcriptionDashboardPage },
    { name: "src/app/(main)/call-scoring-dashboard/page.tsx", content: callScoringDashboardPage },
    { name: "src/app/(main)/training-material-dashboard/page.tsx", content: trainingMaterialDashboardPage },
    { name: "src/app/(main)/data-analysis-dashboard/page.tsx", content: dataAnalysisDashboardPage },
    { name: "src/app/(main)/voice-sales-dashboard/page.tsx", content: voiceSalesDashboardPage },
    { name: "src/app/(main)/voice-support-dashboard/page.tsx", content: voiceSupportDashboardPage },
    // AI Flows
    { name: "src/ai/genkit.ts", content: genkitConfig },
    { name: "src/ai/flows/call-scoring.ts", content: callScoringFlow },
    { name: "src/ai/flows/combined-call-scoring-analysis.ts", content: combinedAnalysisFlow },
    { name: "src/ai/flows/data-analyzer.ts", content: dataAnalyzerFlow },
    { name: "src/ai/flows/pitch-generator.ts", content: pitchGeneratorFlow },
    { name: "src/ai/flows/rebuttal-generator.ts", content: rebuttalGeneratorFlow },
    { name: "src/ai/flows/transcription-flow.ts", content: transcriptionFlow },
    { name: "src/ai/flows/training-deck-generator.ts", content: trainingDeckFlow },
    { name: "src/ai/flows/voice-sales-agent-flow.ts", content: voiceSalesAgentFlow },
    { name: "src/ai/flows/voice-support-agent-flow.ts", content: voiceSupportAgentFlow },
    { name: "src/ai/flows/generate-full-call-audio.ts", content: fullCallAudioFlow },
    { name: "src/ai/flows/product-description-generator.ts", content: productDescriptionFlow },
    // Hooks
    { name: "src/hooks/use-activity-logger.ts", content: useActivityLogger },
    { name: "src/hooks/use-knowledge-base.ts", content: useKnowledgeBase },
    { name: "src/hooks/use-local-storage.ts", content: useLocalStorage },
    { name: "src/hooks/use-product-context.tsx", content: useProductContext },
    { name: "src/hooks/useUserProfile.ts", content: useUserProfile },
    { name: "src/hooks/useWhisper.ts", content: useWhisper },
    // Libs
    { name: "src/lib/utils.ts", content: utils },
    { name: "src/lib/export.ts", content: exportLib },
    { name: "src/lib/file-utils.ts", content: fileUtils },
    { name: "src/lib/pdf-utils.ts", content: pdfUtils },
    // Types
    { name: "src/types/index.ts", content: typesIndex },
];


export default function CloneAppPage() {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleDownloadZip = async () => {
        setIsLoading(true);
        toast({ title: "Processing...", description: "Creating ZIP archive of all project source files." });

        try {
            const zip = new JSZip();
            
            for (const file of filesToZip) {
                zip.file(file.name, file.content);
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = "AI_TeleSuite_Full_Project_Source.zip";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            toast({ title: "Success!", description: "Full project source ZIP archive has been downloaded." });

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
            <PageHeader title="Clone App & Download Source" />
            <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                <Card className="w-full max-w-4xl mx-auto">
                    <CardHeader>
                        <CardTitle className="text-xl">Download Full Project Source</CardTitle>
                        <CardDescription>
                            Download a ZIP archive containing all the source code, configuration, and prompt files needed to replicate this application. This is the most complete snapshot of the project.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleDownloadZip} disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Zipping Project...
                                </>
                            ) : (
                                <>
                                    <DownloadCloud className="mr-2 h-4 w-4" />
                                    Download Full Project as .ZIP
                                </>
                            )}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2">
                            This archive includes the full `src` directory, config files, and detailed replication documents.
                        </p>
                    </CardContent>
                </Card>

                <Card className="w-full max-w-4xl mx-auto">
                    <CardHeader>
                         <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="text-xl">Replication Prompt</CardTitle>
                                <CardDescription>
                                    This is the detailed prompt used to generate the application's initial structure and logic from scratch.
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
