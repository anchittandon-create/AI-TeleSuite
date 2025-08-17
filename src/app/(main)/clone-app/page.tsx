
"use client";

import React, { useState } from 'react';
import JSZip from 'jszip';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Download, Copy, GitBranch } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

// Directly import the content of the markdown and other relevant files
import replicationPrompt from '!!raw-loader!../../../REPLICATION_PROMPT.md';
import projectDescription from '!!raw-loader!../../../PROJECT_DESCRIPTION.md';
import packageJson from '!!raw-loader!../../../../package.json';
import tailwindConfig from '!!raw-loader!../../../../tailwind.config.ts';
import globalsCss from '!!raw-loader!../../globals.css';
import nextConfig from '!!raw-loader!../../../../next.config.js';


// --- Import all source files for zipping ---
// AI Flows
import callScoringFlow from '!!raw-loader!../../../ai/flows/call-scoring.ts';
import combinedAnalysisFlow from '!!raw-loader!../../../ai/flows/combined-call-scoring-analysis.ts';
import dataAnalyzerFlow from '!!raw-loader!../../../ai/flows/data-analyzer.ts';
import pitchGeneratorFlow from '!!raw-loader!../../../ai/flows/pitch-generator.ts';
import productDescGeneratorFlow from '!!raw-loader!../../../ai/flows/product-description-generator.ts';
import rebuttalGeneratorFlow from '!!raw-loader!../../../ai/flows/rebuttal-generator.ts';
import ttsFlow from '!!raw-loader!../../../ai/flows/speech-synthesis-flow.ts';
import trainingDeckGeneratorFlow from '!!raw-loader!../../../ai/flows/training-deck-generator.ts';
import transcriptionFlow from '!!raw-loader!../../../ai/flows/transcription-flow.ts';
import voiceSalesAgentFlow from '!!raw-loader!../../../ai/flows/voice-sales-agent-flow.ts';
import voiceSupportAgentFlow from '!!raw-loader!../../../ai/flows/voice-support-agent-flow.ts';
import genkitConfig from '!!raw-loader!../../../ai/genkit.ts';
import genkitDev from '!!raw-loader!../../../ai/dev.ts';
import generateFullCallAudioFlow from '!!raw-loader!../../../ai/flows/generate-full-call-audio.ts';


// App pages and layouts
import mainLayout from '!!raw-loader!../layout.tsx';
import rootLayout from '!!raw-loader!../../layout.tsx';
import rootPage from '!!raw-loader!../../page.tsx';
import homePage from '!!raw-loader!../home/page.tsx';
import productsPage from '!!raw-loader!../products/page.tsx';
import pitchGeneratorPage from '!!raw-loader!../pitch-generator/page.tsx';
import rebuttalGeneratorPage from '!!raw-loader!../rebuttal-generator/page.tsx';
import voiceSalesAgentPage from '!!raw-loader!../voice-sales-agent/page.tsx';
import voiceSalesDashboardPage from '!!raw-loader!../voice-sales-dashboard/page.tsx';
import voiceSupportAgentPage from '!!raw-loader!../voice-support-agent/page.tsx';
import voiceSupportDashboardPage from '!!raw-loader!../voice-support-dashboard/page.tsx';
import transcriptionPage from '!!raw-loader!../transcription/page.tsx';
import callScoringPage from '!!raw-loader!../call-scoring/page.tsx';
import combinedCallAnalysisPage from '!!raw-loader!../combined-call-analysis/page.tsx';
import knowledgeBasePage from '!!raw-loader!../knowledge-base/page.tsx';
import createTrainingDeckPage from '!!raw-loader!../create-training-deck/page.tsx';
import batchAudioDownloaderPage from '!!raw-loader!../batch-audio-downloader/page.tsx';
import dataAnalysisPage from '!!raw-loader!../data-analysis/page.tsx';
import activityDashboardPage from '!!raw-loader!../activity-dashboard/page.tsx';
import callScoringDashboardPage from '!!raw-loader!../call-scoring-dashboard/page.tsx';
import dataAnalysisDashboardPage from '!!raw-loader!../data-analysis-dashboard/page.tsx';
import trainingMaterialDashboardPage from '!!raw-loader!../training-material-dashboard/page.tsx';
import transcriptionDashboardPage from '!!raw-loader!../transcription-dashboard/page.tsx';
import ttsApiRoute from '!!raw-loader!../../api/tts/route.ts';
import selfClonePage from '!!raw-loader!./page.tsx'; // Self-reference

// Components
import appSidebar from '!!raw-loader!../../../components/layout/app-sidebar.tsx';
import pageHeader from '!!raw-loader!../../../components/layout/page-header.tsx';

// Hooks
import useActivityLogger from '!!raw-loader!../../../hooks/use-activity-logger.ts';
import useKnowledgeBase from '!!raw-loader!../../../hooks/use-knowledge-base.ts';
import useLocalStorage from '!!raw-loader!../../../hooks/use-local-storage.ts';
import useProductContext from '!!raw-loader!../../../hooks/useProductContext.tsx';
import useUserProfile from '!!raw-loader!../../../hooks/useUserProfile.ts';
import useWhisper from '!!raw-loader!../../../hooks/useWhisper.ts';
import useSpeechSynthesis from '!!raw-loader!../../../hooks/useSpeechSynthesis.ts';


// Libs
import libUtils from '!!raw-loader!../../../lib/utils.ts';
import libExport from '!!raw-loader!../../../lib/export.ts';
import libPdfUtils from '!!raw-loader!../../../lib/pdf-utils.ts';
import libFileUtils from '!!raw-loader!../../../lib/file-utils.ts';

// Types
import typesIndex from '!!raw-loader!../../../types/index.ts';


export default function CloneAppPage() {
    const { toast } = useToast();

    const handleCopyPrompt = () => {
        navigator.clipboard.writeText(replicationPrompt)
            .then(() => toast({ title: "Success", description: "Replication prompt copied to clipboard!" }))
            .catch(() => toast({ variant: "destructive", title: "Error", description: "Failed to copy prompt." }));
    };

    const handleDownloadZip = async () => {
        try {
            const zip = new JSZip();

            // Add project descriptor files
            zip.file("REPLICATION_PROMPT.md", replicationPrompt);
            zip.file("PROJECT_DESCRIPTION.md", projectDescription);
            zip.file("package.json", packageJson);
            zip.file("tailwind.config.ts", tailwindConfig);
            zip.file("next.config.js", nextConfig);

            // Add src directory structure
            const src = zip.folder("src");
            if (!src) return;

            // src/app
            const app = src.folder("app");
            if (app) {
                app.file("globals.css", globalsCss);
                app.file("layout.tsx", rootLayout);
                app.file("page.tsx", rootPage);

                const main = app.folder("(main)");
                if (main) {
                    main.file("layout.tsx", mainLayout);
                    main.folder("home")?.file("page.tsx", homePage);
                    main.folder("products")?.file("page.tsx", productsPage);
                    main.folder("pitch-generator")?.file("page.tsx", pitchGeneratorPage);
                    main.folder("rebuttal-generator")?.file("page.tsx", rebuttalGeneratorPage);
                    main.folder("voice-sales-agent")?.file("page.tsx", voiceSalesAgentPage);
                    main.folder("voice-sales-dashboard")?.file("page.tsx", voiceSalesDashboardPage);
                    main.folder("voice-support-agent")?.file("page.tsx", voiceSupportAgentPage);
                    main.folder("voice-support-dashboard")?.file("page.tsx", voiceSupportDashboardPage);
                    main.folder("transcription")?.file("page.tsx", transcriptionPage);
                    main.folder("call-scoring")?.file("page.tsx", callScoringPage);
                    main.folder("combined-call-analysis")?.file("page.tsx", combinedCallAnalysisPage);
                    main.folder("knowledge-base")?.file("page.tsx", knowledgeBasePage);
                    main.folder("create-training-deck")?.file("page.tsx", createTrainingDeckPage);
                    main.folder("batch-audio-downloader")?.file("page.tsx", batchAudioDownloaderPage);
                    main.folder("data-analysis")?.file("page.tsx", dataAnalysisPage);
                    main.folder("clone-app")?.file("page.tsx", selfClonePage);
                    main.folder("activity-dashboard")?.file("page.tsx", activityDashboardPage);
                    main.folder("call-scoring-dashboard")?.file("page.tsx", callScoringDashboardPage);
                    main.folder("data-analysis-dashboard")?.file("page.tsx", dataAnalysisDashboardPage);
                    main.folder("training-material-dashboard")?.file("page.tsx", trainingMaterialDashboardPage);
                    main.folder("transcription-dashboard")?.file("page.tsx", transcriptionDashboardPage);
                }

                const api = app.folder("api");
                api?.folder("tts")?.file("route.ts", ttsApiRoute);
            }
            
            // src/ai
            const ai = src.folder("ai");
            if (ai) {
                ai.file("genkit.ts", genkitConfig);
                ai.file("dev.ts", genkitDev);
                const flows = ai.folder("flows");
                if (flows) {
                    flows.file("call-scoring.ts", callScoringFlow);
                    flows.file("combined-call-scoring-analysis.ts", combinedAnalysisFlow);
                    flows.file("data-analyzer.ts", dataAnalyzerFlow);
                    flows.file("pitch-generator.ts", pitchGeneratorFlow);
                    flows.file("product-description-generator.ts", productDescGeneratorFlow);
                    flows.file("rebuttal-generator.ts", rebuttalGeneratorFlow);
                    flows.file("speech-synthesis-flow.ts", ttsFlow);
                    flows.file("training-deck-generator.ts", trainingDeckGeneratorFlow);
                    flows.file("transcription-flow.ts", transcriptionFlow);
                    flows.file("voice-sales-agent-flow.ts", voiceSalesAgentFlow);
                    flows.file("voice-support-agent-flow.ts", voiceSupportAgentFlow);
                    flows.file("generate-full-call-audio.ts", generateFullCallAudioFlow);
                }
            }

            // src/components
            const components = src.folder("components");
            if (components) {
                const layout = components.folder("layout");
                layout?.file("app-sidebar.tsx", appSidebar);
                layout?.file("page-header.tsx", pageHeader);
            }
            
            // src/hooks
            const hooks = src.folder("hooks");
            if(hooks) {
                hooks.file("use-activity-logger.ts", useActivityLogger);
                hooks.file("use-knowledge-base.ts", useKnowledgeBase);
                hooks.file("use-local-storage.ts", useLocalStorage);
                hooks.file("useProductContext.tsx", useProductContext);
                hooks.file("useUserProfile.ts", useUserProfile);
                hooks.file("useWhisper.ts", useWhisper);
                hooks.file("useSpeechSynthesis.ts", useSpeechSynthesis);
            }

            // src/lib
            const lib = src.folder("lib");
            if (lib) {
                lib.file("utils.ts", libUtils);
                lib.file("export.ts", libExport);
                lib.file("pdf-utils.ts", libPdfUtils);
                lib.file("file-utils.ts", libFileUtils);
            }
            
            // src/types
            src.folder("types")?.file("index.ts", typesIndex);


            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = "AI_TeleSuite_Clone.zip";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            toast({ title: "Download Started", description: "Your app clone ZIP file is being downloaded." });
        } catch (error) {
            console.error("ZIP Generation Error:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to create ZIP file." });
        }
    };

    return (
        <div className="flex flex-col h-full">
            <PageHeader title="Clone This Application" />
            <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-6">
                <Card className="w-full max-w-3xl">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center">
                            <GitBranch className="mr-3 h-6 w-6 text-primary" />
                            Application Replication Prompt
                        </CardTitle>
                        <CardDescription>
                            This is the detailed prompt used to generate the AI_TeleSuite application from scratch. You can use it as a reference or with another AI coding agent to replicate this project.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-96 border rounded-md p-4 bg-muted/50">
                            <pre className="text-xs whitespace-pre-wrap font-mono">{replicationPrompt}</pre>
                        </ScrollArea>
                        <div className="mt-4 flex gap-2">
                            <Button onClick={handleCopyPrompt}>
                                <Copy className="mr-2 h-4 w-4" /> Copy Prompt
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="w-full max-w-3xl">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center">
                            <Download className="mr-3 h-6 w-6 text-primary" />
                            Download Project Files
                        </CardTitle>
                        <CardDescription>
                            Download a ZIP archive containing the core configuration files, the replication prompt, and key source code files for this application.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleDownloadZip}>
                            Download AI_TeleSuite_Clone.zip
                        </Button>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
