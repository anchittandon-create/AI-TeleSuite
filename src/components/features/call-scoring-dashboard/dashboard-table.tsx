
"use client";

import { useState, useMemo, useCallback } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Eye, Star, ArrowUpDown, AlertTriangle, CheckCircle, AlertCircle, ShieldCheck, ShieldAlert, Download, FileText, ChevronDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { CallScoringResultsCard } from '../call-scoring/call-scoring-results-card';
import { useToast } from '@/hooks/use-toast';
import { exportCallScoreReportToPdf } from '@/lib/pdf-utils';
import { exportPlainTextFile } from '@/lib/export';
import type { HistoricalScoreItem } from '@/app/(main)/call-scoring-dashboard/page';
import type { ScoreCallOutput } from '@/ai/flows/call-scoring';

interface CallScoringDashboardTableProps {
  history: HistoricalScoreItem[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

type SortKey = 'overallScore' | 'callCategorisation' | 'transcriptAccuracy' | 'dateScored' | 'fileName' | 'agentName' | 'product';
type SortDirection = 'asc' | 'desc';

const mapAccuracyToPercentageString = (assessment: string): string => {
  if (!assessment) return "N/A";
  const lowerAssessment = assessment.toLowerCase();
  if (lowerAssessment.includes("high")) return "High (est. 95%+)";
  if (lowerAssessment.includes("medium")) return "Medium (est. 80-94%)";
  if (lowerAssessment.includes("low")) return "Low (est. <80%)";
  if (lowerAssessment.includes("error")) return "Error";
  return assessment;
};

const getOverallScoreFromMetrics = (result: ScoreCallOutput): number => {
    if (!result.structureAndFlow) return 0; // Error state
    const allMetrics: {score: number}[] = [
        ...Object.values(result.structureAndFlow),
        ...Object.values(result.communicationAndDelivery),
        ...Object.values(result.discoveryAndNeedMapping),
        ...Object.values(result.salesPitchQuality),
        ...Object.values(result.objectionHandling),
        ...Object.values(result.planExplanationAndClosing),
        ...Object.values(result.endingAndFollowUp),
    ];
    const validScores = allMetrics.map(m => m.score).filter(s => typeof s === 'number' && !isNaN(s));
    if (validScores.length === 0) return 0;
    return validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
};

const getCategoryFromScore = (score: number): string => {
  if (score >= 4.5) return "Excellent";
  if (score >= 3.5) return "Good";
  if (score >= 2.5) return "Average";
  if (score >= 1.5) return "Needs Improvement";
  return "Poor";
};

export function CallScoringDashboardTable({ history, selectedIds, onSelectionChange }: CallScoringDashboardTableProps) {
  const [selectedItem, setSelectedItem] = useState<HistoricalScoreItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const [sortKey, setSortKey] = useState<SortKey>('dateScored');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleViewDetails = (item: HistoricalScoreItem) => {
    setSelectedItem(item);
    setIsDialogOpen(true);
  };
  
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


  const formatReportForTextExport = (item: HistoricalScoreItem): string => {
    const { scoreOutput, fileName, agentName, product, timestamp } = item;
    let output = `--- Call Scoring Report ---\n\n`;
    output += `File Name: ${fileName}\n`;
    output += `Agent Name: ${agentName || "N/A"}\n`;
    output += `Product Focus: ${product || "General"}\n`;
    output += `Date Scored: ${format(parseISO(timestamp), 'PP p')}\n`;
    
    if (scoreOutput.structureAndFlow) {
        const overallScore = getOverallScoreFromMetrics(scoreOutput);
        output += `Average Overall Score: ${overallScore.toFixed(1)}/5\n`;
        output += `Categorization: ${getCategoryFromScore(overallScore)}\n`;
        
        output += `\n--- Final Summary ---\n`;
        output += `Top Strengths:\n- ${scoreOutput.finalSummary.topStrengths.join('\n- ')}\n\n`;
        output += `Top Gaps:\n- ${scoreOutput.finalSummary.topGaps.join('\n- ')}\n\n`;
    }
    
    output += `--- Full Transcript ---\n${scoreOutput.transcript}\n`;
    return output;
  };
  
  const handleDownloadReport = (item: HistoricalScoreItem, format: 'pdf' | 'doc') => {
    const filenameBase = `Call_Report_${item.fileName.replace(/[^a-zA-Z0-9]/g, '_')}`;

    if (format === 'pdf') {
      exportCallScoreReportToPdf(item, `${filenameBase}.pdf`);
      toast({ title: "Report Exported", description: `PDF report for ${item.fileName} has been downloaded.` });
    } else {
      const textContent = formatReportForTextExport(item);
      exportPlainTextFile(`${filenameBase}.doc`, textContent);
      toast({ title: "Report Exported", description: `Text report for ${item.fileName} has been downloaded.` });
    }
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

  const getCategoryBadgeVariant = (category?: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (category?.toLowerCase()) {
      case 'excellent': return 'default';
      case 'good': return 'secondary';
      case 'average': return 'outline';
      case 'needs improvement': return 'destructive';
      case 'poor': return 'destructive';
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

  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => {
        let valA: any, valB: any;

        switch (sortKey) {
          case 'overallScore':
            valA = getOverallScoreFromMetrics(a.scoreOutput);
            valB = getOverallScoreFromMetrics(b.scoreOutput);
            break;
          case 'callCategorisation':
            valA = getCategoryFromScore(getOverallScoreFromMetrics(a.scoreOutput));
            valB = getCategoryFromScore(getOverallScoreFromMetrics(b.scoreOutput));
            break;
          case 'transcriptAccuracy':
            valA = a.scoreOutput.transcriptAccuracy;
            valB = b.scoreOutput.transcriptAccuracy;
            break;
          case 'dateScored':
            valA = new Date(a.timestamp).getTime();
            valB = new Date(b.timestamp).getTime();
            break;
          default:
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
                <TableHead onClick={() => requestSort('agentName')} className="cursor-pointer">Agent {getSortIndicator('agentName')}</TableHead>
                <TableHead onClick={() => requestSort('product')} className="cursor-pointer">Product {getSortIndicator('product')}</TableHead>
                <TableHead onClick={() => requestSort('overallScore')} className="cursor-pointer text-center">Avg. Score {getSortIndicator('overallScore')}</TableHead>
                <TableHead onClick={() => requestSort('callCategorisation')} className="cursor-pointer text-center">Categorization {getSortIndicator('callCategorisation')}</TableHead>
                <TableHead onClick={() => requestSort('transcriptAccuracy')} className="cursor-pointer text-center w-[200px]">Transcript Acc. {getSortIndicator('transcriptAccuracy')}</TableHead>
                <TableHead onClick={() => requestSort('dateScored')} className="cursor-pointer">Date Scored {getSortIndicator('dateScored')}</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    No call scoring history found.
                  </TableCell>
                </TableRow>
              ) : (
                sortedHistory.map((item) => {
                  const overallScore = getOverallScoreFromMetrics(item.scoreOutput);
                  const category = getCategoryFromScore(overallScore);

                  return (
                    <TableRow key={item.id} data-state={selectedIds.includes(item.id) ? "selected" : undefined}>
                      <TableCell>
                          <Checkbox
                              checked={selectedIds.includes(item.id)}
                              onCheckedChange={(checked) => handleSelectOne(item.id, !!checked)}
                              aria-label={`Select row for ${item.fileName}`}
                          />
                      </TableCell>
                      <TableCell className="font-medium max-w-xs truncate" title={item.fileName}>
                        {item.fileName}
                      </TableCell>
                      <TableCell>{item.agentName || 'N/A'}</TableCell>
                      <TableCell>{item.product || 'N/A'}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1" title={overallScore > 0 ? `${overallScore.toFixed(1)}/5` : 'N/A'}>
                          {renderStars(overallScore, true)}
                        </div>
                        <span className="text-xs text-muted-foreground">{overallScore > 0 ? `(${overallScore.toFixed(1)}/5)`: `(N/A)`}</span>
                      </TableCell>
                      <TableCell className="text-center">
                         <Badge variant={getCategoryBadgeVariant(category)} className="text-xs">
                          {category || "N/A"}
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
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                               <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="h-9 w-9"
                                  disabled={!item.scoreOutput.structureAndFlow}
                                  title={!item.scoreOutput.structureAndFlow ? "Cannot download, error in generation" : "Download report options"}
                                >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleDownloadReport(item, 'pdf')}>
                                <FileText className="mr-2 h-4 w-4"/> Download as PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownloadReport(item, 'doc')}>
                                <Download className="mr-2 h-4 w-4"/> Download as Text for Word
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
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
