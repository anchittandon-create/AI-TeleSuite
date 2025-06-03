
"use client";

import { useState, useMemo } from 'react';
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
import { Badge } from "@/components/ui/badge";
import { Eye, ArrowUpDown, FileText, Download, Copy, AlertTriangle, ShieldCheck, ShieldAlert, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { HistoricalTranscriptionItem, TranscriptionActivityDetails } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { exportPlainTextFile } from '@/lib/export'; // Use exportPlainTextFile
import { exportTextContentToPdf } from '@/lib/pdf-utils';

interface TranscriptionDashboardTableProps {
  history: HistoricalTranscriptionItem[];
}

type SortKey = 'fileName' | 'accuracyAssessment' | 'timestamp' | null;
type SortDirection = 'asc' | 'desc';

export function TranscriptionDashboardTable({ history }: TranscriptionDashboardTableProps) {
  const [selectedItem, setSelectedItem] = useState<HistoricalTranscriptionItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleViewDetails = (item: HistoricalTranscriptionItem) => {
    setSelectedItem(item);
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
      const docFilename = (fileName ? fileName.substring(0, fileName.lastIndexOf('.')) : "transcript") + "_transcript.doc"; // Save as .doc
      exportPlainTextFile(docFilename, text); // Use exportPlainTextFile
      toast({ title: "Success", description: `Transcript Text for Word (.doc) '${docFilename}' downloaded.` });
    } catch (error) {
       toast({ variant: "destructive", title: "Error", description: "Failed to download Text for Word (.doc)." });
    }
  };

  const handleDownloadPdf = (text: string, fileName: string) => {
    if (!text || !fileName) return;
    try {
      const pdfFilename = (fileName ? fileName.substring(0, fileName.lastIndexOf('.')) : "transcript") + "_transcript.pdf";
      exportTextContentToPdf(text, pdfFilename);
      toast({ title: "Success", description: `Transcript PDF '${pdfFilename}' downloaded.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to download PDF." });
    }
  };

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortKey === key && sortDirection === 'asc') {
      direction = 'desc';
    }
    setSortKey(key);
    setSortDirection(direction);
  };

  const getSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDirection === 'asc' ? <ArrowUpDown className="ml-1 h-3 w-3 inline transform rotate-180" /> : <ArrowUpDown className="ml-1 h-3 w-3 inline" />;
  };

  const getAccuracyIcon = (assessment?: string) => {
    if (!assessment) return <ShieldAlert className="h-4 w-4 text-muted-foreground" />;
    const lowerAssessment = assessment.toLowerCase();
    if (lowerAssessment.includes("high")) return <ShieldCheck className="h-4 w-4 text-green-500" />;
    if (lowerAssessment.includes("medium")) return <ShieldCheck className="h-4 w-4 text-yellow-500" />;
    if (lowerAssessment.includes("low") || lowerAssessment.includes("error")) return <ShieldAlert className="h-4 w-4 text-red-500" />;
    return <ShieldAlert className="h-4 w-4 text-muted-foreground" />;
  };

  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => {
      let valA: any, valB: any;

      switch (sortKey) {
        case 'fileName':
          valA = a.details.fileName?.toLowerCase();
          valB = b.details.fileName?.toLowerCase();
          break;
        case 'accuracyAssessment':
          valA = a.details.transcriptionOutput?.accuracyAssessment?.toLowerCase();
          valB = b.details.transcriptionOutput?.accuracyAssessment?.toLowerCase();
          break;
        case 'timestamp':
          valA = new Date(a.timestamp).getTime();
          valB = new Date(b.timestamp).getTime();
          break;
        default:
          return 0;
      }

      let comparison = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB);
      } else {
        if (valA === undefined || valA === null) comparison = -1;
        else if (valB === undefined || valB === null) comparison = 1;
      }
      return sortDirection === 'desc' ? comparison * -1 : comparison;
    });
  }, [history, sortKey, sortDirection]);

  return (
    <>
      <div className="w-full mt-2 shadow-lg rounded-lg border bg-card">
        <ScrollArea className="h-[calc(100vh-340px)] md:h-[calc(100vh-310px)]">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm z-10">
              <TableRow>
                <TableHead onClick={() => requestSort('fileName')} className="cursor-pointer">File Name {getSortIndicator('fileName')}</TableHead>
                <TableHead>Transcript Preview</TableHead>
                <TableHead onClick={() => requestSort('accuracyAssessment')} className="cursor-pointer text-center">Accuracy {getSortIndicator('accuracyAssessment')}</TableHead>
                <TableHead onClick={() => requestSort('timestamp')} className="cursor-pointer">Date Transcribed {getSortIndicator('timestamp')}</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No transcripts found in history. Transcribe some audio to see them here.
                  </TableCell>
                </TableRow>
              ) : (
                sortedHistory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium max-w-xs truncate" title={item.details.fileName}>
                      <FileText className="inline-block mr-2 h-4 w-4 text-muted-foreground" />
                      {item.details.fileName}
                    </TableCell>
                    <TableCell className="max-w-sm">
                      {item.details.error ? (
                        <span className="text-destructive italic text-xs">{item.details.transcriptionOutput?.diarizedTranscript}</span>
                      ) : (
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words truncate_3_lines">
                          {item.details.transcriptionOutput?.diarizedTranscript?.substring(0, 150)}{item.details.transcriptionOutput?.diarizedTranscript && item.details.transcriptionOutput.diarizedTranscript.length > 150 ? '...' : ''}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs" title={item.details.transcriptionOutput?.accuracyAssessment}>
                      <div className="flex items-center justify-center gap-1">
                         {getAccuracyIcon(item.details.transcriptionOutput?.accuracyAssessment)}
                         <span>{item.details.transcriptionOutput?.accuracyAssessment?.split(" ")[0] || 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell>{format(parseISO(item.timestamp), 'PP p')}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(item)}
                          title={"View Full Transcript"}
                      >
                        <Eye className="mr-1.5 h-4 w-4" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {selectedItem && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl h-[85vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-2 border-b">
                <DialogTitle className="text-primary">Full Transcript: {selectedItem.details.fileName}</DialogTitle>
                <DialogDescription>
                    Generated on: {format(parseISO(selectedItem.timestamp), 'PP p')}
                    {selectedItem.agentName && `, By: ${selectedItem.agentName}`}
                </DialogDescription>
                 <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1" title={`Accuracy: ${selectedItem.details.transcriptionOutput?.accuracyAssessment}`}>
                    {getAccuracyIcon(selectedItem.details.transcriptionOutput?.accuracyAssessment)}
                    {selectedItem.details.transcriptionOutput?.accuracyAssessment || "N/A"}
                </div>
            </DialogHeader>
            <ScrollArea className="flex-grow p-6 overflow-y-auto">
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                    <Label className="flex items-center mb-1 font-medium text-sm text-amber-700">
                        <AlertCircle className="mr-2 h-5 w-5" /> Note on Historical Audio
                    </Label>
                    <p className="text-xs text-amber-600">
                        Original audio file is not available for playback or download in historical dashboard views. This data is not stored with the activity log to conserve browser storage. Audio can be accessed on the main 'Transcription' page for items processed during the current session.
                    </p>
                </div>

                {selectedItem.details.error ? (
                    <div className="space-y-2 text-sm text-destructive bg-destructive/10 p-4 rounded-md">
                        <p className="font-semibold text-lg flex items-center"><AlertTriangle className="mr-2"/>Error During Transcription:</p>
                        <p>{selectedItem.details.error}</p>
                        <Label htmlFor="error-transcript-text">Attempted Transcript (if any):</Label>
                        <Textarea
                            id="error-transcript-text"
                            value={selectedItem.details.transcriptionOutput?.diarizedTranscript || "No transcript content available."}
                            readOnly
                            className="min-h-[200px] bg-background/50 text-xs whitespace-pre-wrap"
                        />
                    </div>
                ) : selectedItem.details.transcriptionOutput ? (
                     <Textarea
                        value={selectedItem.details.transcriptionOutput.diarizedTranscript}
                        readOnly
                        className="min-h-[calc(70vh-200px)] text-sm bg-muted/20 resize-none whitespace-pre-wrap" 
                        aria-label="Full transcription text"
                    />
                ) : (
                    <p className="text-muted-foreground">No transcript content available.</p>
                )}
            </ScrollArea>
            <DialogFooter className="p-4 border-t bg-muted/50">
                {!selectedItem.details.error && selectedItem.details.transcriptionOutput && (
                    <>
                        <Button variant="outline" size="sm" onClick={() => handleCopyToClipboard(selectedItem.details.transcriptionOutput.diarizedTranscript)}>
                            <Copy className="mr-2 h-4 w-4" /> Copy Text
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDownloadDoc(selectedItem.details.transcriptionOutput.diarizedTranscript, selectedItem.details.fileName)}>
                            <Download className="mr-2 h-4 w-4" /> Text for Word (.doc)
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(selectedItem.details.transcriptionOutput.diarizedTranscript, selectedItem.details.fileName)}>
                            <FileText className="mr-2 h-4 w-4" /> PDF File
                        </Button>
                    </>
                )}
              <Button onClick={() => setIsDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <style jsx global>{`
        .truncate_3_lines {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </>
  );
}

