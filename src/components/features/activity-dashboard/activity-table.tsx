
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
import { ActivityLogEntry } from "@/types";
import { format, parseISO } from 'date-fns';
import { Eye, ArrowUpDown, FileText as FileTextIcon, MessageSquareReply as MessageSquareReplyIcon, ListChecks as ListChecksIcon, BookOpen as BookOpenIcon, Mic2 as Mic2Icon, Info } from 'lucide-react';

// Import components for rich display
import { CallScoringResultsCard } from '../call-scoring/call-scoring-results-card';
import { PitchCard } from '../pitch-generator/pitch-card';
import { RebuttalDisplay } from '../rebuttal-generator/rebuttal-display';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

// Import type definitions for details
import type { ScoreCallOutput } from '@/ai/flows/call-scoring';
import type { GeneratePitchInput, GeneratePitchOutput } from '@/ai/flows/pitch-generator';
import type { GenerateRebuttalInput, GenerateRebuttalOutput } from '@/ai/flows/rebuttal-generator';
import type { TranscriptionOutput } from '@/ai/flows/transcription-flow';
import type { GenerateTrainingDeckInput, GenerateTrainingDeckOutput } from '@/ai/flows/training-deck-generator';


interface ActivityTableProps {
  activities: ActivityLogEntry[];
}

type SortKey = keyof ActivityLogEntry | null;
type SortDirection = 'asc' | 'desc';

// Define a type for the expected structure of various activity details
interface CallScoringActivityDetails {
  fileName: string;
  scoreOutput: ScoreCallOutput;
  error?: string;
}
interface PitchGeneratorActivityDetails {
  pitchOutput: GeneratePitchOutput;
  inputData: GeneratePitchInput; 
  error?: string;
}
interface RebuttalGeneratorActivityDetails {
  rebuttalOutput: GenerateRebuttalOutput;
  inputData: GenerateRebuttalInput;
  error?: string;
}
interface TranscriptionActivityDetails {
  fileName: string;
  transcriptionOutput: TranscriptionOutput;
  error?: string;
}
interface TrainingDeckActivityDetails {
  deckOutput: GenerateTrainingDeckOutput;
  inputData: GenerateTrainingDeckInput; 
  error?: string;
}


export function ActivityTable({ activities }: ActivityTableProps) {
  const [selectedActivity, setSelectedActivity] = useState<ActivityLogEntry | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleViewDetails = (activity: ActivityLogEntry) => {
    setSelectedActivity(activity);
    setIsDialogOpen(true);
  };

  const sortedActivities = [...activities].sort((a, b) => {
    if (!sortKey) return 0;
    const valA = a[sortKey];
    const valB = b[sortKey];

    let comparison = 0;
    if (valA === undefined || valA === null) comparison = -1;
    else if (valB === undefined || valB === null) comparison = 1;
    else if (valA > valB) comparison = 1;
    else if (valA < valB) comparison = -1;
    
    return sortDirection === 'desc' ? comparison * -1 : comparison;
  });

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
    return sortDirection === 'asc' ? <ArrowUpDown className="ml-2 h-4 w-4 inline transform rotate-180" /> : <ArrowUpDown className="ml-2 h-4 w-4 inline" />;
  };
  
  const formatDetailsForPre = (details: any): string => {
    if (typeof details === 'string') return details;
    if (typeof details === 'object' && details !== null) {
      return JSON.stringify(details, null, 2);
    }
    return 'N/A';
  };
  
  const getDetailsPreview = (activity: ActivityLogEntry): string => {
    const details = activity.details;
    if (typeof details === 'string') return details.substring(0,50) + (details.length > 50 ? '...' : '');
    
    if (typeof details === 'object' && details !== null) {
        if ('error' in details && typeof details.error === 'string') return `Error: ${details.error.substring(0, 40)}...`;

        switch(activity.module) {
            case "Call Scoring":
                if (isCallScoringDetails(details)) {
                    return `Call Scored: ${details.fileName || 'Unknown'}. Score: ${details.scoreOutput.overallScore || 'N/A'}`;
                }
                break;
            case "Pitch Generator":
                 if (isPitchGeneratorDetails(details)) {
                    return `Pitch: ${details.pitchOutput.headlineHook.substring(0,40)}...`;
                }
                break;
            case "Rebuttal Generator":
                if (isRebuttalGeneratorDetails(details)) {
                    return `Rebuttal for: "${(details.inputData?.objection || 'N/A').substring(0,30)}..."`;
                }
                break;
            case "Transcription":
                 if (isTranscriptionDetails(details)) {
                    return `Transcribed: ${details.fileName}. Accuracy: ${details.transcriptionOutput.accuracyAssessment}`;
                }
                break;
            case "Create Training Deck":
                if (isTrainingDeckDetails(details)) {
                    return `Deck: ${details.deckOutput.deckTitle.substring(0,40)}...`;
                }
                break;
        }
        return JSON.stringify(details).substring(0,50) + (JSON.stringify(details).length > 50 ? '...' : '');
    }
    return 'No specific preview.';
  };

  // Type guards
  const isCallScoringDetails = (details: any): details is CallScoringActivityDetails => 
    typeof details === 'object' && details !== null && 'scoreOutput' in details && 'fileName' in details;
  const isPitchGeneratorDetails = (details: any): details is PitchGeneratorActivityDetails => 
    typeof details === 'object' && details !== null && 'pitchOutput' in details && 'inputData' in details;
  const isRebuttalGeneratorDetails = (details: any): details is RebuttalGeneratorActivityDetails => 
    typeof details === 'object' && details !== null && 'rebuttalOutput' in details && 'inputData' in details;
  const isTranscriptionDetails = (details: any): details is TranscriptionActivityDetails =>
    typeof details === 'object' && details !== null && 'transcriptionOutput' in details && 'fileName' in details;
  const isTrainingDeckDetails = (details: any): details is TrainingDeckActivityDetails =>
    typeof details === 'object' && details !== null && 'deckOutput' in details && 'inputData' in details;


  return (
    <>
      <ScrollArea className="h-[calc(100vh-280px)] rounded-md border shadow-sm">
        <Table>
          <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm">
            <TableRow>
              <TableHead onClick={() => requestSort('timestamp')} className="cursor-pointer">
                Date {getSortIndicator('timestamp')}
              </TableHead>
              <TableHead onClick={() => requestSort('module')} className="cursor-pointer">
                Module {getSortIndicator('module')}
              </TableHead>
              <TableHead onClick={() => requestSort('product')} className="cursor-pointer">
                Product {getSortIndicator('product')}
              </TableHead>
              <TableHead onClick={() => requestSort('agentName')} className="cursor-pointer">
                Agent {getSortIndicator('agentName')}
              </TableHead>
              <TableHead>Details Preview</TableHead>
              <TableHead className="text-right">View Result</TableHead> 
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedActivities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No activities logged yet.
                </TableCell>
              </TableRow>
            ) : (
              sortedActivities.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell>{format(parseISO(activity.timestamp), 'PPpp')}</TableCell>
                  <TableCell>{activity.module}</TableCell>
                  <TableCell>{activity.product || 'N/A'}</TableCell>
                  <TableCell>{activity.agentName || 'N/A'}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {getDetailsPreview(activity)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => handleViewDetails(activity)}> 
                      <Eye className="mr-2 h-4 w-4" /> View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      {selectedActivity && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-lg md:max-w-2xl lg:max-w-4xl max-h-[85vh] flex flex-col">
            <DialogHeader className="p-6 pb-2 border-b">
              <DialogTitle>Activity Details: {selectedActivity.module}</DialogTitle>
              <DialogDescription>
                Logged on: {format(parseISO(selectedActivity.timestamp), 'PPPP pppp')}
                {selectedActivity.agentName && ` by ${selectedActivity.agentName}`}
                {selectedActivity.product && `, Product: ${selectedActivity.product}`}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow p-6 overflow-y-auto">
              {typeof selectedActivity.details === 'object' && selectedActivity.details !== null && 'error' in selectedActivity.details && typeof selectedActivity.details.error === 'string' ? (
                 <div className="space-y-2 text-sm text-destructive">
                    <p><strong>Error Occurred:</strong></p>
                    <pre className="bg-destructive/10 p-3 rounded-md text-xs whitespace-pre-wrap break-all">
                        {formatDetailsForPre(selectedActivity.details)}
                    </pre>
                 </div>
              ) : selectedActivity.module === "Call Scoring" && isCallScoringDetails(selectedActivity.details) ? (
                <CallScoringResultsCard 
                  results={selectedActivity.details.scoreOutput} 
                  fileName={selectedActivity.details.fileName} 
                  // audioDataUri is not stored in activity log, so playback is not available here from activity dashboard
                />
              ) : selectedActivity.module === "Pitch Generator" && isPitchGeneratorDetails(selectedActivity.details) ? (
                <div className="space-y-4">
                    <div>
                        <h4 className="font-semibold text-md text-muted-foreground mb-1">Pitch Request (Input):</h4>
                        <pre className="p-3 bg-muted/20 rounded-md text-sm whitespace-pre-wrap">
                            {formatDetailsForPre(selectedActivity.details.inputData)}
                        </pre>
                    </div>
                    <Separator />
                    <div>
                        <h4 className="font-semibold text-md text-muted-foreground mb-1">Generated Pitch (Output):</h4>
                        <PitchCard pitch={selectedActivity.details.pitchOutput} />
                    </div>
                </div>
              ) : selectedActivity.module === "Rebuttal Generator" && isRebuttalGeneratorDetails(selectedActivity.details) ? (
                <div className="space-y-4">
                    <div>
                        <h4 className="font-semibold text-md text-muted-foreground mb-1">Customer Objection (Input):</h4>
                        <p className="p-3 bg-muted/20 rounded-md text-sm whitespace-pre-line">{selectedActivity.details.inputData.objection}</p>
                         <p className="text-xs text-muted-foreground mt-1">Product: {selectedActivity.details.inputData.product}</p>
                    </div>
                    <Separator />
                    <div>
                        <h4 className="font-semibold text-md text-muted-foreground mb-1">Generated Rebuttal (Output):</h4>
                        <RebuttalDisplay rebuttal={selectedActivity.details.rebuttalOutput} />
                    </div>
                </div>
              ) : selectedActivity.module === "Transcription" && isTranscriptionDetails(selectedActivity.details) ? (
                <div className="space-y-3">
                    <h3 className="font-semibold text-lg flex items-center"><Mic2Icon className="mr-2 h-5 w-5"/>Transcript: {selectedActivity.details.fileName}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        Accuracy: {selectedActivity.details.transcriptionOutput.accuracyAssessment}
                    </div>
                    <Label htmlFor="transcript-text-area">Full Transcript:</Label>
                    <Textarea 
                        id="transcript-text-area"
                        value={selectedActivity.details.transcriptionOutput.diarizedTranscript} 
                        readOnly 
                        className="min-h-[200px] bg-muted/20 whitespace-pre-wrap" 
                    />
                </div>
              ) : selectedActivity.module === "Create Training Deck" && isTrainingDeckDetails(selectedActivity.details) ? (
                 <div className="space-y-4">
                    <div>
                        <h4 className="font-semibold text-md text-muted-foreground mb-1">Training Deck Request (Input):</h4>
                         <pre className="p-3 bg-muted/20 rounded-md text-sm whitespace-pre-wrap">
                            {formatDetailsForPre(selectedActivity.details.inputData)}
                        </pre>
                    </div>
                    <Separator />
                    <div>
                        <h4 className="font-semibold text-md text-muted-foreground mb-1">Generated Deck Outline (Output):</h4>
                        <div className="space-y-3 border p-3 rounded-md bg-muted/10">
                            <h3 className="font-semibold text-lg flex items-center"><BookOpenIcon className="mr-2 h-5 w-5"/>{selectedActivity.details.deckOutput.deckTitle}</h3>
                            <Label>Slides:</Label>
                            <ScrollArea className="max-h-[300px] overflow-y-auto">
                                {selectedActivity.details.deckOutput.slides.map((slide, index) => (
                                    <div key={index} className="pb-2 mb-2 border-b last:border-b-0">
                                        <h4 className="font-medium text-md">Slide {index + 1}: {slide.title}</h4>
                                        <p className="text-xs text-muted-foreground whitespace-pre-line">{slide.content}</p>
                                        {slide.notes && <p className="text-xs text-accent-foreground/70 mt-1 italic">Notes: {slide.notes}</p>}
                                    </div>
                                ))}
                            </ScrollArea>
                        </div>
                    </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <p><strong>Details:</strong></p>
                  <pre className="bg-muted p-3 rounded-md text-xs whitespace-pre-wrap break-all">
                    {formatDetailsForPre(selectedActivity.details)}
                  </pre>
                </div>
              )}
            </ScrollArea>
            <DialogFooter className="p-4 border-t bg-muted/50">
                <Button onClick={() => setIsDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
