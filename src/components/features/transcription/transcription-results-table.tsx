"use client";

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from '@/hooks/use-toast';
import { exportPlainTextFile, downloadDataUriFile } from '@/lib/export';
import { exportTextContentToPdf } from '@/lib/pdf-utils';
import { Eye, Download, Copy, FileText as FileTextIcon, AlertTriangle, ShieldCheck, ShieldAlert, PlayCircle, FileAudio, ChevronDown, ListChecks, Newspaper, Star, ThumbsUp, TrendingUp, Mic } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { CallScoringResultsCard } from '../call-scoring/call-scoring-results-card';
import type { ScoreCallOutput } from "@/ai/flows/call-scoring";
import { scoreCall } from '@/ai/flows/call-scoring';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { useProductContext } from '@/hooks/useProductContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Product } from '@/types';


export interface TranscriptionResultItem {
  id: string;
  fileName: string;
  diarizedTranscript: string;
  accuracyAssessment: string;
  audioDataUri?: string; 
  error?: string; 
  scoreOutput?: ScoreCallOutput;
}

interface TranscriptionResultsTableProps {
  results: TranscriptionResultItem[];
}

const mapAccuracyToPercentageString = (assessment: string): string => {
  const lowerAssessment = assessment.toLowerCase();
  if (lowerAssessment.includes("high")) return "High (est. 95%+)";
  if (lowerAssessment.includes("medium")) return "Medium (est. 80-94%)";
  if (lowerAssessment.includes("low")) return "Low (est. &lt;80%)";
  if (lowerAssessment.includes("error")) return "Error";
  return assessment; // Fallback for unknown values
};

const TranscriptDisplay = ({ transcript }: { transcript: string }) => {
  const lines = transcript.split('\n');
  return (
    <p className="text-sm text-foreground whitespace-pre-wrap break-words">
      {lines.map((line, index) => {
        let style = "text-foreground";
        if (line.trim().startsWith("AGENT:")) style = "text-primary font-semibold";
        else if (line.trim().startsWith("USER:")) style = "text-green-700 font-semibold";
        else if (line.trim().startsWith("RINGING:")) style = "text-amber-600 italic";
        else if (line.trim().startsWith("[")) style = "text-muted-foreground text-xs";
        
        return (
          <span key={index} className={cn(style, "block")}>
            {line}
          </span>
        );
      })}
    </p>
  );
};


export function TranscriptionResultsTable({ results }: TranscriptionResultsTableProps) {
  const [selectedResult, setSelectedResult] = useState&lt;TranscriptionResultItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [scoringProduct, setScoringProduct] = useState&lt;Product | undefined>();
  const [scoringResult, setScoringResult] = useState&lt;ScoreCallOutput | undefined>();

  const { logActivity } = useActivityLogger();
  const { availableProducts } = useProductContext();
  const { toast } = useToast();

  const handleViewTranscript = (result: TranscriptionResultItem) => {
    if (result.error &amp;&amp; !result.audioDataUri) { 
        toast({
            variant: "destructive",
            title: `Cannot View Transcript for ${result.fileName}`,
            description: "This file could not be transcribed and audio is unavailable.",
        });
        return;
    }
    setSelectedResult(result);
    setScoringResult(result.scoreOutput); 
    setScoringProduct(undefined);
    setIsDialogOpen(true);
  };

  const handleScoreFromDialog = async () => {
    if (!selectedResult || !scoringProduct) {
        toast({ variant: "destructive", title: "Error", description: "A result and product must be selected to score."});
        return;
    }
    setIsScoring(true);
    try {
        const result = await scoreCall({
            audioDataUri: "dummy-uri-for-text-based-scoring",
            product: scoringProduct
        }, selectedResult.diarizedTranscript);
        setScoringResult(result);
        
        const { transcript, ...scoreOutputForLogging } = result;

        logActivity({
          module: "Call Scoring",
          product: scoringProduct,
          details: {
            fileName: selectedResult.fileName,
            scoreOutput: scoreOutputForLogging, 
            agentNameFromForm: "N/A (from transcription)",
            error: result.callCategorisation === "Error" ? result.summary : undefined, 
          }
        });
        
        toast({ title: "Scoring Complete", description: `Scored against ${scoringProduct} product context.`});

    } catch (e) {
        const error = e as Error;
        toast({ variant: "destructive", title: "Scoring Failed", description: error.message});
    } finally {
        setIsScoring(false);
    }
  };


  const handleCopyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => toast({ title: "Success", description: "Transcript copied to clipboard!" }))
      .catch(() => toast({ variant: "destructive", title: "Error", description: "Failed to copy transcript." }));
  };
  
  const handleDownloadDoc = (text: string, fileName: string) => { 
    if (!text || !fileName) return;
    try {
      const docFilename = (fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName) + "_transcript.txt" || "transcript.txt"; 
      exportPlainTextFile(docFilename, text);
      toast({ title: "Success", description: "Transcript TXT file downloaded." });
    } catch (error) {
       toast({ variant: "destructive", title: "Error", description: "Failed to download TXT file." });
    }
  };

  const handleDownloadPdf = (text: string, fileName: string) => {
    if (!text || !fileName) return;
    try {
      const pdfFilename = (fileName ? (fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName) : "transcript") + "_transcript.pdf" || "transcript.pdf";
      exportTextContentToPdf(text, pdfFilename);
      toast({ title: "Success", description: `Transcript PDF '${pdfFilename}' downloaded.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to download PDF." });
    }
  };

  const handleDownloadAudio = (audioDataUri: string | undefined, fileName: string) => {
    if (!audioDataUri) {
      toast({ variant: "destructive", title: "Download Failed", description: "Audio data is not available for this file." });
      return;
    }
    try {
      downloadDataUriFile(audioDataUri, fileName || "audio_recording.unknown");
      toast({ title: "Download Started", description: `Downloading ${fileName}...`});
    } catch (error) {
      console.error("Error downloading audio file:", error);
      toast({ variant: "destructive", title: "Download Error", description: "Could not download the audio file." });
    }
  };


  const getAccuracyIcon = (assessment?: string) => {
    if (!assessment) return &lt;ShieldAlert className="h-3.5 w-3.5 text-muted-foreground inline-block align-middle" />;
    const lowerAssessment = assessment.toLowerCase();
    if (lowerAssessment.includes("high")) return &lt;ShieldCheck className="h-3.5 w-3.5 text-green-500 inline-block align-middle" />;
    if (lowerAssessment.includes("medium")) return &lt;ShieldCheck className="h-3.5 w-3.5 text-yellow-500 inline-block align-middle" />;
    if (lowerAssessment.includes("low") || lowerAssessment.includes("error")) return &lt;ShieldAlert className="h-3.5 w-3.5 text-red-500 inline-block align-middle" />;
    return &lt;ShieldAlert className="h-3.5 w-3.5 text-muted-foreground inline-block align-middle" />;
  };


  return (
    &lt;>
      &lt;ScrollArea className="h-[calc(100vh-400px)] md:h-[500px] rounded-md border shadow-sm">
        &lt;Table>
          &lt;TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm">
            &lt;TableRow>
              &lt;TableHead className="w-[50px]">SNo.&lt;/TableHead>
              &lt;TableHead>File Name&lt;/TableHead>
              &lt;TableHead>Transcript Preview&lt;/TableHead>
              &lt;TableHead className="text-center w-[200px]">Accuracy Assessment&lt;/TableHead>
              &lt;TableHead className="text-center w-[100px]">Status&lt;/TableHead>
              &lt;TableHead className="text-right w-[150px]">Actions&lt;/TableHead>
            &lt;/TableRow>
          &lt;/TableHeader>
          &lt;TableBody>
            {results.length === 0 ? (
              &lt;TableRow>
                &lt;TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No transcription results to display.
                &lt;/TableCell>
              &lt;/TableRow>
            ) : (
              results.map((result, index) => (
                &lt;TableRow key={result.id}>
                  &lt;TableCell>{index + 1}&lt;/TableCell>
                  &lt;TableCell className="font-medium max-w-xs truncate" title={result.fileName}>
                    {result.fileName}
                  &lt;/TableCell>
                  &lt;TableCell className="max-w-sm">
                    {result.error ? (
                        &lt;span className="text-destructive italic text-xs">{result.diarizedTranscript}&lt;/span>
                    ) : (
                        &lt;ScrollArea className="h-16 max-w-full">
                             &lt;p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                                {result.diarizedTranscript.substring(0, 200)}{result.diarizedTranscript.length > 200 &amp;&amp; '...'}&lt;/p>
                        &lt;/ScrollArea>
                    )}
                  &lt;/TableCell>
                  &lt;TableCell className="text-center text-xs" title={result.accuracyAssessment}>
                     {getAccuracyIcon(result.accuracyAssessment)} {mapAccuracyToPercentageString(result.accuracyAssessment || 'N/A')}&lt;/TableCell>
                  &lt;TableCell className="text-center">
                    {result.error ? (
                        &lt;Badge variant="destructive" className="cursor-default text-xs" title={result.error}>
                            &lt;AlertTriangle className="mr-1 h-3 w-3" /> Error
                        &lt;/Badge>
                    ) : (
                        &lt;Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300 text-xs">Success&lt;/Badge>
                    )}
                  &lt;/TableCell>
                  &lt;TableCell className="text-right space-x-1">
                    &lt;Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleViewTranscript(result)}
                        disabled={!!result.error &amp;&amp; !result.audioDataUri} 
                        title={result.error &amp;&amp; !result.audioDataUri ? "Transcription failed, audio unavailable" : "View Full Transcript / Play Audio"}
                    >
                      &lt;Eye className="mr-1.5 h-4 w-4" /> View
                    &lt;/Button>
                    &lt;DropdownMenu>
                      &lt;DropdownMenuTrigger asChild>
                         &lt;Button 
                            variant="outline" 
                            size="icon" 
                            className="h-9 w-9"
                            disabled={!!result.error}
                            title={result.error ? "Cannot download, transcription failed" : "Download options"}
                          >
                          &lt;ChevronDown className="h-4 w-4" />
                        &lt;/Button>
                      &lt;/DropdownMenuTrigger>
                      &lt;DropdownMenuContent align="end">
                        &lt;DropdownMenuItem onClick={() => handleDownloadDoc(result.diarizedTranscript, result.fileName)}>
                          &lt;FileTextIcon className="mr-2 h-4 w-4"/>
                          &lt;span>Download as TXT&lt;/span>
                        &lt;/DropdownMenuItem>
                        &lt;DropdownMenuItem onClick={() => handleDownloadPdf(result.diarizedTranscript, result.fileName)}>
                          &lt;FileTextIcon className="mr-2 h-4 w-4"/>
                          &lt;span>Download as PDF&lt;/span>
                        &lt;/DropdownMenuItem>
                      &lt;/DropdownMenuContent>
                    &lt;/DropdownMenu>
                  &lt;/TableCell>
                &lt;/TableRow>
              ))
            )}
          &lt;/TableBody>
        &lt;/Table>
      &lt;/ScrollArea>

      {selectedResult &amp;&amp; (
        &lt;Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          &lt;DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl h-[85vh] flex flex-col p-0">
            &lt;DialogHeader className="p-6 pb-2 border-b">
              &lt;div className="flex justify-between items-start">
                &lt;div>
                    &lt;DialogTitle className="text-primary flex items-center">&lt;Mic className="mr-2 h-5 w-5"/>Transcription &amp; Scoring Result&lt;/DialogTitle>
                    &lt;DialogDescription>
                       File: {selectedResult.fileName}
                    &lt;/DialogDescription>
                &lt;/div>
              &lt;/div>
            &lt;/DialogHeader>
            &lt;ScrollArea className="flex-grow p-4 sm:p-6">
              &lt;Tabs defaultValue={scoringResult ? "overall" : "transcript"} className="flex flex-col h-full">
                 &lt;TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 mb-4">
                    &lt;TabsTrigger value="overall" className="text-xs sm:text-sm" disabled={!scoringResult}>&lt;ListChecks className="mr-1.5 h-4 w-4"/>Overall Scoring&lt;/TabsTrigger>
                    &lt;TabsTrigger value="transcript" className="text-xs sm:text-sm">&lt;Newspaper className="mr-1.5 h-4 w-4"/>Transcript&lt;/TabsTrigger>
                    &lt;TabsTrigger value="detailed-metrics" className="text-xs sm:text-sm" disabled={!scoringResult}>&lt;Star className="mr-1.5 h-4 w-4"/>Detailed Metrics&lt;/TabsTrigger>
                    &lt;TabsTrigger value="strengths" className="text-xs sm:text-sm" disabled={!scoringResult}>&lt;ThumbsUp className="mr-1.5 h-4 w-4"/>Strengths&lt;/TabsTrigger>
                    &lt;TabsTrigger value="improvements" className="text-xs sm:text-sm" disabled={!scoringResult}>&lt;TrendingUp className="mr-1.5 h-4 w-4"/>Improvements&lt;/TabsTrigger>
                 &lt;/TabsList>
                 
                 &lt;div className="mt-2 space-y-3">
                    &lt;TabsContent value="transcript" className="mt-0">
                        &lt;div className="flex justify-between items-center flex-wrap gap-2">
                            &lt;div className="flex items-center gap-2 text-sm text-muted-foreground" title={`Accuracy: ${selectedResult.accuracyAssessment}`}>
                                {getAccuracyIcon(selectedResult.accuracyAssessment)}
                                Accuracy Assessment: &lt;strong>{mapAccuracyToPercentageString(selectedResult.accuracyAssessment)}&lt;/strong>
                            &lt;/div>
                            &lt;div className="flex gap-2">
                                 &lt;Button variant="outline" size="xs" onClick={() => handleCopyToClipboard(selectedResult.diarizedTranscript)} disabled={!!selectedResult.error}>&lt;Copy className="mr-1 h-3"/>Copy Txt&lt;/Button>
                                 &lt;Button variant="outline" size="xs" onClick={() => handleDownloadDoc(selectedResult.diarizedTranscript, selectedResult.fileName)} disabled={!!selectedResult.error}>&lt;Download className="mr-1 h-3"/>TXT&lt;/Button>
                                 &lt;Button variant="outline" size="xs" onClick={() => handleDownloadPdf(selectedResult.diarizedTranscript, selectedResult.fileName)} disabled={!!selectedResult.error}>&lt;FileTextIcon className="mr-1 h-3"/>PDF&lt;/Button>
                                 {selectedResult.audioDataUri &amp;&amp; &lt;Button variant="outline" size="xs" onClick={() => handleDownloadAudio(selectedResult.audioDataUri, selectedResult.fileName)}>&lt;FileAudio className="mr-1 h-3"/>Audio&lt;/Button>}
                            &lt;/div>
                        &lt;/div>
                         {selectedResult.audioDataUri &amp;&amp; (
                            &lt;div className='mt-3'>
                              &lt;audio controls src={selectedResult.audioDataUri} className="w-full h-10">
                                Your browser does not support the audio element.
                              &lt;/audio>
                            &lt;/div>
                        )}
                        {selectedResult.error ? (
                             &lt;div className="h-64 flex items-center justify-center">
                                &lt;p className="text-destructive text-center">Error transcribing file: {selectedResult.error}&lt;/p>
                             &lt;/div>
                        ) : (
                          &lt;ScrollArea className="h-64 mt-2 w-full rounded-md border p-3 bg-background">
                            &lt;TranscriptDisplay transcript={selectedResult.diarizedTranscript} />
                          &lt;/ScrollArea>
                        )}
                        {!scoringResult &amp;&amp; (
                            &lt;div className="mt-4 p-4 border rounded-lg bg-muted/30">
                                &lt;h4 className="font-semibold text-md mb-2">Score this Transcript&lt;/h4>
                                &lt;div className="flex items-center gap-2">
                                &lt;Select onValueChange={v => setScoringProduct(v as Product)}>
                                    &lt;SelectTrigger className="w-[220px]">
                                        &lt;SelectValue placeholder="Select Product for Scoring" />
                                    &lt;/SelectTrigger>
                                    &lt;SelectContent>
                                        {availableProducts.map(p => &lt;SelectItem key={p.name} value={p.name}>{p.displayName}&lt;/SelectItem>)}
                                    &lt;/SelectContent>
                                &lt;/Select>
                                &lt;Button onClick={handleScoreFromDialog} disabled={isScoring || !scoringProduct || !!selectedResult.error}>
                                    {isScoring ? &lt;LoadingSpinner size={16} className="mr-2"/> : &lt;Star className="mr-2 h-4 w-4"/>}
                                    {isScoring ? "Scoring..." : "Run Score"}
                                &lt;/Button>
                                &lt;/div>
                            &lt;/div>
                        )}
                    &lt;/TabsContent>
                    
                    {scoringResult &amp;&amp; (
                       &lt;TabsContent value="overall" className="mt-0">
                         &lt;CallScoringResultsCard results={scoringResult} fileName={selectedResult.fileName} audioDataUri={selectedResult.audioDataUri} isHistoricalView={true} />
                       &lt;/TabsContent>
                    )}
                 &lt;/div>
              &lt;/Tabs>
            &lt;/ScrollArea>
            &lt;DialogFooter className="p-4 border-t bg-muted/50">
              &lt;Button onClick={() => setIsDialogOpen(false)} size="sm">Close&lt;/Button>
            &lt;/DialogFooter>
          &lt;/DialogContent>
        &lt;/Dialog>
      )}
    &lt;/>
  );
}
