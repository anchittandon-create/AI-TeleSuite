
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
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KnowledgeFile } from "@/types";
import { format, parseISO } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { FileText, FileAudio, FileSpreadsheet, PenSquare, Trash2, ArrowUpDown, Eye, Download, InfoIcon, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription as UiCardDescription } from "@/components/ui/card"; 
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { downloadDataUriFile } from '@/lib/export';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface KnowledgeBaseTableProps {
  files: KnowledgeFile[];
  onDeleteFile: (fileId: string) => void;
}

type SortKey = keyof KnowledgeFile | null;
type SortDirection = 'asc' | 'desc';

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getFileIcon(file: KnowledgeFile) { 
    if (file.isTextEntry) return <PenSquare className="h-5 w-5 text-purple-500" />;
    if (file.type.startsWith('audio/')) return <FileAudio className="h-5 w-5 text-primary" />;
    if (file.type.startsWith('image/')) return <ImageIcon className="h-5 w-5 text-teal-500" />;
    if (file.type === 'application/pdf') return <FileText className="h-5 w-5 text-red-500" />;
    if (file.type === 'text/csv' || file.type.includes('spreadsheet')) return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    if (file.type.includes('wordprocessingml') || file.type.includes('msword')) return <FileText className="h-5 w-5 text-blue-500" />;
    if (file.type === 'text/plain') return <FileText className="h-5 w-5 text-gray-500" />;
    return <FileText className="h-5 w-5 text-muted-foreground" />; 
}

export function KnowledgeBaseTable({ files, onDeleteFile }: KnowledgeBaseTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('uploadDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [fileToDelete, setFileToDelete] = useState<KnowledgeFile | null>(null);
  const [fileToView, setFileToView] = useState<KnowledgeFile | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const { toast } = useToast();

  const sortedFiles = [...files].sort((a, b) => {
    if (!sortKey) return 0;
    const valA = a[sortKey];
    const valB = b[sortKey];

    let comparison = 0;
    if (valA === undefined || valA === null) comparison = -1;
    else if (valB === undefined || valB === null) comparison = 1;
    else if (sortKey === 'uploadDate') { 
        comparison = new Date(valA as string).getTime() - new Date(valB as string).getTime();
    } else if (sortKey === 'size' && typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
    } else if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB);
    } else if (sortKey === 'isTextEntry' && typeof valA === 'boolean' && typeof valB === 'boolean') {
        comparison = (valA === valB) ? 0 : (valA ? -1 : 1); 
    }
    
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
    return <ArrowUpDown className="ml-2 h-4 w-4 inline transform group-hover:text-foreground transition-colors" />;
  };

  const handleDeleteIntent = (file: KnowledgeFile) => {
    setFileToDelete(file);
    setIsAlertOpen(true);
  };

  const handleViewIntent = (file: KnowledgeFile) => {
    setFileToView(file);
    setIsViewDialogOpen(true);
  };
  
  const handleDownloadFile = (file: KnowledgeFile) => {
    if (!file.dataUri) {
        toast({
            variant: "destructive",
            title: "Download Unavailable",
            description: "The original content for this file was not stored. Please re-upload it to enable downloads.",
        });
        return;
    }
    try {
        const downloadName = file.isTextEntry ? `${file.name}.txt` : file.name;
        downloadDataUriFile(file.dataUri, downloadName);
        toast({ title: "Download Started", description: `Downloading ${downloadName}...` });
    } catch (error) {
        console.error("Error downloading file:", error);
        toast({ variant: "destructive", title: "Download Error", description: "Could not download the file." });
    }
  };


  const confirmDeleteAction = () => {
    if (fileToDelete) {
      onDeleteFile(fileToDelete.id);
    }
    handleAlertOpenChange(false);
  };

  const handleAlertOpenChange = (open: boolean) => {
    setIsAlertOpen(open);
    if (!open) {
      setFileToDelete(null); 
    }
  };
  
  const handleViewDialogChange = (open: boolean) => {
    setIsViewDialogOpen(open);
    if (!open) {
      setFileToView(null);
    }
  }

  const renderFilePreview = (file: KnowledgeFile) => {
    if (file.isTextEntry || file.type.startsWith('text/')) {
        return (
            <div>
                <Label htmlFor="kb-view-text-content" className="font-semibold">Content Preview:</Label>
                <Textarea
                    id="kb-view-text-content"
                    value={file.textContent || "No text content was stored for this file."}
                    readOnly
                    className="min-h-[250px] max-h-[40vh] bg-background mt-1 whitespace-pre-wrap text-sm"
                />
            </div>
        );
    }

    if (file.dataUri) {
        if (file.type.startsWith('image/')) {
            return <img src={file.dataUri} alt={file.name} className="max-w-full max-h-[60vh] object-contain mx-auto rounded-md border" />;
        }
        if (file.type === 'application/pdf') {
            return <embed src={file.dataUri} type="application/pdf" className="w-full h-[60vh] border rounded-md" />;
        }
    }

    return (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800 text-center">
            <p className="font-semibold flex items-center justify-center"><InfoIcon className="mr-2 h-4 w-4"/>No Direct Preview Available</p>
            <p className="mt-1">A direct preview for this file type ({file.type}) is not supported.</p>
            <p>Please use the download button to view the file on your computer.</p>
        </div>
    );
  }

  return (
    <>
      <Card className="w-full max-w-4xl mt-8 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Knowledge Base Entries</CardTitle>
          <UiCardDescription>All uploaded documents and text entries available for AI assistance.</UiCardDescription>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No entries in the knowledge base yet.</p>
          ) : (
            <ScrollArea className="h-[calc(100vh-400px)] md:h-[500px]">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm">
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead onClick={() => requestSort('name')} className="cursor-pointer group">
                      Name / Content {getSortIndicator('name')}
                    </TableHead>
                    <TableHead onClick={() => requestSort('product')} className="cursor-pointer group">
                      Product {getSortIndicator('product')}
                    </TableHead>
                    <TableHead onClick={() => requestSort('uploadDate')} className="cursor-pointer group">
                      Uploaded {getSortIndicator('uploadDate')}
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedFiles.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell>{getFileIcon(file)}</TableCell>
                      <TableCell className="font-medium max-w-[300px] truncate" title={file.isTextEntry && file.textContent ? file.textContent : file.name}>
                        {file.isTextEntry ? `(Text) ${file.name}` : file.name}
                        {file.isTextEntry && file.textContent && <p className="text-xs text-muted-foreground truncate italic">"{file.textContent.substring(0,50)}..."</p>}
                      </TableCell>
                      <TableCell>
                        {file.product ? <Badge variant="secondary">{file.product}</Badge> : <span className="text-muted-foreground text-xs">N/A</span>}
                      </TableCell>
                      <TableCell>{format(parseISO(file.uploadDate), 'MMM d, yyyy HH:mm')}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <TooltipProvider>
                            <Button variant="ghost" size="icon" onClick={() => handleViewIntent(file)} className="text-primary hover:text-primary/80 h-8 w-8" title="View Details & Preview">
                                <Eye className="h-4 w-4" />
                            </Button>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span tabIndex={0}> {/* Wrapper for disabled button */}
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleDownloadFile(file)}
                                          disabled={!file.dataUri}
                                          className="h-8 w-8 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          <Download className="h-4 w-4" />
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                {!file.dataUri && (
                                     <TooltipContent>
                                        <p>Original file content not stored. Please re-upload to enable download.</p>
                                    </TooltipContent>
                                )}
                            </Tooltip>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteIntent(file)} className="text-destructive hover:text-destructive/80 h-8 w-8" title="Delete Entry">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {fileToDelete && (
          <AlertDialog open={isAlertOpen} onOpenChange={handleAlertOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the entry
                    <span className="font-semibold"> "{fileToDelete.name}" </span> 
                    from the knowledge base.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel onClick={() => handleAlertOpenChange(false)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeleteAction} className="bg-destructive hover:bg-destructive/90">
                    Delete
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
      )}

      {fileToView && (
        <Dialog open={isViewDialogOpen} onOpenChange={handleViewDialogChange}>
            <DialogContent className="sm:max-w-lg md:max-w-2xl lg:max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-primary truncate" title={fileToView.name}>View: {fileToView.name}</DialogTitle>
                    <DialogDescription>
                        Type: {fileToView.type || 'N/A'} | Size: {formatBytes(fileToView.size)} | Product: {fileToView.product || 'N/A'}
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-grow p-1 pr-3 -mx-1">
                    <div className="space-y-3 p-4 rounded-md">
                      {renderFilePreview(fileToView)}
                    </div>
                </ScrollArea>
                <DialogFooter className="pt-4 border-t">
                    <Button variant="outline" onClick={() => handleViewDialogChange(false)}>Close</Button>
                    <Button onClick={() => handleDownloadFile(fileToView)} disabled={!fileToView.dataUri}>
                       <Download className="mr-2 h-4 w-4" /> Download Original File
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </>
  );
}
