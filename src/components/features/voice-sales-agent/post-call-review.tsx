
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
    const [isScoringPostCall, setIsScoringPostCall] = useState(false);
    const { getProductByName } = useProductContext();
    const { files: knowledgeBaseFiles } = useKnowledgeBase();
    const { activities, updateActivity } = useActivityLogger();
    const { toast } = useToast();

    const handleScorePostCall = useCallback(async (transcript: string) => {
        if (!transcript || !product) return;
        setIsScoringPostCall(true);
        setArtifacts(prev => prev ? { ...prev, score: undefined } : { transcript });
        
        try {
            const productData = getProductByName(product);
            if(!productData) throw new Error("Product details not found for scoring.");
            
            const productContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, productData);
    
            const scoreOutput = await scoreCall({ product: product as Product, agentName, transcriptOverride: transcript, productContext });
    
            setArtifacts(prev => prev ? { ...prev, score: scoreOutput } : null);
            
            // Find the most recent activity for this module and update it
            const lastCallActivity = [...activities].reverse().find(a => a.module === 'Browser Voice Agent' && a.details.status === 'Completed');
            
            if (lastCallActivity) {
              updateActivity(lastCallActivity.id, { ...lastCallActivity.details, finalScore: scoreOutput });
            }
            toast({ title: "Scoring Complete!", description: "The call has been scored successfully."});
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Scoring Failed", description: e.message });
        } finally {
            setIsScoringPostCall(false);
        }
      }, [product, getProductByName, knowledgeBaseFiles, agentName, activities, updateActivity, toast]);

    return (
        <Card className="w-full max-w-4xl mx-auto mt-4">
            <CardHeader>
                <CardTitle>Call Review & Scoring</CardTitle>
                <CardDescription>Review the completed call transcript and score the interaction.</CardDescription>
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
                       <pre className="text-xs whitespace-pre-wrap break-words font-mono">
                         {artifacts.transcript}
                       </pre>
                    </ScrollArea>
                     <div className="mt-2 flex gap-2">
                         <Button variant="outline" size="xs" onClick={() => exportPlainTextFile(`SalesCall_${userName || 'User'}_transcript.txt`, artifacts.transcript)}><Download className="mr-1 h-3"/>Download .txt</Button>
                     </div>
                </div>
                <Separator/>
                {isScoringPostCall && !artifacts.score && (
                     <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin"/> Scoring in progress...
                     </div>
                )}
                {artifacts.score ? (
                    <div className="space-y-2">
                        <h4 className="text-md font-semibold">Call Scoring Report</h4>
                        <CallScoringResultsCard results={artifacts.score} fileName={`Simulated Call - ${userName}`} agentName={agentName} product={product as Product} isHistoricalView={true}/>
                    </div>
                ) : (
                    <Button onClick={() => handleScorePostCall(artifacts.transcript)} disabled={isScoringPostCall || !artifacts.transcript}>
                        {isScoringPostCall ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Star className="mr-2 h-4 w-4"/>}
                        {isScoringPostCall ? 'Scoring...' : 'Score Call'}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

