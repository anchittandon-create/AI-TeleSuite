
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
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KnowledgeFile } from "@/types";
import { format, parseISO } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { FileText, FileAudio, FileSpreadsheet, PenSquare, Trash2, ArrowUpDown } from "lucide-react"; // Changed TypeSquare to PenSquare
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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
    if (file.isTextEntry) return <PenSquare className="h-5 w-5 text-purple-500" />; // Changed TypeSquare to PenSquare
    if (file.type.startsWith('audio/')) return <FileAudio className="h-5 w-5 text-primary" />;
    if (file.type === 'application/pdf') return <FileText className="h-5 w-5 text-red-500" />;
    if (file.type === 'text/csv') return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    if (file.type.includes('wordprocessingml') || file.type.includes('msword')) return <FileText className="h-5 w-5 text-blue-500" />;
    if (file.type === 'text/plain') return <FileText className="h-5 w-5 text-gray-500" />;
    return <FileText className="h-5 w-5 text-muted-foreground" />; 
}

export function KnowledgeBaseTable({ files, onDeleteFile }: KnowledgeBaseTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('uploadDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [fileToDelete, setFileToDelete] = useState<KnowledgeFile | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);

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
    setIsAlertOpen(true); // Ensure dialog opens when a file is selected for deletion
  };

  const confirmDeleteAction = () => {
    if (fileToDelete) {
      onDeleteFile(fileToDelete.id);
    }
  };

  const handleAlertOpenChange = (open: boolean) => {
    setIsAlertOpen(open);
    if (!open) {
      setFileToDelete(null); 
    }
  };

  return (
    <AlertDialog open={isAlertOpen} onOpenChange={handleAlertOpenChange}>
      <Card className="w-full max-w-4xl mt-8 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Knowledge Base Entries</CardTitle>
          <CardDescription>All uploaded documents and text entries available for AI assistance.</CardDescription>
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
                        {file.persona ? <Badge variant="outline" className="max-w-[150px] truncate">{file.persona}</Badge> : <span className="text-muted-foreground text-xs">N/A</span>}
                      </TableCell>
                      <TableCell>{file.isTextEntry ? `${file.size} chars` : formatBytes(file.size)}</TableCell>
                      <TableCell>{format(parseISO(file.uploadDate), 'MMM d, yyyy HH:mm')}</TableCell>
                      <TableCell className="text-right">
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteIntent(file)} className="text-destructive hover:text-destructive/80">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
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
          <AlertDialogContent>
              <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the entry
                  <span className="font-semibold"> {fileToDelete.name} </span> 
                  from the knowledge base.
              </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteAction} className="bg-destructive hover:bg-destructive/90">
                  Delete
              </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      )}
    </AlertDialog>
  );
}

