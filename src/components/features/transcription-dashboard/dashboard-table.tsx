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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from '@/hooks/use-toast';
import { exportPlainTextFile } from '@/lib/export';
import { exportTextContentToPdf } from '@/lib/pdf-utils';
import { Badge } from "@/components/ui/badge";
import { Eye, ArrowUpDown, FileText, Download, Copy, ShieldCheck, ShieldAlert, AlertCircle, ListChecks, Newspaper, Star, ThumbsUp, TrendingUp, Mic } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { HistoricalTranscriptionItem } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';


interface TranscriptionDashboardTableProps {
  history: HistoricalTranscriptionItem[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

type SortKey = 'fileName' | 'accuracyAssessment' | 'timestamp' | null;
type SortDirection = 'asc' | 'desc';

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

export function TranscriptionDashboardTable({ history, selectedIds, onSelectionChange }: TranscriptionDashboardTableProps) {
  const [selectedItem, setSelectedItem] = useState<HistoricalTranscriptionItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const isAllSelected = history.length > 0 && selectedIds.length === history.length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(history.map(item => item.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter(itemId => itemId !== id));
    }
  };


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
      const docFilename = (fileName ? (fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName) : "transcript") + "_transcript.doc";
      exportPlainTextFile(docFilename, text);
      toast({ title: "Success", description: `Transcript Text for Word (.doc) '${docFilename}' downloaded.` });
    } catch (error) {
       toast({ variant: "destructive", title: "Error", description: "Failed to download Text for Word (.doc)." });
    }
  };

  const handleDownloadPdf = (text: string, fileName: string) => {
    if (!text || !fileName) return;
    try {
      const pdfFilename = (fileName ? (fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName) : "transcript") + "_transcript.pdf";
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
                <TableHead className="w-[50px]">
                    <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                        aria-label="Select all"
                    />
                </TableHead>
                <TableHead onClick={() => requestSort('fileName')} className="cursor-pointer">File Name {getSortIndicator('fileName')}</TableHead>
                <TableHead>Transcript Preview</TableHead>
                <TableHead onClick={() => requestSort('accuracyAssessment')} className="cursor-pointer text-center w-[200px]">Accuracy Assessment {getSortIndicator('accuracyAssessment')}</TableHead>
                <TableHead onClick={() => requestSort('timestamp')} className="cursor-pointer">Date Transcribed {getSortIndicator('timestamp')}</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No transcripts found in history. Transcribe some audio to see them here.
                  </TableCell>
                </TableRow>
              ) : (
                sortedHistory.map((item) => (
                  <TableRow key={item.id} data-state={selectedIds.includes(item.id) ? "selected" : undefined}>
                    <TableCell>
                        <Checkbox
                            checked={selectedIds.includes(item.id)}
                            onCheckedChange={(checked) => handleSelectOne(item.id, !!checked)}
                            aria-label={`Select row for ${item.details.fileName}`}
                        />
                    </TableCell>
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
                         <span>{mapAccuracyToPercentageString(item.details.transcriptionOutput?.accuracyAssessment || 'N/A')}</span>
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
          <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl h-[85vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-2 border-b">
                <DialogTitle className="text-primary flex items-center"><Mic className="mr-2 h-5 w-5"/>Historical Transcript: {selectedItem.details.fileName}</DialogTitle>
                <DialogDescription>
                    Generated on: {format(parseISO(selectedItem.timestamp), 'PP p')}
                    {selectedItem.agentName && `, By: ${selectedItem.agentName}`}
                </DialogDescription>
            </DialogHeader>
            <div className="p-4 sm:p-6 flex-grow overflow-y-hidden flex flex-col">
              <Tabs defaultValue="transcript" className="h-full flex flex-col">
                  <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 mb-4">
                     <TabsTrigger value="overall" className="text-xs sm:text-sm" disabled><ListChecks className="mr-1.5 h-4 w-4"/>Overall Scoring</TabsTrigger>
                     <TabsTrigger value="transcript" className="text-xs sm:text-sm"><Newspaper className="mr-1.5 h-4 w-4"/>Transcript</TabsTrigger>
                     <TabsTrigger value="detailed-metrics" className="text-xs sm:text-sm" disabled><Star className="mr-1.5 h-4 w-4"/>Detailed Metrics</TabsTrigger>
                     <TabsTrigger value="strengths" className="text-xs sm:text-sm" disabled><ThumbsUp className="mr-1.5 h-4 w-4"/>Strengths</TabsTrigger>
                     <TabsTrigger value="improvements" className="text-xs sm:text-sm" disabled><TrendingUp className="mr-1.5 h-4 w-4"/>Improvements</TabsTrigger>
                  </TabsList>
                  <TabsContent value="transcript" className="flex-grow mt-2 space-y-3">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                         <div className="flex items-center gap-2 text-sm text-muted-foreground" title={`Accuracy: ${selectedItem.details.transcriptionOutput?.accuracyAssessment}`}>
                            {getAccuracyIcon(selectedItem.details.transcriptionOutput?.accuracyAssessment)}
                            Accuracy Assessment: <strong>{mapAccuracyToPercentageString(selectedItem.details.transcriptionOutput?.accuracyAssessment || "N/A")}</strong>
                        </div>
                        <div className="flex gap-2">
                           <Button variant="outline" size="xs" onClick={() => handleCopyToClipboard(selectedItem.details.transcriptionOutput!.diarizedTranscript)} disabled={!!selectedItem.details.error}><Copy className="mr-1 h-3"/>Copy Text</Button>
                           <Button variant="outline" size="xs" onClick={() => handleDownloadDoc(selectedItem.details.transcriptionOutput!.diarizedTranscript, selectedItem.details.fileName)} disabled={!!selectedItem.details.error}><Download className="mr-1 h-3"/>DOC</Button>
                           <Button variant="outline" size="xs" onClick={() => handleDownloadPdf(selectedItem.details.transcriptionOutput!.diarizedTranscript, selectedItem.details.fileName)} disabled={!!selectedItem.details.error}><FileText className="mr-1 h-3"/>PDF</Button>
                       </div>
                    </div>

                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-700 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0"/>
                        Original audio file is not available for playback or download in historical dashboard views.
                    </div>

                    {selectedItem.details.error ? (
                         <div className="h-full flex items-center justify-center">
                            <p className="text-destructive text-center">Error during transcription: {selectedItem.details.error}</p>
                         </div>
                    ) : (
                      <ScrollArea className="h-[calc(100%-100px)] w-full rounded-md border p-3 bg-background">
                          <TranscriptDisplay transcript={selectedItem.details.transcriptionOutput!.diarizedTranscript} />
                      </ScrollArea>
                    )}
                  </TabsContent>
              </Tabs>
            </div>
            <DialogFooter className="p-4 border-t bg-muted/50">
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