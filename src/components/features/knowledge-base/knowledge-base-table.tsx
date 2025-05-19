
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
import { FileText, FileAudio, FileSpreadsheet, AlertCircle, Trash2, ArrowUpDown } from "lucide-react";
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

function getFileIcon(mimeType: string) {
    if (mimeType.startsWith('audio/')) return <FileAudio className="h-5 w-5 text-primary" />;
    if (mimeType === 'application/pdf') return <FileText className="h-5 w-5 text-red-500" />;
    if (mimeType === 'text/csv') return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) return <FileText className="h-5 w-5 text-blue-500" />;
    if (mimeType === 'text/plain') return <FileText className="h-5 w-5 text-gray-500" />;
    return <AlertCircle className="h-5 w-5 text-muted-foreground" />; // Default icon
}

export function KnowledgeBaseTable({ files, onDeleteFile }: KnowledgeBaseTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('uploadDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [fileToDelete, setFileToDelete] = useState<KnowledgeFile | null>(null);

  const sortedFiles = [...files].sort((a, b) => {
    if (!sortKey) return 0;
    const valA = a[sortKey];
    const valB = b[sortKey];

    let comparison = 0;
    if (valA === undefined || valA === null) comparison = -1;
    else if (valB === undefined || valB === null) comparison = 1;
    else if (sortKey === 'uploadDate') { // Ensure date sorting is correct
        comparison = new Date(valA as string).getTime() - new Date(valB as string).getTime();
    } else if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
    } else if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB);
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

  const handleDeleteClick = (file: KnowledgeFile) => {
    setFileToDelete(file);
  };

  const confirmDelete = () => {
    if (fileToDelete) {
      onDeleteFile(fileToDelete.id);
      setFileToDelete(null);
    }
  };

  return (
    <Card className="w-full max-w-4xl mt-8 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Knowledge Base Files</CardTitle>
        <CardDescription>All uploaded documents available for AI assistance.</CardDescription>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No files uploaded yet.</p>
        ) : (
          <ScrollArea className="h-[calc(100vh-400px)] md:h-[500px]"> {/* Adjusted height */}
            <Table>
              <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm">
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead onClick={() => requestSort('name')} className="cursor-pointer">
                    Name {getSortIndicator('name')}
                  </TableHead>
                  <TableHead onClick={() => requestSort('product')} className="cursor-pointer">
                    Product {getSortIndicator('product')}
                  </TableHead>
                  <TableHead onClick={() => requestSort('persona')} className="cursor-pointer">
                    Persona {getSortIndicator('persona')}
                  </TableHead>
                  <TableHead onClick={() => requestSort('size')} className="cursor-pointer">
                    Size {getSortIndicator('size')}
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
                    <TableCell>{getFileIcon(file.type)}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate" title={file.name}>{file.name}</TableCell>
                    <TableCell>
                      {file.product ? <Badge variant="secondary">{file.product}</Badge> : <span className="text-muted-foreground text-xs">N/A</span>}
                    </TableCell>
                    <TableCell>
                      {file.persona ? <Badge variant="outline" className="max-w-[150px] truncate">{file.persona}</Badge> : <span className="text-muted-foreground text-xs">N/A</span>}
                    </TableCell>
                    <TableCell>{formatBytes(file.size)}</TableCell>
                    <TableCell>{format(parseISO(file.uploadDate), 'MMM d, yyyy HH:mm')}</TableCell>
                    <TableCell className="text-right">
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(file)} className="text-destructive hover:text-destructive/80">
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
      {fileToDelete && (
        <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the file 
                    <span className="font-semibold"> {fileToDelete.name} </span> 
                    from the knowledge base.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setFileToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
                    Delete
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </Card>
  );
}

