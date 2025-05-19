
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
import { Badge } from "@/components/ui/badge";
import { Eye, Star, AlertTriangle, CheckCircle, PlayCircle } from 'lucide-react';
import type { ScoreCallOutput } from "@/ai/flows/call-scoring";
import { CallScoringResultsCard } from './call-scoring-results-card'; // For detailed view
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export interface ScoredCallResultItem extends ScoreCallOutput {
  id: string;
  fileName: string;
  audioDataUri?: string; // Added for audio playback
  error?: string; 
}

interface CallScoringResultsTableProps {
  results: ScoredCallResultItem[];
}

export function CallScoringResultsTable({ results }: CallScoringResultsTableProps) {
  const [selectedResult, setSelectedResult] = useState<ScoredCallResultItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleViewDetails = (result: ScoredCallResultItem) => {
    setSelectedResult(result);
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

  const getCategoryBadgeVariant = (category: string | undefined): "default" | "secondary" | "destructive" | "outline" => {
    switch (category?.toLowerCase()) {
      case 'excellent': return 'default'; 
      case 'good': return 'secondary'; 
      case 'fair': return 'outline'; 
      case 'needs improvement': case 'poor': case 'error': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <>
      <div className="w-full max-w-5xl mt-8 shadow-lg rounded-lg border bg-card">
        <div className="p-6">
            <h2 className="text-xl font-semibold text-primary">Call Scoring Summary</h2>
            <p className="text-sm text-muted-foreground">Scoring results for {results.length} call(s).</p>
        </div>
        <ScrollArea className="h-[calc(100vh-450px)] md:h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm">
              <TableRow>
                <TableHead className="w-[50px]">SNo.</TableHead>
                <TableHead>File Name</TableHead>
                <TableHead className="text-center w-[180px]">Overall Score</TableHead>
                <TableHead className="text-center w-[180px]">Categorization</TableHead>
                <TableHead className="text-center w-[100px]">Status</TableHead>
                <TableHead className="text-right w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No call scoring results to display.
                  </TableCell>
                </TableRow>
              ) : (
                results.map((result, index) => (
                  <TableRow key={result.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium max-w-xs truncate" title={result.fileName}>
                      {result.fileName}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1" title={`${result.overallScore.toFixed(1)}/5`}>
                        {renderStars(result.overallScore, true)}
                      </div>
                      <span className="text-xs text-muted-foreground">({result.overallScore.toFixed(1)}/5)</span>
                    </TableCell>
                    <TableCell className="text-center">
                       <Badge variant={getCategoryBadgeVariant(result.callCategorisation)} className="text-xs">
                        {result.callCategorisation}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {result.error ? (
                          <Badge variant="destructive" className="cursor-default text-xs" title={result.error}>
                              <AlertTriangle className="mr-1 h-3 w-3" /> Error
                          </Badge>
                      ) : (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300 text-xs">
                            <CheckCircle className="mr-1 h-3 w-3" /> Scored
                          </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleViewDetails(result)}
                          title={"View Full Scoring Report / Play Audio"}
                      >
                        <Eye className="mr-1.5 h-4 w-4" /> Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {selectedResult && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl min-h-[70vh] max-h-[85vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-2 border-b">
                <DialogTitle className="text-xl text-primary">Detailed Call Scoring Report</DialogTitle>
                <DialogDescription>
                    File: {selectedResult.fileName}
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow overflow-y-auto">
              <div className="p-6">
                {selectedResult.error ? (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Scoring Error for: {selectedResult.fileName}</AlertTitle>
                        <AlertDescription>{selectedResult.error}</AlertDescription>
                        {selectedResult.audioDataUri && (
                          <div className="mt-3">
                            <h4 className="text-sm font-medium mb-1 flex items-center"><PlayCircle className="mr-1 h-4 w-4"/>Original Audio</h4>
                             <audio controls src={selectedResult.audioDataUri} className="w-full h-10">
                                Your browser does not support the audio element.
                             </audio>
                          </div>
                        )}
                    </Alert>
                ): (
                    <CallScoringResultsCard 
                        results={selectedResult} 
                        fileName={selectedResult.fileName} 
                        audioDataUri={selectedResult.audioDataUri} 
                    />
                )}
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

