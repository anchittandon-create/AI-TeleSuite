
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
import { useToast } from '@/hooks/use-toast';
import { exportToTxt } from '@/lib/export';
import { exportTextContentToPdf } from '@/lib/pdf-utils';
import { Eye, Download, Copy, FileText, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface TranscriptionResultItem {
  id: string;
  fileName: string;
  transcript: string;
  error?: string; // Optional error message for this specific file
}

interface TranscriptionResultsTableProps {
  results: TranscriptionResultItem[];
}

export function TranscriptionResultsTable({ results }: TranscriptionResultsTableProps) {
  const [selectedResult, setSelectedResult] = useState<TranscriptionResultItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleViewTranscript = (result: TranscriptionResultItem) => {
    if (result.error) {
        toast({
            variant: "destructive",
            title: `Cannot View Transcript for ${result.fileName}`,
            description: "This file could not be transcribed.",
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
  
  const handleDownloadTxt = (text: string, fileName: string) => {
    if (!text || !fileName) return;
    try {
      const txtFilename = fileName.substring(0, fileName.lastIndexOf('.')) + "_transcript.txt" || "transcript.txt";
      exportToTxt(txtFilename, text);
      toast({ title: "Success", description: "Transcript TXT downloaded." });
    } catch (error) {
       toast({ variant: "destructive", title: "Error", description: "Failed to download TXT." });
    }
  };

  const handleDownloadPdf = (text: string, fileName: string) => {
    if (!text || !fileName) return;
    try {
      const pdfFilename = fileName.substring(0, fileName.lastIndexOf('.')) + "_transcript.pdf" || "transcript.pdf";
      exportTextContentToPdf(text, pdfFilename); // Using simple text to PDF
      toast({ title: "Success", description: "Transcript PDF downloaded." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to download PDF." });
    }
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
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right w-[200px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
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
                        <span className="text-destructive italic text-xs">{result.transcript}</span>
                    ) : (
                        <ScrollArea className="h-16 max-w-full"> {/* Fixed height scrollable preview */}
                             <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                                {result.transcript.substring(0, 200)}{result.transcript.length > 200 && '...'}
                            </p>
                        </ScrollArea>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {result.error ? (
                        <Badge variant="destructive" className="cursor-default" title={result.error}>
                            <AlertTriangle className="mr-1 h-3 w-3" /> Error
                        </Badge>
                    ) : (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300">Success</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleViewTranscript(result)}
                        disabled={!!result.error}
                        title={result.error ? "Cannot view, transcription failed" : "View Full Transcript"}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDownloadTxt(result.transcript, result.fileName)}
                        disabled={!!result.error}
                        title={result.error ? "Cannot download, transcription failed" : "Download TXT"}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      {selectedResult && !selectedResult.error && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-primary">Full Transcript: {selectedResult.fileName}</DialogTitle>
              <DialogDescription>
                Complete transcription text for the selected audio file.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow mt-2 pr-2 -mr-2"> {/* Negative margin to offset ScrollArea's own padding */}
                <Textarea
                    value={selectedResult.transcript}
                    readOnly
                    className="min-h-[calc(70vh-150px)] text-sm bg-muted/20 flex-grow w-full h-full resize-none"
                    aria-label="Full transcription text"
                />
            </ScrollArea>
            <DialogFooter className="mt-auto pt-4 border-t">
              <Button variant="outline" onClick={() => handleCopyToClipboard(selectedResult.transcript)}>
                <Copy className="mr-2 h-4 w-4" /> Copy
              </Button>
              <Button variant="outline" onClick={() => handleDownloadTxt(selectedResult.transcript, selectedResult.fileName)}>
                <Download className="mr-2 h-4 w-4" /> Download TXT
              </Button>
              <Button variant="outline" onClick={() => handleDownloadPdf(selectedResult.transcript, selectedResult.fileName)}>
                <FileText className="mr-2 h-4 w-4" /> Download PDF
              </Button>
              <Button onClick={() => setIsDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
