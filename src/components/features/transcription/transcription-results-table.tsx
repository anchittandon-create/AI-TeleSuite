
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { exportPlainTextFile, downloadDataUriFile } from '@/lib/export'; // Corrected import
import { exportTextContentToPdf } from '@/lib/pdf-utils';
import { Eye, Download, Copy, FileText, AlertTriangle, ShieldCheck, ShieldAlert, PlayCircle, FileAudio } from 'lucide-react'; // Added FileAudio
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export interface TranscriptionResultItem {
  id: string;
  fileName: string;
  diarizedTranscript: string;
  accuracyAssessment: string;
  audioDataUri?: string; 
  error?: string; 
}

interface TranscriptionResultsTableProps {
  results: TranscriptionResultItem[];
}

export function TranscriptionResultsTable({ results }: TranscriptionResultsTableProps) {
  const [selectedResult, setSelectedResult] = useState<TranscriptionResultItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
    setIsDialogOpen(true);
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
      const docFilename = fileName.substring(0, fileName.lastIndexOf('.')) + "_transcript.txt" || "transcript.txt"; 
      exportPlainTextFile(docFilename, text); // Corrected function call
      toast({ title: "Success", description: "Transcript TXT file downloaded." });
    } catch (error) {
       toast({ variant: "destructive", title: "Error", description: "Failed to download TXT file." });
    }
  };

  const handleDownloadPdf = (text: string, fileName: string) => {
    if (!text || !fileName) return;
    try {
      const pdfFilename = fileName.substring(0, fileName.lastIndexOf('.')) + "_transcript.pdf" || "transcript.pdf";
      exportTextContentToPdf(text, pdfFilename); 
      toast({ title: "Success", description: "Transcript PDF downloaded." });
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
              <TableHead className="text-center w-[150px]">Accuracy</TableHead>
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
                     {getAccuracyIcon(result.accuracyAssessment)} {result.accuracyAssessment.split(" ")[0]}
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
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleViewTranscript(result)}
                        disabled={!!result.error && !result.audioDataUri} 
                        title={result.error && !result.audioDataUri ? "Transcription failed, audio unavailable" : "View Full Transcript / Play Audio"}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDownloadDoc(result.diarizedTranscript, result.fileName)}
                        disabled={!!result.error}
                        title={result.error ? "Cannot download, transcription failed" : "Download TXT"}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      {selectedResult && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl h-[85vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-4 border-b">
              <div className="flex justify-between items-start">
                <div>
                    <DialogTitle className="text-primary">Full Transcript: {selectedResult.fileName}</DialogTitle>
                    <DialogDescription>
                        Complete transcription text. Speaker labels (Agent/User) are AI-generated.
                    </DialogDescription>
                </div>
                {!selectedResult.error && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1" title={`Accuracy: ${selectedResult.accuracyAssessment}`}>
                        {getAccuracyIcon(selectedResult.accuracyAssessment)}
                        {selectedResult.accuracyAssessment}
                    </div>
                )}
              </div>
            </DialogHeader>
            
            <div className="p-6 space-y-4 flex-grow overflow-y-hidden flex flex-col">
                {selectedResult.audioDataUri && !selectedResult.error && (
                    <div className="mb-2">
                    <Label htmlFor={`dialog-audio-player-${selectedResult.id}`} className="flex items-center mb-1 font-medium text-sm">
                        <PlayCircle className="mr-2 h-5 w-5 text-primary" /> Original Audio
                    </Label>
                    <audio id={`dialog-audio-player-${selectedResult.id}`} controls src={selectedResult.audioDataUri} className="w-full h-10">
                        Your browser does not support the audio element.
                    </audio>
                    </div>
                )}
                {selectedResult.error && selectedResult.audioDataUri && ( // Show audio player even on error if URI exists
                    <div className="mb-2">
                        <Label htmlFor={`dialog-error-audio-player-${selectedResult.id}`} className="flex items-center mb-1 font-medium text-sm text-destructive">
                            <PlayCircle className="mr-2 h-5 w-5" /> Original Audio (Transcription Failed)
                        </Label>
                        <audio id={`dialog-error-audio-player-${selectedResult.id}`} controls src={selectedResult.audioDataUri} className="w-full h-10">
                            Your browser does not support the audio element.
                        </audio>
                    </div>
                )}


                {selectedResult.error ? (
                    <Alert variant="destructive" className="flex-grow">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Transcription Error</AlertTitle>
                        <AlertDescription>{selectedResult.error} - {selectedResult.diarizedTranscript}</AlertDescription>
                    </Alert>
                ) : (
                   <Accordion type="single" collapsible className="w-full flex-grow flex flex-col" defaultValue="transcript-item">
                       <AccordionItem value="transcript-item" className="flex-grow flex flex-col border-b-0">
                           <AccordionTrigger className="text-lg font-semibold hover:no-underline py-2 sr-only">
                               Transcript
                           </AccordionTrigger>
                           <AccordionContent className="pt-0 flex-grow h-0 min-h-[200px]">
                               <Textarea
                                   value={selectedResult.diarizedTranscript}
                                   readOnly
                                   className="h-full text-sm bg-muted/20 resize-none whitespace-pre-wrap"
                                   aria-label="Full transcription text"
                               />
                           </AccordionContent>
                       </AccordionItem>
                   </Accordion>
                )}
            </div>
            
            <DialogFooter className="p-4 border-t bg-muted/50">
            {!selectedResult.error && (
                <>
                    <Button variant="outline" size="sm" onClick={() => handleCopyToClipboard(selectedResult.diarizedTranscript)}>
                        <Copy className="mr-2 h-4 w-4" /> Copy Txt
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDownloadDoc(selectedResult.diarizedTranscript, selectedResult.fileName)}>
                        <Download className="mr-2 h-4 w-4" /> TXT File
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(selectedResult.diarizedTranscript, selectedResult.fileName)}>
                        <FileText className="mr-2 h-4 w-4" /> PDF File
                    </Button>
                </>
            )}
            {selectedResult.audioDataUri && ( // Download audio button appears if URI exists, regardless of error
                <Button variant="outline" size="sm" onClick={() => handleDownloadAudio(selectedResult.audioDataUri, selectedResult.fileName)}>
                    <FileAudio className="mr-2 h-4 w-4" /> Audio File
                </Button>
            )}
            <Button onClick={() => setIsDialogOpen(false)} size="sm">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

    