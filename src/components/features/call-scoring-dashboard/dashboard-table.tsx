
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
import { Badge } from "@/components/ui/badge";
import { Eye, Star, ArrowUpDown, AlertTriangle, CheckCircle, AlertCircle, ShieldCheck, ShieldAlert } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { HistoricalScoreItem } from '@/app/(main)/call-scoring-dashboard/page';
import { CallScoringResultsCard } from '../call-scoring/call-scoring-results-card';
import { CallScoreCategory } from '@/types';

interface CallScoringDashboardTableProps {
  history: HistoricalScoreItem[];
}

type SortKey = keyof HistoricalScoreItem | 'overallScore' | 'callCategorisation' | 'transcriptAccuracy' | 'dateScored';
type SortDirection = 'asc' | 'desc';

const mapAccuracyToPercentageString = (assessment: string): string => {
  if (!assessment) return "N/A";
  const lowerAssessment = assessment.toLowerCase();
  if (lowerAssessment.includes("high")) return "High (est. 95%+)";
  if (lowerAssessment.includes("medium")) return "Medium (est. 80-94%)";
  if (lowerAssessment.includes("low")) return "Low (est. <80%)";
  if (lowerAssessment.includes("error")) return "Error";
  return assessment; // Fallback for unknown values
};

export function CallScoringDashboardTable({ history }: CallScoringDashboardTableProps) {
  const [selectedItem, setSelectedItem] = useState<HistoricalScoreItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('dateScored');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleViewDetails = (item: HistoricalScoreItem) => {
    setSelectedItem(item);
    setIsDialogOpen(true);
  };

  const renderStars = (score: number, small: boolean = false) => {
    const stars = [];
    const starClass = small ? "h-3.5 w-3.5" : "h-5 w-5";
    for (let i = 1; i <= 5; i++) {
      if (score >= i) {
        stars.push(<Star key={i} className={`${starClass} text-yellow-400 fill-yellow-400`} />);
      } else {
        stars.push(<Star key={i} className={`${starClass} text-muted-foreground/50`} />);
      }
    }
    return stars;
  };

  const getCategoryBadgeVariant = (category?: CallScoreCategory | string): "default" | "secondary" | "destructive" | "outline" => {
    switch (category?.toLowerCase()) {
      case 'very good': return 'default';
      case 'good': return 'secondary';
      case 'average': return 'outline';
      case 'bad':
      case 'very bad':
      case 'error': return 'destructive';
      default: return 'secondary'; 
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

  const sortedHistory = [...history].sort((a, b) => {
    let valA: any, valB: any;

    if (sortKey === 'overallScore') {
      valA = a.scoreOutput.overallScore;
      valB = b.scoreOutput.overallScore;
    } else if (sortKey === 'callCategorisation') {
      valA = a.scoreOutput.callCategorisation;
      valB = b.scoreOutput.callCategorisation;
    } else if (sortKey === 'transcriptAccuracy') {
      valA = a.scoreOutput.transcriptAccuracy;
      valB = b.scoreOutput.transcriptAccuracy;
    } else if (sortKey === 'dateScored') {
      valA = new Date(a.timestamp).getTime();
      valB = new Date(b.timestamp).getTime();
    } else {
      valA = a[sortKey as keyof HistoricalScoreItem];
      valB = b[sortKey as keyof HistoricalScoreItem];
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


  return (
    <>
      <div className="w-full mt-2 shadow-lg rounded-lg border bg-card">
        <ScrollArea className="h-[calc(100vh-340px)] md:h-[calc(100vh-310px)]">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm z-10">
              <TableRow>
                <TableHead onClick={() => requestSort('fileName')} className="cursor-pointer">File Name {getSortIndicator('fileName')}</TableHead>
                <TableHead onClick={() => requestSort('agentName')} className="cursor-pointer">Agent {getSortIndicator('agentName')}</TableHead>
                <TableHead onClick={() => requestSort('product')} className="cursor-pointer">Product {getSortIndicator('product')}</TableHead>
                <TableHead onClick={() => requestSort('overallScore')} className="cursor-pointer text-center">Overall Score {getSortIndicator('overallScore')}</TableHead>
                <TableHead onClick={() => requestSort('callCategorisation')} className="cursor-pointer text-center">Categorization {getSortIndicator('callCategorisation')}</TableHead>
                <TableHead onClick={() => requestSort('transcriptAccuracy')} className="cursor-pointer text-center w-[200px]">Transcript Acc. {getSortIndicator('transcriptAccuracy')}</TableHead>
                <TableHead onClick={() => requestSort('dateScored')} className="cursor-pointer">Date Scored {getSortIndicator('dateScored')}</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No call scoring history found. Score some calls to see them here.
                  </TableCell>
                </TableRow>
              ) : (
                sortedHistory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium max-w-xs truncate" title={item.fileName}>
                      {item.fileName}
                    </TableCell>
                    <TableCell>{item.agentName || 'N/A'}</TableCell>
                    <TableCell>{item.product || 'N/A'}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1" title={`${item.scoreOutput.overallScore.toFixed(1)}/5`}>
                        {renderStars(item.scoreOutput.overallScore, true)}
                      </div>
                      <span className="text-xs text-muted-foreground">({item.scoreOutput.overallScore.toFixed(1)}/5)</span>
                    </TableCell>
                    <TableCell className="text-center">
                       <Badge variant={getCategoryBadgeVariant(item.scoreOutput.callCategorisation)} className="text-xs">
                        {item.scoreOutput.callCategorisation || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-xs" title={item.scoreOutput.transcriptAccuracy}>
                      <div className="flex items-center justify-center gap-1">
                        {getAccuracyIcon(item.scoreOutput.transcriptAccuracy)}
                        <span>{mapAccuracyToPercentageString(item.scoreOutput.transcriptAccuracy || 'N/A')}</span>
                      </div>
                    </TableCell>
                    <TableCell>{format(parseISO(item.timestamp), 'PP p')}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(item)}
                          title={"View Full Scoring Report"}
                      >
                        <Eye className="mr-1.5 h-4 w-4" /> Report
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
          <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl min-h-[70vh] max-h-[85vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-2 border-b">
                <DialogTitle className="text-xl text-primary">Detailed Call Scoring Report (Historical)</DialogTitle>
                <DialogDescription>
                    File: {selectedItem.fileName} (Scored on: {format(parseISO(selectedItem.timestamp), 'PP p')})
                    {selectedItem.agentName && `, Agent: ${selectedItem.agentName}`}
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow overflow-y-auto">
              <div className="p-6">
                <CallScoringResultsCard 
                    results={selectedItem.scoreOutput} 
                    fileName={selectedItem.fileName} 
                    isHistoricalView={true} 
                />
              </div>
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
