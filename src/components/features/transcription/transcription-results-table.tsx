
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
  if (lowerAssessment.includes("low")) return "Low (est. <80%)";
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
  const [selectedResult, setSelectedResult] = useState<TranscriptionResultItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [scoringProduct, setScoringProduct] = useState<Product | undefined>();
  const [scoringResult, setScoringResult] = useState<ScoreCallOutput | undefined>();

  const { logActivity } = useActivityLogger();
  const { availableProducts } = useProductContext();
  const { toast } = useToast();

  const handleViewTranscript = (result: TranscriptionResultItem) => {
    if (result.error && !result.audioDataUri) { 
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
    if (!assessment) return <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground inline-block align-middle" />;
    const lowerAssessment = assessment.toLowerCase();
    if (lowerAssessment.includes("high")) return <ShieldCheck className="h-3.5 w-3.5 text-green-500 inline-block align-middle" />;
    if (lowerAssessment.includes("medium")) return <ShieldCheck className="h-3.5 w-3.5 text-yellow-500 inline-block align-middle" />;
    if (lowerAssessment.includes("low") || lowerAssessment.includes("error")) return <ShieldAlert className="h-3.5 w-3.5 text-red-500 inline-block align-middle" />;
    return <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground inline-block align-middle" />;
  };


  return (
    <>
      <ScrollArea className="h-[calc(100vh-400px)] md:h-[500px] rounded-md border shadow-sm">
        <Table>
          <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm">
            <TableRow>
              <TableHead className="w-[50px]">SNo.</TableHead>
              <TableHead>File Name</TableHead>
              <TableHead>Transcript Preview</TableHead>
              <TableHead className="text-center w-[200px]">Accuracy Assessment</TableHead>
              <TableHead className="text-center w-[100px]">Status</TableHead>
              <TableHead className="text-right w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No transcription results to display.
                </TableCell>
              </TableRow>
            ) : (
              results.map((result, index) => (
                <TableRow key={result.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="font-medium max-w-xs truncate" title={result.fileName}>
                    {result.fileName}
                  </TableCell>
                  <TableCell className="max-w-sm">
                    {result.error ? (
                        <span className="text-destructive italic text-xs">{result.diarizedTranscript}</span>
                    ) : (
                        <ScrollArea className="h-16 max-w-full">
                             <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                                {result.diarizedTranscript.substring(0, 200)}{result.diarizedTranscript.length > 200 && '...'}
                            </p>
                        </ScrollArea>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-xs" title={result.accuracyAssessment}>
                     {getAccuracyIcon(result.accuracyAssessment)} {mapAccuracyToPercentageString(result.accuracyAssessment)}
                  </TableCell>
                  <TableCell className="text-center">
                    {result.error ? (
                        <Badge variant="destructive" className="cursor-default text-xs" title={result.error}>
                            <AlertTriangle className="mr-1 h-3 w-3" /> Error
                        </Badge>
                    ) : (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300 text-xs">Success</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleViewTranscript(result)}
                        disabled={!!result.error && !result.audioDataUri} 
                        title={result.error && !result.audioDataUri ? "Transcription failed, audio unavailable" : "View Full Transcript / Play Audio"}
                    >
                      <Eye className="mr-1.5 h-4 w-4" /> View
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                         <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-9 w-9"
                            disabled={!!result.error}
                            title={result.error ? "Cannot download, transcription failed" : "Download options"}
                          >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleDownloadDoc(result.diarizedTranscript, result.fileName)}>
                          <FileTextIcon className="mr-2 h-4 w-4"/>
                          <span>Download as TXT</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownloadPdf(result.diarizedTranscript, result.fileName)}>
                          <FileTextIcon className="mr-2 h-4 w-4"/>
                          <span>Download as PDF</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      {selectedResult && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl h-[85vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-2 border-b">
              <div className="flex justify-between items-start">
                <div>
                    <DialogTitle className="text-primary flex items-center"><Mic className="mr-2 h-5 w-5"/>Transcription & Scoring Result</DialogTitle>
                    <DialogDescription>
                       File: {selectedResult.fileName}
                    </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            
            <div className="p-4 sm:p-6 flex-grow overflow-y-hidden flex flex-col">
              <Tabs defaultValue={scoringResult ? "overall" : "transcript"} className="h-full flex flex-col">
                 <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 mb-4">
                    <TabsTrigger value="overall" className="text-xs sm:text-sm" disabled={!scoringResult}><ListChecks className="mr-1.5 h-4 w-4"/>Overall Scoring</TabsTrigger>
                    <TabsTrigger value="transcript" className="text-xs sm:text-sm"><Newspaper className="mr-1.5 h-4 w-4"/>Transcript</TabsTrigger>
                    <TabsTrigger value="detailed-metrics" className="text-xs sm:text-sm" disabled={!scoringResult}><Star className="mr-1.5 h-4 w-4"/>Detailed Metrics</TabsTrigger>
                    <TabsTrigger value="strengths" className="text-xs sm:text-sm" disabled={!scoringResult}><ThumbsUp className="mr-1.5 h-4 w-4"/>Strengths</TabsTrigger>
                    <TabsTrigger value="improvements" className="text-xs sm:text-sm" disabled={!scoringResult}><TrendingUp className="mr-1.5 h-4 w-4"/>Improvements</TabsTrigger>
                 </TabsList>
                 
                 <div className="flex-grow mt-2 space-y-3 overflow-y-auto pr-3">
                    {scoringResult ? (
                       <CallScoringResultsCard results={scoringResult} fileName={selectedResult.fileName} audioDataUri={selectedResult.audioDataUri} isHistoricalView={true} />
                    ) : (
                      <>
                        <div className="flex justify-between items-center flex-wrap gap-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground" title={`Accuracy: ${selectedResult.accuracyAssessment}`}>
                                {getAccuracyIcon(selectedResult.accuracyAssessment)}
                                Accuracy Assessment: <strong>{mapAccuracyToPercentageString(selectedResult.accuracyAssessment)}</strong>
                            </div>
                            <div className="flex gap-2">
                                 <Button variant="outline" size="xs" onClick={() => handleCopyToClipboard(selectedResult.diarizedTranscript)} disabled={!!selectedResult.error}><Copy className="mr-1 h-3"/>Copy Txt</Button>
                                 <Button variant="outline" size="xs" onClick={() => handleDownloadDoc(selectedResult.diarizedTranscript, selectedResult.fileName)} disabled={!!selectedResult.error}><Download className="mr-1 h-3"/>TXT</Button>
                                 <Button variant="outline" size="xs" onClick={() => handleDownloadPdf(selectedResult.diarizedTranscript, selectedResult.fileName)} disabled={!!selectedResult.error}><FileTextIcon className="mr-1 h-3"/>PDF</Button>
                                 {selectedResult.audioDataUri && <Button variant="outline" size="xs" onClick={() => handleDownloadAudio(selectedResult.audioDataUri, selectedResult.fileName)}><FileAudio className="mr-1 h-3"/>Audio</Button>}
                            </div>
                        </div>
                         {selectedResult.audioDataUri && (
                            <div>
                              <audio controls src={selectedResult.audioDataUri} className="w-full h-10 mt-2">
                                Your browser does not support the audio element.
                              </audio>
                            </div>
                        )}
                        {selectedResult.error ? (
                             <div className="h-full flex items-center justify-center">
                                <p className="text-destructive text-center">Error transcribing file: {selectedResult.error}</p>
                             </div>
                        ) : (
                          <ScrollArea className="h-[calc(100%-100px)] w-full rounded-md border p-3 bg-background">
                            <TranscriptDisplay transcript={selectedResult.diarizedTranscript} />
                          </ScrollArea>
                        )}
                        <div className="mt-4 p-4 border rounded-lg bg-muted/30">
                            <h4 className="font-semibold text-md mb-2">Score this Transcript</h4>
                            <div className="flex items-center gap-2">
                               <Select onValueChange={v => setScoringProduct(v as Product)}>
                                <SelectTrigger className="w-[220px]">
                                    <SelectValue placeholder="Select Product for Scoring" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableProducts.map(p => <SelectItem key={p.name} value={p.name}>{p.displayName}</SelectItem>)}
                                </SelectContent>
                               </Select>
                               <Button onClick={handleScoreFromDialog} disabled={isScoring || !scoringProduct || !!selectedResult.error}>
                                   {isScoring ? <LoadingSpinner size={16} className="mr-2"/> : <Star className="mr-2 h-4 w-4"/>}
                                   {isScoring ? "Scoring..." : "Run Score"}
                               </Button>
                            </div>
                        </div>
                      </>
                    )}
                 </div>
              </Tabs>
            </div>
            
            <DialogFooter className="p-4 border-t bg-muted/50">
              <Button onClick={() => setIsDialogOpen(false)} size="sm">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

