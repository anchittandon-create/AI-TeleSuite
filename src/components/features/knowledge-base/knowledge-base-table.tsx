
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
import { FileText, FileAudio, FileSpreadsheet, PenSquare, Trash2, ArrowUpDown, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription as UiCardDescription } from "@/components/ui/card"; 
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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
    return sortDirection === 'asc' ? <ArrowUpDown className="ml-2 h-4 w-4 inline transform rotate-180" /> : <ArrowUpDown className="ml-2 h-4 w-4 inline" />;
  };

  const handleDeleteIntent = (file: KnowledgeFile) => {
    setFileToDelete(file);
    setIsAlertOpen(true);
  };

  const handleViewIntent = (file: KnowledgeFile) => {
    setFileToView(file);
    setIsViewDialogOpen(true);
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
                    <TableHead onClick={() => requestSort('name')} className="cursor-pointer">
                      Name / Content {getSortIndicator('name')}
                    </TableHead>
                    <TableHead onClick={() => requestSort('product')} className="cursor-pointer">
                      Product {getSortIndicator('product')}
                    </TableHead>
                    <TableHead onClick={() => requestSort('category')} className="cursor-pointer">
                      Category {getSortIndicator('category')}
                    </TableHead>
                    <TableHead onClick={() => requestSort('persona')} className="cursor-pointer">
                      Persona {getSortIndicator('persona')}
                    </TableHead>
                    <TableHead onClick={() => requestSort('size')} className="cursor-pointer">
                      Size/Length {getSortIndicator('size')}
                    </TableHead>
                    <TableHead onClick={() => requestSort('uploadDate')} className="cursor-pointer">
                      Uploaded {getSortIndicator('uploadDate')}
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedFiles.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell>{getFileIcon(file)}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate" title={file.isTextEntry && file.textContent ? file.textContent : file.name}>
                        {file.isTextEntry ? `(Text) ${file.name}` : file.name}
                        {file.isTextEntry && file.textContent && <p className="text-xs text-muted-foreground truncate italic">"{file.textContent.substring(0,50)}..."</p>}
                      </TableCell>
                      <TableCell>
                        {file.product ? <Badge variant="secondary">{file.product}</Badge> : <span className="text-muted-foreground text-xs">N/A</span>}
                      </TableCell>
                      <TableCell>
                        {file.category ? <Badge variant="outline">{file.category}</Badge> : <span className="text-muted-foreground text-xs">N/A</span>}
                      </TableCell>
                      <TableCell>
                        {file.persona ? <Badge variant="outline" className="max-w-[150px] truncate">{file.persona}</Badge> : <span className="text-muted-foreground text-xs">N/A</span>}
                      </TableCell>
                      <TableCell>{file.isTextEntry ? `${file.size} chars` : formatBytes(file.size)}</TableCell>
                      <TableCell>{format(parseISO(file.uploadDate), 'MMM d, yyyy HH:mm')}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => handleViewIntent(file)} className="text-primary hover:text-primary/80 h-8 w-8" title="View Details">
                            <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteIntent(file)} className="text-destructive hover:text-destructive/80 h-8 w-8" title="Delete Entry">
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
            <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-primary">View Knowledge Base Entry</DialogTitle>
                    <DialogDescription>Details for: {fileToView.name}</DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-grow p-1 pr-3 -mx-1">
                    <div className="space-y-3 p-4 rounded-md border bg-muted/10">
                        <p><strong>Name:</strong> {fileToView.name}</p>
                        <p><strong>Type:</strong> {fileToView.isTextEntry ? "Text Entry" : fileToView.type}</p>
                        <p><strong>Size:</strong> {fileToView.isTextEntry ? `${fileToView.size} characters` : formatBytes(fileToView.size)}</p>
                        <p><strong>Product:</strong> {fileToView.product || "N/A"}</p>
                        <p><strong>Category:</strong> {fileToView.category || "N/A"}</p>
                        <p><strong>Persona:</strong> {fileToView.persona || "N/A"}</p>
                        <p><strong>Uploaded:</strong> {format(parseISO(fileToView.uploadDate), 'PPPP pppp')}</p>
                        {fileToView.isTextEntry && fileToView.textContent && (
                            <div className="mt-2">
                                <Label htmlFor="kb-view-text-content" className="font-semibold">Content:</Label>
                                <Textarea
                                    id="kb-view-text-content"
                                    value={fileToView.textContent}
                                    readOnly
                                    className="min-h-[200px] max-h-[35vh] bg-background mt-1 whitespace-pre-wrap text-sm"
                                />
                            </div>
                        )}
                        {!fileToView.isTextEntry && (
                           <p className="text-xs text-muted-foreground italic mt-2">Content of uploaded files cannot be previewed here. This entry is a file reference.</p>
                        )}
                    </div>
                </ScrollArea>
                <DialogFooter className="pt-4">
                    <Button onClick={() => handleViewDialogChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </>
  );
}
