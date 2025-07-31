
"use client";

import { useState, ChangeEvent, useId, useRef, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { transcribeAudio } from '@/ai/flows/transcription-flow';
import type { TranscriptionInput, TranscriptionOutput } from '@/ai/flows/transcription-flow';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, UploadCloud, InfoIcon, Mic, Download, FileArchive } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { fileToDataUrl } from '@/lib/file-utils';
import { TranscriptionResultsTable, TranscriptionResultItem } from '@/components/features/transcription/transcription-results-table';
import type { ActivityLogEntry } from '@/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const MAX_AUDIO_FILE_SIZE = 100 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a", "audio/ogg", "audio/webm", "audio/aac", "audio/flac"
];

export default function TranscriptionAndAnalysisPage() {
  const [results, setResults] = useState<TranscriptionResultItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [processedFileCount, setProcessedFileCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const { toast } = useToast();
  const { logBatchActivities } = useActivityLogger();
  const uniqueId = useId();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setResults(null);
    setSelectedIds([]);
    const files = event.target.files;
    if (files && files.length > 0) {
      const selectedFilesArray = Array.from(files);
      const validFiles: File[] = [];
      let fileErrorFound = false;

      for (const file of selectedFilesArray) {
        if (file.size > MAX_AUDIO_FILE_SIZE) {
          setError(`File "${file.name}" exceeds ${MAX_AUDIO_FILE_SIZE / (1024*1024)}MB limit.`);
          fileErrorFound = true;
          break;
        }
        if (!ALLOWED_AUDIO_TYPES.includes(file.type)) {
           // Allow files with no MIME type to pass, as they might still be valid audio files.
           // The backend model will ultimately determine compatibility.
           if (file.type !== "") {
                setError(`File "${file.name}" has a potentially unsupported audio type: ${file.type}.`);
                fileErrorFound = true;
                break;
           }
        }
        validFiles.push(file);
      }

      if (fileErrorFound) {
        setAudioFiles([]);
        event.target.value = '';
      } else {
        setAudioFiles(validFiles);
      }
    } else {
      setAudioFiles([]);
    }
  };

  const handleAnalyze = async () => {
    if (audioFiles.length === 0) {
      setError("Please select one or more audio files first.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);
    setSelectedIds([]);
    setProcessedFileCount(0);

    const allResults: TranscriptionResultItem[] = [];
    const activitiesToLog: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>[] = [];
    let currentFileIndex = 0;

    for (const audioFile of audioFiles) {
      currentFileIndex++;
      setProcessedFileCount(currentFileIndex);
      let audioDataUri = "";
      try {
        audioDataUri = await fileToDataUrl(audioFile);
        const input: TranscriptionInput = { audioDataUri };
        const transcriptionOutput = await transcribeAudio(input);

        let resultItemError: string | undefined = undefined;
        if (transcriptionOutput.accuracyAssessment === "Error" || (transcriptionOutput.diarizedTranscript && transcriptionOutput.diarizedTranscript.startsWith("[") && transcriptionOutput.diarizedTranscript.toLowerCase().includes("error"))) {
            resultItemError = transcriptionOutput.diarizedTranscript || `Transcription failed for ${audioFile.name}.`;
        }

        const resultItem: TranscriptionResultItem = {
          id: `${uniqueId}-${audioFile.name}-${currentFileIndex}`,
          fileName: audioFile.name,
          audioDataUri: audioDataUri,
          ...transcriptionOutput,
          error: resultItemError,
        };
        allResults.push(resultItem);

        activitiesToLog.push({
          module: "Transcription",
          product: "General",
          details: {
            fileName: audioFile.name,
            transcriptionOutput: transcriptionOutput,
            error: resultItemError,
          }
        });

      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
        const errorTranscriptionOutput: TranscriptionOutput = {
            diarizedTranscript: `[Critical Error processing file: ${errorMessage}]`,
            accuracyAssessment: "Error",
        };
        allResults.push({
          id: `${uniqueId}-${audioFile.name}-${currentFileIndex}`,
          fileName: audioFile.name,
          audioDataUri: audioDataUri,
          ...errorTranscriptionOutput,
          error: errorMessage,
        });
        activitiesToLog.push({
          module: "Transcription",
          product: "General",
          details: {
            fileName: audioFile.name,
            error: errorMessage,
            transcriptionOutput: errorTranscriptionOutput,
          }
        });
        toast({
          variant: "destructive",
          title: `Transcription Failed for ${audioFile.name}`,
          description: errorMessage,
        });
      }
    }

    if (activitiesToLog.length > 0) {
      logBatchActivities(activitiesToLog);
    }
    setResults(allResults);
    setIsLoading(false);

    if (allResults.every(r => !r.error)) {
        toast({
            title: "Transcription Complete!",
            description: `Successfully transcribed ${allResults.length} file(s).`,
        });
    }
  };
  
  const handleExportSelected = useCallback(async () => {
    if (!results || selectedIds.length === 0) {
      toast({
        variant: "default",
        title: "No Transcripts Selected",
        description: "Please select one or more transcripts to export.",
      });
      return;
    }
    const itemsToExport = results.filter(item => selectedIds.includes(item.id));
    toast({
        title: "Preparing ZIP...",
        description: `Bundling ${itemsToExport.length} transcript(s).`,
    });
    try {
      const zip = new JSZip();
      for (const item of itemsToExport) {
        if (item.diarizedTranscript && !item.error) {
          const fileName = (item.fileName ? (item.fileName.includes('.') ? item.fileName.substring(0, item.fileName.lastIndexOf('.')) : item.fileName) : "transcript") + ".txt";
          zip.file(fileName, item.diarizedTranscript);
        }
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `selected_transcripts_export_${new Date().toISOString().replace(/:/g, '-')}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast({ title: "Export Successful", description: `${itemsToExport.length} transcript(s) downloaded as a ZIP file.` });
    } catch (error) {
      console.error("ZIP Export error:", error);
      toast({ variant: "destructive", title: "Export Failed", description: `Could not export transcripts.` });
    }
  }, [results, selectedIds, toast]);


  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Audio Transcription" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-8">
        <Card className="w-full max-w-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><UploadCloud className="mr-2 h-6 w-6 text-primary"/> Transcribe Audio File(s)</CardTitle>
            <CardDescription>Upload audio files to receive a detailed transcription with speaker diarization.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="audio-upload">Audio File(s) <span className="text-destructive">*</span></Label>
              <Input
                id="audio-upload"
                type="file"
                accept={ALLOWED_AUDIO_TYPES.join(",")}
                onChange={handleFileChange}
                multiple
                className="pt-1.5"
              />
              {audioFiles.length > 0 && <p className="text-sm text-muted-foreground mt-1">Selected: {audioFiles.length} file(s)</p>}
              <p className="text-xs text-muted-foreground">Supported: MP3, WAV, M4A, etc. (Max ${MAX_AUDIO_FILE_SIZE / (1024*1024)}MB per file).</p>
            </div>
            <Alert variant="default" className="mt-2">
                <InfoIcon className="h-4 w-4" />
                <AlertTitle>Processing Note</AlertTitle>
                <AlertDescription>
                  Longer audio may take more time or hit AI limits. Shorter files process faster.
                </AlertDescription>
            </Alert>
            {error && !isLoading && (
              <Alert variant="destructive" className="mt-4">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  <Accordion type="single" collapsible>
                    <AccordionItem value="item-1" className="border-b-0">
                      <AccordionTrigger className="p-0 hover:no-underline text-sm">A file validation error occurred. Click to see details.</AccordionTrigger>
                      <AccordionContent className="pt-2 text-xs">
                        <pre className="whitespace-pre-wrap break-all bg-destructive/10 p-2 rounded-md font-mono">{error}</pre>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </AlertDescription>
              </Alert>
            )}
            <Button
              onClick={handleAnalyze}
              disabled={isLoading || audioFiles.length === 0 || !!error}
              className="w-full"
            >
              {isLoading ? `Transcribing (${processedFileCount}/${audioFiles.length})...` : `Transcribe ${audioFiles.length > 0 ? audioFiles.length : ''} File(s)`}
            </Button>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="flex flex-col items-center gap-2">
            <LoadingSpinner size={32} />
            <p className="text-muted-foreground">{audioFiles.length > 1 ? `Processing file ${processedFileCount} of ${audioFiles.length}...` : 'Processing audio...'}</p>
          </div>
        )}

        {results && !isLoading && results.length > 0 && (
            <div className="w-full max-w-5xl space-y-4">
                <div className="flex justify-end">
                    <Button onClick={handleExportSelected} disabled={selectedIds.length === 0}>
                        <FileArchive className="mr-2 h-4 w-4" /> Export Selected as ZIP ({selectedIds.length})
                    </Button>
                </div>
                <TranscriptionResultsTable results={results} />
            </div>
        )}
      </main>
    </div>
  );
}
