
"use client";

import { useState, useEffect, useRef } from 'react';
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
import { FileText, FileAudio, FileSpreadsheet, PenSquare, Trash2, ArrowUpDown, Eye, Download, InfoIcon, Image as ImageIcon, FileArchive, FileX2, Loader2, FileVideo } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription as UiCardDescription } from "@/components/ui/card"; 
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { downloadDataUriFile } from '@/lib/export';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import * as docx from 'docx-preview';
import * as XLSX from 'xlsx';
import { Skeleton } from '@/components/ui/skeleton';

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
    const type = file.type.toLowerCase();
    if (type.startsWith('audio/')) return <FileAudio className="h-5 w-5 text-primary" />;
    if (type.startsWith('image/')) return <ImageIcon className="h-5 w-5 text-teal-500" />;
    if (type.startsWith('video/')) return <FileVideo className="h-5 w-5 text-indigo-500" />;
    if (type.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    if (type.includes('spreadsheet') || type.includes('excel') || file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    if (type.includes('presentation') || file.name.endsWith('.pptx')) return <FileText className="h-5 w-5 text-orange-500" />;
    if (type.includes('wordprocessingml') || type.includes('msword') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) return <FileText className="h-5 w-5 text-blue-500" />;
    if (type.includes('zip') || type.includes('archive')) return <FileArchive className="h-5 w-5 text-orange-500" />;
    if (type.startsWith('text/')) return <FileText className="h-5 w-5 text-gray-500" />;
    return <FileX2 className="h-5 w-5 text-muted-foreground" />; 
}

// This function is now more robust.
const dataURLtoBlob = (dataurl: string): Blob | null => {
    if (typeof dataurl !== 'string' || !dataurl.includes(',')) {
        console.error("Invalid Data URL provided to dataURLtoBlob");
        return null;
    }
    try {
        const arr = dataurl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch) return null;
        
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        
        return new Blob([u8arr], {type:mime});
    } catch (e) {
        console.error("Error converting data URI to Blob:", e);
        return null;
    }
}

export function KnowledgeBaseTable({ files, onDeleteFile }: KnowledgeBaseTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('uploadDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [fileToDelete, setFileToDelete] = useState<KnowledgeFile | null>(null);
  const [fileToView, setFileToView] = useState<KnowledgeFile | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const { toast } = useToast();
  const previewRef = useRef<HTMLDivElement>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    const renderFilePreview = async () => {
        if (isViewDialogOpen && fileToView && fileToView.dataUri && previewRef.current) {
            setIsLoadingPreview(true);
            const targetEl = previewRef.current;
            targetEl.innerHTML = ""; // Clear previous content
            
            const type = fileToView.type.toLowerCase();
            const name = fileToView.name.toLowerCase();

            try {
                 if (type.includes('wordprocessingml') || name.endsWith('.docx') || type.includes('presentation') || name.endsWith('.pptx')) {
                    const fileBlob = dataURLtoBlob(fileToView.dataUri);
                    if (fileBlob) {
                      await docx.renderAsync(fileBlob, targetEl);
                    } else {
                      throw new Error("Could not convert data URI to blob for document preview.");
                    }
                } else if (type.includes('spreadsheet') || name.endsWith('.xls') || name.endsWith('.xlsx')) {
                    const fileBlob = dataURLtoBlob(fileToView.dataUri);
                    if (fileBlob) {
                        const data = await fileBlob.arrayBuffer();
                        const workbook = XLSX.read(data);
                        const sheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[sheetName];
                        const html = XLSX.utils.sheet_to_html(worksheet);
                        targetEl.innerHTML = html;
                    } else {
                         throw new Error("Could not convert data URI to blob for spreadsheet preview.");
                    }
                } else {
                    targetEl.innerHTML = "";
                }
            } catch (error) {
                console.error("Error rendering file preview:", error);
                targetEl.innerHTML = `<div class="text-destructive text-center p-4">Error rendering file preview: ${(error as Error).message}</div>`;
            } finally {
                setIsLoadingPreview(false);
            }
        }
    };
    renderFilePreview();
  }, [isViewDialogOpen, fileToView]);


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
    if (sortKey === key && sortDirection === 'asc') direction = 'desc';
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
    if (fileToDelete) onDeleteFile(fileToDelete.id);
    handleAlertOpenChange(false);
  };

  const handleAlertOpenChange = (open: boolean) => {
    setIsAlertOpen(open);
    if (!open) setFileToDelete(null); 
  };
  
  const handleViewDialogChange = (open: boolean) => {
    setIsViewDialogOpen(open);
    if (!open) setFileToView(null);
  }

  const renderFilePreview = (file: KnowledgeFile) => {
    if (!file.dataUri) return <div className="text-center p-4 text-muted-foreground">Preview not available because file content was not stored. Please re-upload.</div>;
    const type = file.type.toLowerCase();
    
    if (file.isTextEntry || type.startsWith('text/')) {
        return (
            <Textarea value={file.textContent || "No text content was stored."} readOnly className="min-h-[250px] max-h-[60vh] bg-background mt-1 whitespace-pre-wrap text-sm" />
        );
    }
    if (type.startsWith('image/')) {
        return <img src={file.dataUri} alt={file.name} className="max-w-full max-h-[60vh] object-contain mx-auto rounded-md border" />;
    }
    if (type.startsWith('video/')) {
        return <video src={file.dataUri} controls className="max-w-full max-h-[60vh] mx-auto rounded-md border" />;
    }
    if (type.startsWith('audio/')) {
        return <audio src={file.dataUri} controls className="w-full" />;
    }
    if (type.includes('pdf')) {
        return <embed src={file.dataUri} type="application/pdf" className="w-full h-[60vh] border rounded-md" />;
    }
    // DOCX, PPTX, and XLSX will be rendered into the previewRef div by useEffect
    if (type.includes('wordprocessingml') || file.name.endsWith('.docx') || type.includes('presentation') || file.name.endsWith('.pptx') || type.includes('spreadsheet') || file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
        return (
            <div ref={previewRef} className="prose w-full max-w-full p-2 border rounded-md bg-white min-h-[250px] max-h-[60vh] overflow-y-auto">
               {/* Content will be injected here by useEffect */}
            </div>
        );
    }

    return (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800 text-center">
            <p className="font-semibold flex items-center justify-center"><InfoIcon className="mr-2 h-4 w-4"/>No Direct Preview Available</p>
            <p className="mt-1">A direct preview for this file type ({file.type}) is not supported.</p>
        </div>
    );
  }

  if (!isClient) {
    return (
      <Card className="w-full max-w-4xl mt-8 shadow-lg">
        <CardHeader><Skeleton className="h-8 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-64 w-full" /></CardContent>
      </Card>
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
          <ScrollArea className="h-[calc(100vh-400px)] md:h-[500px]">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm z-10">
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
                {sortedFiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No entries in the knowledge base yet.</TableCell>
                  </TableRow>
                ) : (
                  sortedFiles.map((file) => (
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
                            <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => handleViewIntent(file)} className="text-primary hover:text-primary/80 h-8 w-8">
                                      <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>View Details & Preview</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span tabIndex={0}>
                                        <Button variant="ghost" size="icon" onClick={() => handleDownloadFile(file)} disabled={!file.dataUri} className="h-8 w-8 disabled:opacity-50 disabled:cursor-not-allowed">
                                          <Download className="h-4 w-4" />
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent><p>{file.dataUri ? "Download Original" : "Re-upload to enable download"}</p></TooltipContent>
                            </Tooltip>
                             <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => handleDeleteIntent(file)} className="text-destructive hover:text-destructive/80 h-8 w-8">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Delete Entry</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
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
                <div className="flex-grow p-1 pr-3 -mx-1 overflow-y-auto">
                    <div className="space-y-3 p-4 rounded-md">
                      {isLoadingPreview ? (
                        <div className="flex items-center justify-center min-h-[250px]">
                           <Loader2 className="h-8 w-8 animate-spin text-primary" />
                           <p className="ml-3 text-muted-foreground">Rendering preview...</p>
                        </div>
                      ) : renderFilePreview(fileToView)}
                    </div>
                </div>
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
