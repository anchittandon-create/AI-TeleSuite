
"use client";

import { useState, ChangeEvent, useId } from 'react';
import { transcribeAudio } from '@/ai/flows/transcription-flow';
import type { TranscriptionInput, TranscriptionOutput } from '@/ai/flows/transcription-flow';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, UploadCloud, InfoIcon, Mic } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { fileToDataUrl } from '@/lib/file-utils';
import { TranscriptionResultsTable } from '@/components/features/transcription/transcription-results-table';
import type { ActivityLogEntry } from '@/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BatchProgressList, BatchProgressItem } from '@/components/common/batch-progress-list';

// Increase the timeout for this page and its server actions
export const maxDuration = 300; // 5 minutes (Vercel Hobby limit)

interface TranscriptionResultItem {
  id: string;
  fileName: string;
  diarizedTranscript: string;
  accuracyAssessment: string;
  audioDataUri?: string;
  error?: string;
}

const MAX_AUDIO_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a", "audio/ogg", "audio/webm", "audio/aac", "audio/flac"
];

export default function TranscriptionPage() {
  const [results, setResults] = useState<TranscriptionResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [processedFileCount, setProcessedFileCount] = useState(0);
  const [progressItems, setProgressItems] = useState<BatchProgressItem[]>([]);
  
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const uniqueId = useId();

  const updateProgress = (fileName: string, updates: Partial<BatchProgressItem>) => {
    setProgressItems(prev => {
      const idx = prev.findIndex(item => item.fileName === fileName);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...updates };
      return next;
    });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setResults([]);
    setProgressItems([]);
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
        if (file.type !== "" && !ALLOWED_AUDIO_TYPES.includes(file.type)) {
           if (file.type !== "") {
                console.warn(`Potentially unsupported audio type for ${file.name}: ${file.type}. Transcription may fail.`);
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
    setResults([]);
    setProcessedFileCount(0);
    setProgressItems(
      audioFiles.map((file, index) => ({
        id: `${uniqueId}-progress-${index}`,
        fileName: file.name,
        step: 'Queued',
        status: 'queued',
        progress: 0,
      }))
    );
    const newResults: TranscriptionResultItem[] = [];

    for (let i = 0; i < audioFiles.length; i++) {
      const audioFile = audioFiles[i];
      setProcessedFileCount(i + 1);
      updateProgress(audioFile.name, {
        step: 'Preparing audio',
        status: 'running',
        progress: 15,
      });
      let audioDataUri = "";
      try {
        audioDataUri = await fileToDataUrl(audioFile);
        updateProgress(audioFile.name, {
          step: 'Uploading to AI service',
          status: 'running',
          progress: 40,
        });
        const input: TranscriptionInput = { audioDataUri };
        const transcriptionOutput = await transcribeAudio(input);
        updateProgress(audioFile.name, {
          step: 'Generating transcript',
          status: 'running',
          progress: 75,
        });

        let resultItemError: string | undefined = undefined;
        if (transcriptionOutput.accuracyAssessment === "Error" || (transcriptionOutput.diarizedTranscript && transcriptionOutput.diarizedTranscript.startsWith("[") && transcriptionOutput.diarizedTranscript.toLowerCase().includes("error"))) {
            resultItemError = transcriptionOutput.diarizedTranscript || `Transcription failed for ${audioFile.name}.`;
        }

        const resultItem: TranscriptionResultItem = {
          id: `${uniqueId}-${audioFile.name}-${i}`,
          fileName: audioFile.name,
          audioDataUri: audioDataUri,
          ...transcriptionOutput,
          error: resultItemError,
        };
        
        newResults.push(resultItem);
        setResults([...newResults]); // Update UI incrementally
        updateProgress(audioFile.name, {
          step: 'Completed',
          status: 'success',
          progress: 100,
          message: resultItemError ? undefined : `Accuracy: ${transcriptionOutput.accuracyAssessment}`,
        });

        logActivity({
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
        const errorItem: TranscriptionResultItem = {
          id: `${uniqueId}-${audioFile.name}-${i}`,
          fileName: audioFile.name,
          audioDataUri: audioDataUri,
          ...errorTranscriptionOutput,
          error: errorMessage,
        };
        newResults.push(errorItem);
        setResults([...newResults]); // Update UI with error item
        updateProgress(audioFile.name, {
          step: 'Failed',
          status: 'failed',
          progress: 100,
          message: errorMessage,
        });

        logActivity({
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

    setIsLoading(false);
    toast({
        title: "All Files Processed",
        description: `Finished processing all ${audioFiles.length} file(s).`,
    });
  };
  
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Audio Transcription" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-8">
        {progressItems.length > 0 && (
          <BatchProgressList
            items={progressItems}
            description="Progress is updated for each file and step."
          />
        )}
        <Card className="w-full max-w-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><UploadCloud className="mr-2 h-6 w-6 text-primary"/> Transcribe Audio File(s)</CardTitle>
            <CardDescription>Upload one or more audio files to get their text transcripts in English (Roman script), with speaker labels and accuracy assessment.</CardDescription>
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
            {error && !isLoading && (
              <Alert variant="destructive" className="mt-4">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  <Accordion type="single" collapsible>
                    <AccordionItem value="item-1" className="border-b-0">
                      <AccordionTrigger className="p-0 hover:no-underline text-sm">A file validation error occurred. Click to view details.</AccordionTrigger>
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

        {results && results.length > 0 && (
            <div className="w-full max-w-5xl space-y-4">
                <TranscriptionResultsTable results={results} />
            </div>
        )}
      </main>
    </div>
  );
}
