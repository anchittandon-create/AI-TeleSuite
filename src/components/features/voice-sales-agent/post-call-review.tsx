
"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { useProductContext } from '@/hooks/useProductContext';
import { CallScoringResultsCard } from '@/components/features/call-scoring/call-scoring-results-card';
import { scoreCall } from '@/ai/flows/call-scoring';
import { exportPlainTextFile, downloadDataUriFile } from '@/lib/export';
import { TranscriptDisplay } from '../transcription/transcript-display';

import {
    Product,
    ScoreCallOutput,
    KnowledgeFile,
    ProductObject
} from '@/types';

import { Loader2, Star, FileAudio, Download } from 'lucide-react';


const prepareKnowledgeBaseContext = (
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
            let itemContext = `\n--- Item: ${file.name} (Category: ${file.category || 'General'})\nContent:\n${file.textContent}\n---`;
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
    artifacts: { transcript: string, audioUri?: string, score?: ScoreCallOutput };
    agentName: string;
    userName: string;
    product: Product;
}

export function PostCallReview({ artifacts: initialArtifacts, agentName, userName, product }: PostCallReviewProps) {
    const [artifacts, setArtifacts] = useState(initialArtifacts);
    const isScoring = !initialArtifacts.score; // If no score is passed initially, we are in a scoring state.
    
    // The parent component now triggers scoring and passes the score down.
    // This component is now primarily for display.

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
                             <Button variant="outline" size="xs" onClick={() => downloadDataUriFile(artifacts.audioUri!, `FullCall_${userName || 'User'}.wav`)}><FileAudio className="mr-1 h-3"/>Download Recording</Button>
                         </div>
                    </div>
                )}
                <div>
                    <Label htmlFor="final-transcript">Full Transcript</Label>
                    <ScrollArea className="h-40 mt-1 border rounded-md p-3">
                       <TranscriptDisplay transcript={artifacts.transcript} />
                    </ScrollArea>
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
                        <CallScoringResultsCard results={artifacts.score} fileName={`Simulated Call - ${userName}`} agentName={agentName} product={product as Product} isHistoricalView={true}/>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}


