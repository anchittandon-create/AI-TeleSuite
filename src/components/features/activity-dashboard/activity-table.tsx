
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ActivityLogEntry } from "@/types";
import { format, parseISO } from 'date-fns';
import { Eye, ArrowUpDown } from 'lucide-react';
import { CallScoringResultsCard } from '../call-scoring/call-scoring-results-card'; // IMPORTED
import type { ScoreCallOutput } from '@/ai/flows/call-scoring'; // IMPORTED for type checking

interface ActivityTableProps {
  activities: ActivityLogEntry[];
}

type SortKey = keyof ActivityLogEntry | null;
type SortDirection = 'asc' | 'desc';

// Define a type for the expected structure of Call Scoring details
interface CallScoringActivityDetails {
  fileName: string;
  scoreOutput: ScoreCallOutput;
  error?: string; // Optional error field
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
  
  const getDetailsPreview = (details: any): string => {
    if (typeof details === 'string') return details.substring(0,50) + (details.length > 50 ? '...' : '');
    if (typeof details === 'object' && details !== null) {
        if ('scoreOutput' in details && typeof details.scoreOutput === 'object' && details.scoreOutput && 'overallScore' in details.scoreOutput) {
             const scoringDetails = details as CallScoringActivityDetails;
             return `Call Scored: ${scoringDetails.fileName || 'Unknown File'}. Score: ${scoringDetails.scoreOutput.overallScore || 'N/A'}`;
        }
        if (typeof details.headlineHook === 'string') {
            return `Pitch: ${details.headlineHook.substring(0,40)}...`;
        }
         if (typeof details.rebuttal === 'string') {
            return `Rebuttal: ${details.rebuttal.substring(0,40)}...`;
        }
        if (typeof details.diarizedTranscript === 'string') {
            return `Transcript: ${details.diarizedTranscript.substring(0,40)}...`;
        }
         if (typeof details.deckTitle === 'string') {
            return `Deck: ${details.deckTitle.substring(0,40)}...`;
        }
        // Fallback for other object details
        return JSON.stringify(details).substring(0,50) + (JSON.stringify(details).length > 50 ? '...' : '');
    }
    return 'No specific preview.';
  };

  // Helper to check if details are for Call Scoring
  const isCallScoringDetails = (details: any): details is CallScoringActivityDetails => {
    return typeof details === 'object' && details !== null && 'scoreOutput' in details && 'fileName' in details;
  };


  return (
    <>
      <ScrollArea className="h-[calc(100vh-280px)] rounded-md border shadow-sm"> {/* Adjust height as needed */}
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
                    {getDetailsPreview(activity.details)}
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
              {selectedActivity.module === "Call Scoring" && isCallScoringDetails(selectedActivity.details) ? (
                <CallScoringResultsCard 
                  results={selectedActivity.details.scoreOutput} 
                  fileName={selectedActivity.details.fileName} 
                  // audioDataUri is not available in activity log, card handles this
                />
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
