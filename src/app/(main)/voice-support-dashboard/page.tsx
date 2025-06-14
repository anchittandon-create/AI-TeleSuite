
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useActivityLogger, MAX_ACTIVITIES_TO_STORE } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as DialogDesc, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from '@/components/ui/skeleton';
import { exportToCsv, exportTableDataToPdf, exportTableDataForDoc, exportPlainTextFile } from '@/lib/export';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Eye, List, FileSpreadsheet, FileText, Users, AlertCircleIcon, Info, Copy, Download } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ActivityLogEntry, VoiceSupportAgentActivityDetails, Product } from '@/types';

interface HistoricalSupportInteractionItem extends Omit<ActivityLogEntry, 'details'> {
  details: VoiceSupportAgentActivityDetails;
}

export default function VoiceSupportDashboardPage() {
  const { activities } = useActivityLogger();
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  const [selectedInteraction, setSelectedInteraction] = useState<HistoricalSupportInteractionItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const supportInteractionHistory: HistoricalSupportInteractionItem[] = useMemo(() => {
    if (!isClient) return [];
    return (activities || [])
      .filter(activity =>
        activity.module === "Voice Support Agent" &&
        activity.details &&
        typeof activity.details === 'object' &&
        'flowInput' in activity.details &&
        ('flowOutput' in activity.details || 'error' in activity.details)
      )
      .map(activity => activity as HistoricalSupportInteractionItem)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activities, isClient]);

  const handleViewDetails = (item: HistoricalSupportInteractionItem) => {
    setSelectedInteraction(item);
    setIsDialogOpen(true);
  };
  
  const handleCopyToClipboard = (text: string, type: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => toast({ title: "Success", description: `${type} copied to clipboard!` }))
      .catch(() => toast({ variant: "destructive", title: "Error", description: `Failed to copy ${type.toLowerCase()}.` }));
  };

  const handleDownloadFile = (content: string, fileNameBase: string, type: "transcript" | "summary") => {
    if (!content) return;
    try {
      const fileExtension = type === "transcript" ? "_interaction_log.txt" : "_summary.txt";
      const fullFileName = `${fileNameBase.replace(/[^a-zA-Z0-9]/g, '_')}${fileExtension}`;
      exportPlainTextFile(fullFileName, content);
      toast({ title: "Download Successful", description: `${type} file '${fullFileName}' downloaded.` });
    } catch (error) {
       toast({ variant: "destructive", title: "Download Error", description: `Failed to download ${type} file.` });
    }
  };

  const handleExportTable = (formatType: 'csv' | 'pdf' | 'doc') => {
    if (supportInteractionHistory.length === 0) {
      toast({ title: "No Data", description: "No support interaction history to export." });
      return;
    }
    try {
      const headers = ["Timestamp", "App Agent", "AI Agent Name", "Customer Name", "Product", "User Query (Start)", "Escalation Suggested", "Error"];
      const dataForExportObjects = supportInteractionHistory.map(item => ({
        Timestamp: format(parseISO(item.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        AppAgent: item.agentName || 'N/A',
        AIAgentName: item.details.flowInput.agentName || 'N/A',
        CustomerName: item.details.flowInput.userName || 'N/A',
        Product: item.details.flowInput.product,
        UserQueryStart: item.details.flowInput.userQuery.substring(0, 50) + (item.details.flowInput.userQuery.length > 50 ? '...' : ''),
        EscalationSuggested: item.details.flowOutput?.escalationSuggested ? 'Yes' : 'No',
        Error: item.details.error || '',
      }));

      const dataRowsForPdfOrDoc = dataForExportObjects.map(row => Object.values(row));
      const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
      const baseFilename = `voice_support_interaction_history_${timestamp}`;

      if (formatType === 'csv') exportToCsv(`${baseFilename}.csv`, dataForExportObjects);
      else if (formatType === 'pdf') exportTableDataToPdf(`${baseFilename}.pdf`, headers, dataRowsForPdfOrDoc);
      else if (formatType === 'doc') exportTableDataForDoc(`${baseFilename}.doc`, headers, dataRowsForPdfOrDoc);
      
      toast({ title: "Export Successful", description: `Support interaction history exported as ${formatType.toUpperCase()}.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Export Failed", description: `Could not export history. Error: ${error instanceof Error ? error.message : String(error)}`});
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Voice Support Agent - Interaction Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-700">
            <Info className="h-4 w-4" />
            <AlertTitle className="text-blue-800">Dashboard Overview</AlertTitle>
            <AlertDescription className="text-xs">
              This dashboard displays logs of simulated support interactions via the "AI Voice Support Agent" module.
              Each entry includes the conversation log (text-based simulation) and input parameters.
              Actual audio recordings are not stored in this prototype.
            </AlertDescription>
        </Alert>

        <div className="flex justify-end">
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><List className="mr-2 h-4 w-4" /> Export Options</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExportTable('csv')}><FileSpreadsheet className="mr-2 h-4 w-4" /> Export Table as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportTable('pdf')}><FileText className="mr-2 h-4 w-4" /> Export Table as PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportTable('doc')}><FileText className="mr-2 h-4 w-4" /> Export Table as Text for Word</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isClient ? (
          <Card className="shadow-md">
            <CardHeader>
                <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary"/>Simulated Support Interaction Logs</CardTitle>
                <CardDescription>History of AI-driven support interactions. Click "View" for details.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[calc(100vh-460px)] md:h-[calc(100vh-400px)]">
                    <Table>
                        <TableHeader className="sticky top-0 bg-muted/50">
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Initial Query (Preview)</TableHead>
                            <TableHead className="text-center">Escalation</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {supportInteractionHistory.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No support interactions logged yet.</TableCell></TableRow>
                        ) : (
                            supportInteractionHistory.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="text-xs">{format(parseISO(item.timestamp), 'PP p')}</TableCell>
                                <TableCell className="text-xs max-w-[150px] truncate" title={item.details.flowInput.userName || "Unknown User"}>
                                  {item.details.flowInput.userName || "Unknown User"}
                                </TableCell>
                                <TableCell className="text-xs">{item.details.flowInput.product}</TableCell>
                                <TableCell className="text-xs max-w-[200px] truncate" title={item.details.flowInput.userQuery}>
                                    {item.details.flowInput.userQuery.substring(0,50)}{item.details.flowInput.userQuery.length > 50 ? "..." : ""}
                                </TableCell>
                                <TableCell className="text-center text-xs">
                                    {item.details.flowOutput?.escalationSuggested ? <Badge variant="outline" className="border-amber-500 text-amber-700">Yes</Badge> : <Badge variant="secondary">No</Badge>}
                                </TableCell>
                                <TableCell className="text-center">
                                {item.details.error ? <Badge variant="destructive" className="text-xs">Error</Badge> : <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">Completed</Badge>}
                                </TableCell>
                                <TableCell className="text-right">
                                <Button variant="outline" size="xs" onClick={() => handleViewDetails(item)}><Eye className="mr-1.5 h-3.5 w-3.5" /> View</Button>
                                </TableCell>
                            </TableRow>
                            ))
                        )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" /> <Skeleton className="h-20 w-full" /> <Skeleton className="h-20 w-full" /> <Skeleton className="h-20 w-full" />
          </div>
        )}
         <div className="text-xs text-muted-foreground p-4 border-t">
          Activity log is limited to the most recent {MAX_ACTIVITIES_TO_STORE} entries. Detailed interaction logs are available in the "View" dialog.
        </div>

        {selectedInteraction && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-4 pb-3 border-b sticky top-0 bg-background z-10">
                <DialogTitle className="text-lg text-primary">Support Interaction Details</DialogTitle>
                <DialogDesc className="text-xs">
                    Customer: {selectedInteraction.details.flowInput.userName || "N/A"} | Product: {selectedInteraction.details.flowInput.product} | Date: {format(parseISO(selectedInteraction.timestamp), 'PPPP pppp')}
                </DialogDesc>
                </DialogHeader>
                <ScrollArea className="flex-grow p-4 overflow-y-auto">
                    {selectedInteraction.details.error && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertCircleIcon className="h-4 w-4" />
                            <AlertTitle>Error during interaction</AlertTitle>
                            <AlertDescription>{selectedInteraction.details.error}</AlertDescription>
                        </Alert>
                    )}
                    {selectedInteraction.details.flowInput && (
                        <Card className="mb-4 bg-muted/30">
                            <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm">Context Parameters</CardTitle></CardHeader>
                            <CardContent className="text-xs px-4 pb-3 space-y-1">
                                <p><strong>AI Agent:</strong> {selectedInteraction.details.flowInput.agentName || "Default AI"}</p>
                                <p><strong>Customer:</strong> {selectedInteraction.details.flowInput.userName || "N/A"} ({selectedInteraction.details.flowInput.countryCode || ""}{selectedInteraction.details.flowInput.userMobileNumber || "N/A"})</p>
                                <p><strong>Product:</strong> {selectedInteraction.details.flowInput.product}</p>
                                {selectedInteraction.details.flowInput.voiceProfileId && <p><strong>Simulated Voice Profile ID:</strong> {selectedInteraction.details.flowInput.voiceProfileId}</p>}
                                <p><strong>Initial Query:</strong> {selectedInteraction.details.flowInput.userQuery}</p>
                            </CardContent>
                        </Card>
                    )}
                    {selectedInteraction.details.fullTranscriptText && (
                        <Card className="mb-4">
                            <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm">Conversation Log (Simulated)</CardTitle></CardHeader>
                            <CardContent className="px-4 pb-3">
                                <Textarea value={selectedInteraction.details.fullTranscriptText} readOnly className="h-60 text-xs bg-background/50 whitespace-pre-wrap" />
                                 <div className="mt-2 flex gap-2">
                                     <Button variant="outline" size="xs" onClick={() => handleCopyToClipboard(selectedInteraction.details.fullTranscriptText!, 'Transcript')}><Copy className="mr-1 h-3"/>Copy Log</Button>
                                     <Button variant="outline" size="xs" onClick={() => handleDownloadFile(selectedInteraction.details.fullTranscriptText!, `SupportLog_${selectedInteraction.details.flowInput.userName || 'User'}`, "transcript")}><Download className="mr-1 h-3"/>Download Log</Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                     {selectedInteraction.details.flowOutput && (
                        <Card className="bg-green-50 border-green-200">
                            <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm text-green-800">Final AI Response Summary</CardTitle></CardHeader>
                            <CardContent className="text-xs px-4 pb-3 space-y-1 text-green-700">
                                <p><strong>Response Text:</strong> {selectedInteraction.details.flowOutput.aiResponseText}</p>
                                {selectedInteraction.details.flowOutput.sourcesUsed && <p><strong>Sources Used:</strong> {selectedInteraction.details.flowOutput.sourcesUsed.join(', ')}</p>}
                                {selectedInteraction.details.flowOutput.escalationSuggested && <p><strong>Escalation Suggested:</strong> Yes</p>}
                            </CardContent>
                        </Card>
                     )}
                </ScrollArea>
                <DialogFooter className="p-3 border-t bg-muted/50 sticky bottom-0">
                    <Button onClick={() => setIsDialogOpen(false)} size="sm">Close</Button>
                </DialogFooter>
            </DialogContent>
            </Dialog>
        )}
      </main>
    </div>
  );
}
