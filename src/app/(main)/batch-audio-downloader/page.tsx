
"use client";

import React, { useState, ChangeEvent } from 'react';
import JSZip from 'jszip';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DownloadCloud, List, FileText, InfoIcon as Info, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';

export default function BatchAudioDownloaderPage() {
  const [urls, setUrls] = useState<string>('');
  const [zipFilename, setZipFilename] = useState<string>('audio_batch.zip');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [successCount, setSuccessCount] = useState<number>(0);
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();

  const getFilenameFromUrl = (url: string, index: number): string => {
    try {
      const parsedUrl = new URL(url);
      let pathname = parsedUrl.pathname;
      // Remove trailing slash if it exists
      if (pathname.endsWith('/')) {
        pathname = pathname.substring(0, pathname.length - 1);
      }
      const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
      // Ensure it has an extension or add a default one based on common audio types
      if (filename && filename.includes('.')) {
        return filename;
      } else if (filename) {
        // Attempt to guess common extensions, otherwise default
        if (url.toLowerCase().includes('.mp3')) return `${filename}.mp3`;
        if (url.toLowerCase().includes('.wav')) return `${filename}.wav`;
        if (url.toLowerCase().includes('.m4a')) return `${filename}.m4a`;
        if (url.toLowerCase().includes('.ogg')) return `${filename}.ogg`;
        return `${filename}.audio`; // Generic fallback
      }
    } catch (e) {
      // If URL parsing fails
    }
    return `audio_file_${index + 1}.audio`; // Fallback if no filename found
  };

  const handleDownload = async () => {
    const urlList = urls.split('\n').map(url => url.trim()).filter(url => url.length > 0);
    if (urlList.length === 0) {
      toast({ variant: "destructive", title: "No URLs", description: "Please enter at least one audio URL." });
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setCurrentStatus('Starting download process...');
    setErrorMessages([]);
    setSuccessCount(0);
    const zip = new JSZip();
    let localSuccessCount = 0;
    const localErrorMessages: string[] = [];

    logActivity({
      module: "Batch Audio Downloader",
      details: {
        action: "initiate_download",
        urlCount: urlList.length,
        requestedZipName: zipFilename,
      }
    });

    for (let i = 0; i < urlList.length; i++) {
      const url = urlList[i];
      const filename = getFilenameFromUrl(url, i);
      setCurrentStatus(`Fetching (${i + 1}/${urlList.length}): ${filename}...`);
      setProgress(((i + 1) / urlList.length) * 50); // 0-50% for fetching

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${url} (Status: ${response.status})`);
        }
        const blob = await response.blob();
        
        // Basic audio type check from blob (optional, as server might not send correct type)
        if (!blob.type.startsWith('audio/')) {
            console.warn(`File ${filename} from ${url} might not be an audio file (MIME type: ${blob.type}). Adding to ZIP anyway.`);
        }
        
        zip.file(filename, blob);
        localSuccessCount++;
        setSuccessCount(prev => prev + 1);
      } catch (error: any) {
        const errorMessage = `Error downloading ${filename} (from ${url}): ${error.message}`;
        console.error(errorMessage, error);
        localErrorMessages.push(errorMessage);
        setErrorMessages(prev => [...prev, errorMessage]);
      }
    }
    setSuccessCount(localSuccessCount); // Ensure final count is set


    if (localSuccessCount > 0) {
      setCurrentStatus('Zipping files...');
      setProgress(75);
      try {
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        setProgress(100);
        setCurrentStatus('Download ready!');

        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = zipFilename.endsWith('.zip') ? zipFilename : `${zipFilename}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        toast({ title: "Download Complete", description: `${zipFilename} downloaded with ${localSuccessCount} file(s).` });
        logActivity({
          module: "Batch Audio Downloader",
          details: {
            action: "download_success",
            zipName: link.download,
            filesDownloaded: localSuccessCount,
            filesFailed: localErrorMessages.length,
            failedUrls: localErrorMessages.map(e => e.split('(from ')[1]?.split(')')[0]).filter(Boolean)
          }
        });

      } catch (zipError: any) {
        const zipErrorMessage = `Error creating ZIP file: ${zipError.message}`;
        setErrorMessages(prev => [...prev, zipErrorMessage]);
        toast({ variant: "destructive", title: "ZIP Creation Failed", description: zipErrorMessage });
        logActivity({
          module: "Batch Audio Downloader",
          details: {
            action: "download_zip_failed",
            error: zipErrorMessage,
            filesProcessed: localSuccessCount,
            filesInitiallyFailed: localErrorMessages.length,
          }
        });
      }
    } else if (localErrorMessages.length > 0) {
      toast({ variant: "destructive", title: "All Downloads Failed", description: "None of the provided URLs could be downloaded." });
       logActivity({
          module: "Batch Audio Downloader",
          details: {
            action: "download_all_failed",
            urlCount: urlList.length,
            failedUrls: localErrorMessages.map(e => e.split('(from ')[1]?.split(')')[0]).filter(Boolean)
          }
        });
    } else {
        // Should not happen if urlList.length > 0, but as a fallback
        toast({ variant: "default", title: "No Files Processed", description: "No URLs were processed."});
    }

    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Batch Audio Downloader" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-6">
        <Card className="w-full max-w-2xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
              <DownloadCloud className="mr-2 h-6 w-6 text-primary" />
              Download Multiple Audio Files
            </CardTitle>
            <CardDescription>
              Paste direct audio download URLs (one per line). The files will be fetched and bundled into a single ZIP archive for download.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="audio-urls">Audio URLs (one per line)</Label>
              <Textarea
                id="audio-urls"
                placeholder="https://example.com/audio1.mp3&#x0A;https://example.com/another_audio.wav&#x0A;..."
                value={urls}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setUrls(e.target.value)}
                rows={8}
                disabled={isLoading}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="zip-filename">ZIP File Name</Label>
              <Input
                id="zip-filename"
                value={zipFilename}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setZipFilename(e.target.value)}
                placeholder="audio_batch.zip"
                disabled={isLoading}
                className="mt-1"
              />
            </div>
            <Button onClick={handleDownload} disabled={isLoading || !urls.trim()} className="w-full">
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <DownloadCloud className="mr-2 h-4 w-4" />
              )}
              {isLoading ? `Processing... (${Math.round(progress)}%)` : 'Download All as ZIP'}
            </Button>

            {isLoading && (
              <div className="space-y-2 mt-3">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-muted-foreground text-center">{currentStatus}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {(!isLoading && errorMessages.length > 0) && (
          <Card className="w-full max-w-2xl shadow-md mt-4">
            <CardHeader>
              <CardTitle className="text-lg text-destructive flex items-center">
                <AlertTriangle className="mr-2 h-5 w-5" /> Download Errors ({errorMessages.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertDescription>
                  <ScrollArea className="h-32">
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      {errorMessages.map((err, index) => (
                        <li key={index}>{err}</li>
                      ))}
                    </ul>
                  </ScrollArea>
                </AlertDescription>
              </Alert>
              {successCount > 0 && (
                  <Alert variant="default" className="mt-3 bg-green-50 border-green-200 text-green-700">
                    <CheckCircle className="h-4 w-4"/>
                    <AlertTitle className="text-green-800">Partial Success</AlertTitle>
                    <AlertDescription>
                      Successfully downloaded and zipped {successCount} file(s).
                    </AlertDescription>
                  </Alert>
              )}
            </CardContent>
          </Card>
        )}
        
        {!isLoading && successCount > 0 && errorMessages.length === 0 && (
            <Alert variant="default" className="w-full max-w-2xl bg-green-50 border-green-200 text-green-700">
                <CheckCircle className="h-4 w-4"/>
                <AlertTitle className="text-green-800">All Downloads Successful!</AlertTitle>
                <AlertDescription>
                    All {successCount} files were processed and included in the ZIP.
                </AlertDescription>
            </Alert>
        )}

        <Card className="w-full max-w-2xl shadow-sm mt-4">
            <CardHeader>
                <CardTitle className="text-md flex items-center"><Info className="mr-2 h-5 w-5 text-accent"/>Instructions & Notes</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
                <ul className="list-disc list-inside pl-2 space-y-1">
                    <li>Ensure each URL is a direct link to an audio file (e.g., ending in .mp3, .wav, .m4a, .ogg).</li>
                    <li>Large files or a high number of URLs may take a significant time to process as files are downloaded by your browser.</li>
                    <li>The ZIP file will be created in your browser and then downloaded to your default "Downloads" folder.</li>
                    <li>If a URL fails to download, it will be skipped, and an error message will be shown.</li>
                    <li>Filenames within the ZIP are derived from the URLs. If a name cannot be derived, a generic one like `audio_file_1.audio` will be used.</li>
                </ul>
            </CardContent>
        </Card>

      </main>
    </div>
  );
}
