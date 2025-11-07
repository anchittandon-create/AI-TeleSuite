
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { CallScoringResultsCard } from '@/components/features/call-scoring/call-scoring-results-card';
import { exportPlainTextFile, downloadDataUriFile } from '@/lib/export';
import { TranscriptDisplay } from '../transcription/transcript-display';

import {
    Product,
    ScoreCallOutput,
    KnowledgeFile,
    ProductObject
} from '@/types';

import { Loader2, FileAudio, Download } from 'lucide-react';


const _prepareKnowledgeBaseContext = (
  knowledgeBaseFiles: KnowledgeFile[],
  productObject: ProductObject,
): string => {
  if (!productObject) {
    return "No product information available.";
  }
    const MAX_CONTEXT_LENGTH = 30000;
    let combinedContext = `--- START OF KNOWLEDGE BASE CONTEXT FOR PRODUCT: ${productObject.displayName} ---\n`;
    combinedContext += `Brand Name: ${productObject.brandName || 'Not provided'}\n`;
    combinedContext += "--------------------------------------------------\n\n";

    const productSpecificFiles = knowledgeBaseFiles.filter(f => f.product === productObject.name);

    for (const file of productSpecificFiles) {
        if (file.isTextEntry && file.textContent) {
            const itemContext = `\n--- Item: ${file.name} (Category: ${file.category || 'General'})\nContent:\n${file.textContent}\n---`;
             if (combinedContext.length + itemContext.length <= MAX_CONTEXT_LENGTH) {
                combinedContext += itemContext;
            }
        }
    }
    
    if (productSpecificFiles.length === 0) {
        combinedContext += "No specific knowledge base files or text entries were found for this product.\n";
    }

    if(combinedContext.length >= MAX_CONTEXT_LENGTH) {
      console.warn("Knowledge base context truncated due to length limit.");
    }

    combinedContext += `--- END OF KNOWLEDGE BASE CONTEXT ---`;
    return combinedContext.substring(0, MAX_CONTEXT_LENGTH);
};


export interface PostCallReviewProps {
    artifacts: { transcript: string; transcriptAccuracy?: string; audioUri?: string; score?: ScoreCallOutput };
    agentName: string;
    userName: string;
    product: Product;
}

export function PostCallReview({ artifacts, agentName, userName, product }: PostCallReviewProps) {
    const isScoring = !artifacts.score;

    return (
        <Card className="w-full max-w-4xl mx-auto mt-4">
            <CardHeader>
                <CardTitle>Call Review & Scoring</CardTitle>
                <CardDescription>Review the completed call transcript and the automatically generated score.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {artifacts.audioUri && (
                     <div>
                        <Label htmlFor="final-audio">Full Call Recording</Label>
                        <audio id="final-audio" controls src={artifacts.audioUri} className="w-full mt-1 h-10">Your browser does not support the audio element.</audio>
                         <div className="mt-2 flex gap-2">
                             <Button variant="outline" size="xs" onClick={() => void downloadDataUriFile(artifacts.audioUri!, `FullCall_${userName || 'User'}.wav`)}><FileAudio className="mr-1 h-3"/>Download Recording</Button>
                         </div>
                    </div>
                )}
                <div>
                    <Label htmlFor="final-transcript">Full Transcript</Label>
                    <ScrollArea className="h-40 mt-1 border rounded-md p-3">
                       <TranscriptDisplay transcript={artifacts.transcript} />
                    </ScrollArea>
                    {artifacts.transcriptAccuracy && (
                      <p className="text-xs text-muted-foreground mt-2">Transcript accuracy estimate: {artifacts.transcriptAccuracy}</p>
                    )}
                     <div className="mt-2 flex gap-2">
                         <Button variant="outline" size="xs" onClick={() => exportPlainTextFile(`SalesCall_${userName || 'User'}_transcript.txt`, artifacts.transcript)}><Download className="mr-1 h-3"/>Download .txt</Button>
                     </div>
                </div>
                <Separator/>
                {isScoring && !artifacts.score && (
                     <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin"/> Scoring in progress...
                     </div>
                )}
                {artifacts.score && (
                    <div className="space-y-2">
                        <h4 className="text-md font-semibold">Call Scoring Report</h4>
                        <CallScoringResultsCard results={artifacts.score} fileName={`Simulated Call - ${userName}`} agentName={agentName} product={product} isHistoricalView={true}/>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
