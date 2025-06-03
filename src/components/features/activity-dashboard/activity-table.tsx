
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
import { Eye, ArrowUpDown, FileText as FileTextIcon, MessageSquareReply as MessageSquareReplyIcon, ListChecks as ListChecksIcon, BookOpen as BookOpenIcon, Mic2 as Mic2Icon, Info, Lightbulb, FileSearch, LayoutList, DatabaseZap, Settings } from 'lucide-react';

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
import type { DataAnalysisInput, DataAnalysisStrategyOutput } from '@/ai/flows/data-analyzer'; 
import type { TrainingMaterialActivityDetails, KnowledgeFile } from '@/types'; 
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
  // audioDataUri is intentionally omitted for historical dashboard view
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
  // audioDataUri is intentionally omitted for historical dashboard view
}

interface DataAnalysisStrategyActivityDetails { 
  analysisOutput: DataAnalysisStrategyOutput;
  inputData: DataAnalysisInput; 
  error?: string;
}

interface KnowledgeBaseActivityDetails extends Partial<KnowledgeFile> { // Can be partial for uploads
  fileData?: Omit<KnowledgeFile, 'id' | 'uploadDate'>; // For single text entry
  filesData?: Array<Omit<KnowledgeFile, 'id' | 'uploadDate'>>; // For batch file upload
  action?: 'add' | 'delete' | 'update';
  fileId?: string; // for delete/update
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
  
  const formatKnowledgeBaseInputs = (details: KnowledgeBaseActivityDetails): string => {
    let inputStr = `Action: ${details.action || 'unknown'}\n`;
    if (details.fileData) {
        inputStr += `Entry Name: ${details.fileData.name}\nType: ${details.fileData.type}\n`;
        if (details.fileData.product) inputStr += `Product: ${details.fileData.product}\n`;
        if (details.fileData.persona) inputStr += `Persona: ${details.fileData.persona}\n`;
        if (details.fileData.isTextEntry && details.fileData.textContent) {
            inputStr += `Content (excerpt): ${details.fileData.textContent.substring(0,100)}...\n`;
        }
    }
    if (details.filesData && details.filesData.length > 0) {
        inputStr += `Files (${details.filesData.length}):\n${details.filesData.map(f => `  - ${f.name} (${f.type || 'N/A'})`).join('\n')}\n`;
        if (details.filesData[0].product) inputStr += `Product (for batch): ${details.filesData[0].product}\n`;
        if (details.filesData[0].persona) inputStr += `Persona (for batch): ${details.filesData[0].persona}\n`;
    }
    if (details.fileId) inputStr += `File ID: ${details.fileId}\n`;
    if (details.error) inputStr += `Error: ${details.error}\n`;
    return inputStr;
  };

  const formatDetailsForPre = (activity: ActivityLogEntry): string => {
    const details = activity.details;
    if (typeof details === 'string') return details;
    if (typeof details === 'object' && details !== null) {
      if (isErrorDetails(details)) {
        let errorStr = `Error: ${details.error}\n`;
        if (details.inputData) errorStr += `Input Data (Context): ${JSON.stringify(details.inputData, null, 2)}`;
        return errorStr;
      }

      switch(activity.module) {
          case "Pitch Generator":
              if (isPitchGeneratorDetails(details)) {
                  return `Input:\n  Product: ${details.inputData.product}\n  Cohort: ${details.inputData.customerCohort}${details.inputData.etPlanConfiguration ? `\n  ET Plan: ${details.inputData.etPlanConfiguration}` : ''}`;
              }
              break;
          case "Rebuttal Generator":
              if (isRebuttalGeneratorDetails(details)) {
                  return `Input:\n  Product: ${details.inputData.product}\n  Objection: ${details.inputData.objection}`;
              }
              break;
          case "Create Training Material":
              if (isTrainingMaterialDetails(details)) {
                  let inputStr = `Input:\n  Product: ${details.inputData.product}\n  Format: ${details.inputData.deckFormatHint}\n`;
                  inputStr += `  Context Source: ${details.inputData.sourceDescriptionForAi || (details.inputData.generateFromAllKb ? 'Entire KB' : `${details.inputData.knowledgeBaseItems.length} items`)}\n`;
                  if (details.inputData.knowledgeBaseItems && details.inputData.knowledgeBaseItems.length > 0) {
                      inputStr += `  Items (Names):\n${details.inputData.knowledgeBaseItems.map((item: any) => `    - ${item.name} (${item.isTextEntry ? 'Text' : item.fileType || 'File'})`).join('\n')}`;
                  }
                  return inputStr;
              }
              break;
          case "Data Analysis Strategy": 
              if (isDataAnalysisStrategyDetails(details)) {
                  let inputStr = `Input:\n  User Prompt: ${details.inputData.userAnalysisPrompt}\n`;
                  inputStr += `  File Context (${details.inputData.fileDetails.length}):\n${details.inputData.fileDetails.map(f => `    - ${f.fileName} (Type: ${f.fileType})`).join('\n')}\n`;
                  if (details.inputData.sampledFileContent) {
                      inputStr += `  Sampled Text (first ~10k chars):\n    ${details.inputData.sampledFileContent.substring(0,200)}...\n`;
                  }
                  return inputStr;
              }
              break;
           case "Knowledge Base Management":
              if (isKnowledgeBaseDetails(details)) {
                  return formatKnowledgeBaseInputs(details);
              }
              break;
      }
      // Fallback for other modules or if type guard fails
      return JSON.stringify(details, (key, value) => { 
        if (key === 'textContent' && typeof value === 'string' && value.length > 200) {
          return value.substring(0, 200) + "... (truncated)";
        }
        if (key === 'knowledgeBaseItems' && Array.isArray(value) && value.length > 5) {
          return `Array of ${value.length} items (first 5 names shown): ` + JSON.stringify(value.slice(0,5).map(item => item.name || 'Unnamed Item')) + "...";
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
            case "Create Training Material": 
                if (isTrainingMaterialDetails(details)) { 
                    const materialType = details.inputData?.deckFormatHint === "Brochure" ? "Brochure" : "Deck";
                    return `${materialType} for ${details.inputData?.product || 'N/A'}: ${details.materialOutput?.deckTitle?.substring(0,30) || 'N/A'}...`;
                }
                break;
            case "Data Analysis Strategy": 
                if (isDataAnalysisStrategyDetails(details)) {
                    return `Strategy: ${details.inputData.userAnalysisPrompt.substring(0,30) || 'N/A'}... Title: ${details.analysisOutput?.analysisTitle?.substring(0,20) || 'N/A'}...`;
                }
                break;
             case "Knowledge Base Management":
                if (isKnowledgeBaseDetails(details)) {
                    return `Action: ${details.action || 'update'}. Item: ${details.name || details.fileData?.name || (details.filesData && details.filesData[0]?.name) || 'N/A'}`;
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
  const isTrainingMaterialDetails = (details: any): details is TrainingMaterialActivityDetails => 
    typeof details === 'object' && details !== null && 'materialOutput' in details && typeof (details as any).materialOutput === 'object' && 'inputData' in details && typeof (details as any).inputData === 'object';
  const isDataAnalysisStrategyDetails = (details: any): details is DataAnalysisStrategyActivityDetails => 
    typeof details === 'object' && details !== null && 'analysisOutput' in details && typeof (details as any).analysisOutput === 'object' && 'inputData' in details && typeof (details as any).inputData === 'object';
  const isKnowledgeBaseDetails = (details: any): details is KnowledgeBaseActivityDetails =>
    typeof details === 'object' && details !== null && ('fileData' in details || 'filesData' in details || 'action' in details || 'fileId' in details);


  const renderInputContext = (activity: ActivityLogEntry) => {
    if (!activity.details || typeof activity.details !== 'object' || isErrorDetails(activity.details)) return null;

    if (isPitchGeneratorDetails(activity.details)) {
        return <pre className="p-3 bg-muted/10 rounded-md text-sm whitespace-pre-wrap break-all">{formatDetailsForPre(activity)}</pre>;
    }
    if (isRebuttalGeneratorDetails(activity.details)) {
        return <pre className="p-3 bg-muted/10 rounded-md text-sm whitespace-pre-wrap break-all">{formatDetailsForPre(activity)}</pre>;
    }
    if (isTrainingMaterialDetails(activity.details)) {
        return <pre className="p-3 bg-muted/10 rounded-md text-sm whitespace-pre-wrap break-all">{formatDetailsForPre(activity)}</pre>;
    }
    if (isDataAnalysisStrategyDetails(activity.details)) {
        return <pre className="p-3 bg-muted/10 rounded-md text-sm whitespace-pre-wrap break-all">{formatDetailsForPre(activity)}</pre>;
    }
     if (isKnowledgeBaseDetails(activity.details) && activity.module === "Knowledge Base Management") {
        return <pre className="p-3 bg-muted/10 rounded-md text-sm whitespace-pre-wrap break-all">{formatDetailsForPre(activity)}</pre>;
    }
    return null;
  };

  const renderOutputDisplay = (activity: ActivityLogEntry) => {
     if (!activity.details || typeof activity.details !== 'object' || isErrorDetails(activity.details)) return null;

    if (isCallScoringDetails(activity.details) && activity.module === "Call Scoring") {
        return <CallScoringResultsCard results={activity.details.scoreOutput} fileName={activity.details.fileName} isHistoricalView={true} />;
    }
    if (isPitchGeneratorDetails(activity.details) && activity.module === "Pitch Generator") {
        return <PitchCard pitch={activity.details.pitchOutput} />;
    }
    if (isRebuttalGeneratorDetails(activity.details) && activity.module === "Rebuttal Generator") {
        return <RebuttalDisplay rebuttal={activity.details.rebuttalOutput} />;
    }
    if (isTranscriptionDetails(activity.details) && activity.module === "Transcription") {
         return (
            <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center"><Mic2Icon className="mr-2 h-5 w-5 text-accent"/>Transcript: {activity.details.fileName || "N/A"}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    Accuracy: {activity.details.transcriptionOutput?.accuracyAssessment || "N/A"}
                </div>
                <p className="text-xs text-muted-foreground italic">Original audio is not available in historical dashboard views.</p>
                <Label htmlFor="transcript-text-area">Full Transcript:</Label>
                <Textarea 
                    id="transcript-text-area"
                    value={activity.details.transcriptionOutput?.diarizedTranscript || "Transcript not available."} 
                    readOnly 
                    className="min-h-[200px] bg-muted/20 whitespace-pre-wrap" 
                />
            </div>
        );
    }
    if (isTrainingMaterialDetails(activity.details) && activity.module === "Create Training Material") {
        const { materialOutput, inputData } = activity.details;
        return (
            <div className="space-y-3 border p-3 rounded-md bg-muted/10">
                <h3 className="font-semibold text-lg flex items-center">
                    {inputData.deckFormatHint === "Brochure" ? <LayoutList className="mr-2 h-5 w-5"/> : <BookOpenIcon className="mr-2 h-5 w-5"/>}
                    {materialOutput?.deckTitle || "Untitled Material"}
                </h3>
                <Label>Sections / Slides / Panels:</Label>
                <ScrollArea className="max-h-[300px] overflow-y-auto">
                    {materialOutput?.sections?.map((section, index) => (
                        <div key={index} className="pb-2 mb-2 border-b last:border-b-0">
                            <h4 className="font-medium text-md">{section.title}</h4>
                            <p className="text-xs text-muted-foreground whitespace-pre-line">{section.content}</p>
                            {section.notes && <p className="text-xs text-accent-foreground/70 mt-1 italic">Notes: {section.notes}</p>}
                        </div>
                    )) || <p className="text-muted-foreground">No sections generated.</p>}
                </ScrollArea>
            </div>
        );
    }
    if (isDataAnalysisStrategyDetails(activity.details) && activity.module === "Data Analysis Strategy") {
        return <DataAnalysisResultsCard strategyOutput={activity.details.analysisOutput} userAnalysisPrompt={activity.details.inputData.userAnalysisPrompt} fileContext={activity.details.inputData.fileDetails} />;
    }
    return null;
  };


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
                            <h4 className="font-medium text-md text-destructive mb-1">Input Data (Context):</h4>
                            <pre className="text-xs whitespace-pre-wrap break-all">
                                {formatDetailsForPre(selectedActivity)}
                            </pre>
                        </div>
                    )}
                    <p><strong>Error Message:</strong> {selectedActivity.details.error}</p>
                 </div>
              ) : (
                <div className="space-y-6">
                  {/* Display Input Context if available */}
                  {renderInputContext(selectedActivity) && (
                    <div>
                        <h4 className="font-semibold text-md text-muted-foreground mb-2 flex items-center">
                           <Settings className="mr-2 h-5 w-5 text-accent"/>Input Context
                        </h4>
                        {renderInputContext(selectedActivity)}
                        <Separator className="my-4"/>
                    </div>
                  )}
                  
                  {/* Display Output/Result */}
                  {renderOutputDisplay(selectedActivity) ? (
                    <div>
                        <h4 className="font-semibold text-md text-muted-foreground mb-2 flex items-center">
                           <Info className="mr-2 h-5 w-5 text-accent"/>Result / Output
                        </h4>
                        {renderOutputDisplay(selectedActivity)}
                    </div>
                  ) : (
                     <div className="space-y-2 text-sm">
                        <p><strong>Raw Details:</strong></p>
                        <pre className="bg-muted p-3 rounded-md text-xs whitespace-pre-wrap break-all">
                            {formatDetailsForPre(selectedActivity)}
                        </pre>
                    </div>
                  )}
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

