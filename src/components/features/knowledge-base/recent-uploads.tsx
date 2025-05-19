
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KnowledgeFile } from "@/types";
import { format, parseISO } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { FileText, FileAudio, FileSpreadsheet, AlertCircle } from "lucide-react";

interface RecentUploadsProps {
  files: KnowledgeFile[];
  count?: number;
}

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
    return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
}


export function RecentUploads({ files, count = 5 }: RecentUploadsProps) {
  // Sort files by uploadDate in descending order first, then slice
  const sortedFiles = [...files].sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
  const recentFiles = sortedFiles.slice(0, count);

  return (
    <Card className="w-full max-w-2xl mt-8 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Recently Uploaded Files</CardTitle>
        <CardDescription>Showing the latest {Math.min(count, recentFiles.length)} of {files.length} uploads.</CardDescription>
      </CardHeader>
      <CardContent>
        {recentFiles.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No files uploaded yet.</p>
        ) : (
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Persona</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentFiles.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell>{getFileIcon(file.type)}</TableCell>
                    <TableCell className="font-medium max-w-[150px] truncate" title={file.name}>{file.name}</TableCell>
                    <TableCell>
                      {file.product ? <Badge variant="secondary">{file.product}</Badge> : <span className="text-muted-foreground text-xs">N/A</span>}
                    </TableCell>
                    <TableCell>
                      {file.persona ? <Badge variant="outline" className="max-w-[100px] truncate">{file.persona}</Badge> : <span className="text-muted-foreground text-xs">N/A</span>}
                    </TableCell>
                    <TableCell>{formatBytes(file.size)}</TableCell>
                    <TableCell>{format(parseISO(file.uploadDate), 'MMM d, yyyy')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

