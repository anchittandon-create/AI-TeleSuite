
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
import { Eye, ArrowUpDown, FileText as FileTextIcon, MessageSquareReply as MessageSquareReplyIcon, ListChecks as ListChecksIcon, BookOpen as BookOpenIcon, Mic2 as Mic2Icon, Info, Lightbulb, FileSearch, LayoutList } from 'lucide-react';

// Import components for rich display
import { CallScoringResultsCard } from '../call-scoring/call-scoring-results-card';
import { PitchCard } from '../pitch-generator/pitch-card';
import { RebuttalDisplay } from '../rebuttal-generator/rebuttal-display';
import { DataAnalysisResultsCard } from '../data-analysis/data-analysis-results-card'; 
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

// Import type definitions for details
import type { ScoreCallOutput } from '@/ai/flows/call-scoring';
import type { GeneratePitchInput, GeneratePitchOutput } from '@/ai/flows/pitch-generator';
import type { GenerateRebuttalInput, GenerateRebuttalOutput } from '@/ai/flows/rebuttal-generator';
import type { TranscriptionOutput } from '@/ai/flows/transcription-flow';
import type { GenerateTrainingDeckInput, GenerateTrainingDeckOutput, KnowledgeBaseItemSchema as FlowKnowledgeBaseItemSchema } from '@/ai/flows/training-deck-generator';
import type { DataAnalysisInput, DataAnalysisOutput } from '@/ai/flows/data-analyzer'; 
import type { z } from 'zod';


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
interface TrainingMaterialActivityDetails { // Renamed from TrainingDeck
  materialOutput: GenerateTrainingDeckOutput; // Renamed from deckOutput
  inputData: GenerateTrainingDeckInput; 
  error?: string;
}
interface DataAnalysisActivityDetails { 
  analysisOutput: DataAnalysisOutput;
  inputData: Pick<DataAnalysisInput, 'fileName' | 'fileType' | 'userDescription'>;
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
      if (details.product && details.customerCohort) { 
        return `Product: ${details.product}\nCohort: ${details.customerCohort}${details.etPlanConfiguration ? `\nET Plan: ${details.etPlanConfiguration}` : ''}`;
      }
      if (details.objection && details.product) { 
        return `Product: ${details.product}\nObjection: ${details.objection}`;
      }
       if (details.product && details.deckFormatHint && Array.isArray(details.knowledgeBaseItems)) {
        return `Product: ${details.product}\nFormat: ${details.deckFormatHint}\nKB Source: ${details.generateFromAllKb ? 'All KB' : `${details.knowledgeBaseItems.length} items`}\nItems: ${details.knowledgeBaseItems.map((item: any) => item.name).join(', ').substring(0,100)}...`;
      }
       if (details.fileName && details.fileType) { 
        return `File: ${details.fileName} (${details.fileType})\nGoal: ${details.userDescription || 'N/A'}`;
      }

      if (Array.isArray(details)) {
        return JSON.stringify(details.map(item => (item && typeof item.name === 'string' ? item.name : item)), null, 2);
      }
      return JSON.stringify(details, (key, value) => { // Custom replacer to shorten long textContent
        if (key === 'textContent' && typeof value === 'string' && value.length > 200) {
          return value.substring(0, 200) + "... (truncated)";
        }
        return value;
      }, 2);
    }
    return 'N/A';
  };
  
  const getDetailsPreview = (activity: ActivityLogEntry): string => {
    const details = activity.details;
    if (typeof details === 'string') return details.substring(0,50) + (details.length > 50 ? '...' : '');
    
    if (typeof details === 'object' && details !== null) {
        if (isErrorDetails(details)) return `Error: ${details.error.substring(0, 40)}...`;

        switch(activity.module) {
            case "Call Scoring":
                if (isCallScoringDetails(details)) {
                    return `Call Scored: ${details.fileName || 'Unknown File'}. Score: ${details.scoreOutput?.overallScore ?? 'N/A'}`;
                }
                break;
            case "Pitch Generator":
                 if (isPitchGeneratorDetails(details)) {
                    return `Pitch for ${details.inputData?.product || 'N/A'}: ${details.pitchOutput?.headlineHook?.substring(0,30) || 'N/A'}...`;
                }
                break;
            case "Rebuttal Generator":
                if (isRebuttalGeneratorDetails(details)) {
                    return `Rebuttal for "${(details.inputData?.objection || 'N/A').substring(0,30)}..."`;
                }
                break;
            case "Transcription":
                 if (isTranscriptionDetails(details)) {
                    return `Transcribed: ${details.fileName || 'Unknown File'}. Acc: ${details.transcriptionOutput?.accuracyAssessment || 'N/A'}`;
                }
                break;
            case "Create Training Material": // Updated module name
                if (isTrainingMaterialDetails(details)) { // Updated guard name
                    const materialType = details.inputData?.deckFormatHint === "Brochure" ? "Brochure" : "Deck";
                    return `${materialType} for ${details.inputData?.product || 'N/A'}: ${details.materialOutput?.deckTitle?.substring(0,30) || 'N/A'}...`;
                }
                break;
            case "Data Analysis": 
                if (isDataAnalysisDetails(details)) {
                    return `Analyzed: ${details.inputData?.fileName || 'N/A'}. Title: ${details.analysisOutput?.analysisTitle?.substring(0,30) || 'N/A'}...`;
                }
                break;
        }
        return "Complex object details. Click View for more.";
    }
    return 'No specific preview.';
  };

  // Type guards
  const isErrorDetails = (details: any): details is { error: string; inputData?: any } =>
    typeof details === 'object' && details !== null && 'error' in details && typeof details.error === 'string';
  const isCallScoringDetails = (details: any): details is CallScoringActivityDetails => 
    typeof details === 'object' && details !== null && 'scoreOutput' in details && typeof (details as any).scoreOutput === 'object' && 'fileName' in details;
  const isPitchGeneratorDetails = (details: any): details is PitchGeneratorActivityDetails => 
    typeof details === 'object' && details !== null && 'pitchOutput' in details && typeof (details as any).pitchOutput === 'object' && 'inputData' in details && typeof (details as any).inputData === 'object';
  const isRebuttalGeneratorDetails = (details: any): details is RebuttalGeneratorActivityDetails => 
    typeof details === 'object' && details !== null && 'rebuttalOutput' in details && typeof (details as any).rebuttalOutput === 'object' && 'inputData' in details && typeof (details as any).inputData === 'object';
  const isTranscriptionDetails = (details: any): details is TranscriptionActivityDetails =>
    typeof details === 'object' && details !== null && 'transcriptionOutput' in details && typeof (details as any).transcriptionOutput === 'object' && 'fileName' in details;
  const isTrainingMaterialDetails = (details: any): details is TrainingMaterialActivityDetails => // Updated guard name
    typeof details === 'object' && details !== null && 'materialOutput' in details && typeof (details as any).materialOutput === 'object' && 'inputData' in details && typeof (details as any).inputData === 'object';
  const isDataAnalysisDetails = (details: any): details is DataAnalysisActivityDetails => 
    typeof details === 'object' && details !== null && 'analysisOutput' in details && typeof (details as any).analysisOutput === 'object' && 'inputData' in details && typeof (details as any).inputData === 'object';


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
              {isErrorDetails(selectedActivity.details) ? (
                 <div className="space-y-3 text-sm text-destructive bg-destructive/10 p-4 rounded-md">
                    <p className="font-semibold text-lg">Error Occurred:</p>
                    {selectedActivity.details.inputData && (
                         <div>
                            <h4 className="font-medium text-md text-destructive mb-1">Input Data:</h4>
                            <pre className="text-xs whitespace-pre-wrap break-all">
                                {formatDetailsForPre(selectedActivity.details.inputData)}
                            </pre>
                        </div>
                    )}
                    <p><strong>Error Message:</strong> {selectedActivity.details.error}</p>
                 </div>
              ) : selectedActivity.module === "Call Scoring" && isCallScoringDetails(selectedActivity.details) ? (
                <CallScoringResultsCard 
                  results={selectedActivity.details.scoreOutput} 
                  fileName={selectedActivity.details.fileName} 
                />
              ) : selectedActivity.module === "Pitch Generator" && isPitchGeneratorDetails(selectedActivity.details) ? (
                <div className="space-y-4">
                    <div>
                        <h4 className="font-semibold text-md text-muted-foreground mb-2 flex items-center"><Lightbulb className="mr-2 h-5 w-5 text-accent"/>Pitch Request (Input):</h4>
                        <pre className="p-3 bg-muted/10 rounded-md text-sm whitespace-pre-wrap break-all">
                            {formatDetailsForPre(selectedActivity.details.inputData)}
                        </pre>
                    </div>
                    <Separator />
                    <div>
                        <h4 className="font-semibold text-md text-muted-foreground mb-2">Generated Pitch (Output):</h4>
                        <PitchCard pitch={selectedActivity.details.pitchOutput} />
                    </div>
                </div>
              ) : selectedActivity.module === "Rebuttal Generator" && isRebuttalGeneratorDetails(selectedActivity.details) ? (
                <div className="space-y-4">
                    <div>
                        <h4 className="font-semibold text-md text-muted-foreground mb-2 flex items-center"><MessageSquareReplyIcon className="mr-2 h-5 w-5 text-accent"/>Customer Objection (Input):</h4>
                        <pre className="p-3 bg-muted/10 rounded-md text-sm whitespace-pre-wrap break-all">
                            {formatDetailsForPre(selectedActivity.details.inputData)}
                        </pre>
                    </div>
                    <Separator />
                    <div>
                        <h4 className="font-semibold text-md text-muted-foreground mb-2">Generated Rebuttal (Output):</h4>
                        <RebuttalDisplay rebuttal={selectedActivity.details.rebuttalOutput} />
                    </div>
                </div>
              ) : selectedActivity.module === "Transcription" && isTranscriptionDetails(selectedActivity.details) ? (
                <div className="space-y-3">
                    <h3 className="font-semibold text-lg flex items-center"><Mic2Icon className="mr-2 h-5 w-5 text-accent"/>Transcript: {selectedActivity.details.fileName || "N/A"}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        Accuracy: {selectedActivity.details.transcriptionOutput?.accuracyAssessment || "N/A"}
                    </div>
                    <Label htmlFor="transcript-text-area">Full Transcript:</Label>
                    <Textarea 
                        id="transcript-text-area"
                        value={selectedActivity.details.transcriptionOutput?.diarizedTranscript || "Transcript not available."} 
                        readOnly 
                        className="min-h-[200px] bg-muted/20 whitespace-pre-wrap" 
                    />
                </div>
              ) : selectedActivity.module === "Create Training Material" && isTrainingMaterialDetails(selectedActivity.details) ? ( // Updated module name
                 <div className="space-y-4">
                    <div>
                        <h4 className="font-semibold text-md text-muted-foreground mb-2 flex items-center">
                           {selectedActivity.details.inputData.deckFormatHint === "Brochure" ? <LayoutList className="mr-2 h-5 w-5 text-accent"/> : <BookOpenIcon className="mr-2 h-5 w-5 text-accent"/>}
                           Training Material Request (Input):
                        </h4>
                         <pre className="p-3 bg-muted/10 rounded-md text-sm whitespace-pre-wrap break-all">
                            {formatDetailsForPre({
                                product: selectedActivity.details.inputData.product,
                                deckFormatHint: selectedActivity.details.inputData.deckFormatHint,
                                knowledgeBaseItems: selectedActivity.details.inputData.knowledgeBaseItems, // Pass full items for better formatting
                                generateFromAllKb: selectedActivity.details.inputData.generateFromAllKb
                            })}
                        </pre>
                    </div>
                    <Separator />
                    <div>
                        <h4 className="font-semibold text-md text-muted-foreground mb-2">Generated Content Outline (Output):</h4>
                        <div className="space-y-3 border p-3 rounded-md bg-muted/10">
                            <h3 className="font-semibold text-lg flex items-center">
                                {selectedActivity.details.inputData.deckFormatHint === "Brochure" ? <LayoutList className="mr-2 h-5 w-5"/> : <BookOpenIcon className="mr-2 h-5 w-5"/>}
                                {selectedActivity.details.materialOutput?.deckTitle || "Untitled Material"}
                            </h3>
                            <Label>Sections / Slides / Panels:</Label>
                            <ScrollArea className="max-h-[300px] overflow-y-auto">
                                {selectedActivity.details.materialOutput?.sections?.map((section, index) => (
                                    <div key={index} className="pb-2 mb-2 border-b last:border-b-0">
                                        <h4 className="font-medium text-md">{section.title}</h4>
                                        <p className="text-xs text-muted-foreground whitespace-pre-line">{section.content}</p>
                                        {section.notes && <p className="text-xs text-accent-foreground/70 mt-1 italic">Notes: {section.notes}</p>}
                                    </div>
                                )) || <p className="text-muted-foreground">No sections generated.</p>}
                            </ScrollArea>
                        </div>
                    </div>
                </div>
              ) : selectedActivity.module === "Data Analysis" && isDataAnalysisDetails(selectedActivity.details) ? ( 
                <div className="space-y-4">
                    <div>
                        <h4 className="font-semibold text-md text-muted-foreground mb-2 flex items-center"><FileSearch className="mr-2 h-5 w-5 text-accent"/>Data Analysis Request (Input):</h4>
                        <pre className="p-3 bg-muted/10 rounded-md text-sm whitespace-pre-wrap break-all">
                            {formatDetailsForPre(selectedActivity.details.inputData)}
                        </pre>
                    </div>
                    <Separator />
                    <div>
                        <h4 className="font-semibold text-md text-muted-foreground mb-2">Generated Analysis (Output):</h4>
                         <DataAnalysisResultsCard 
                            results={selectedActivity.details.analysisOutput} 
                            fileName={selectedActivity.details.inputData.fileName}
                            userDescription={selectedActivity.details.inputData.userDescription}
                        />
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
