
"use client";

import { useState, ChangeEvent, useId } from 'react';
import type { TranscriptionInput, TranscriptionOutput } from '@/types';
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
import { formatTranscriptSegments } from '@/lib/transcript-utils';
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

const MAX_AUDIO_FILE_SIZE = 100 * 1024 * 1024; // 100MB - aligned with Vercel limits
const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50MB - warn for large files
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
          setError(`File "${file.name}" exceeds the ${MAX_AUDIO_FILE_SIZE / (1024*1024)}MB limit. Please use a smaller file or contact support for larger file processing.`);
          fileErrorFound = true;
          break;
        }
        if (file.size > LARGE_FILE_THRESHOLD) {
          console.warn(`Large file detected: ${file.name} (${(file.size / (1024*1024)).toFixed(1)}MB). Processing may take longer.`);
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
        step: 'Converting audio file',
        status: 'running',
        progress: 10,
        message: 'Preparing audio data for upload',
      });
      let audioDataUri = "";
      try {
        audioDataUri = await fileToDataUrl(audioFile);
        updateProgress(audioFile.name, {
          step: 'Uploading to AI service',
          status: 'running',
          progress: 30,
          message: 'Sending audio to transcription API',
        });
        const input: TranscriptionInput = { audioDataUri };
        const response = await fetch('/api/transcription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        if (!response.ok) {
          throw new Error(`Transcription API failed: ${response.statusText}`);
        }
        const transcriptionOutput: TranscriptionOutput = await response.json();
        updateProgress(audioFile.name, {
          step: 'Processing transcript',
          status: 'running',
          progress: 80,
          message: 'Analyzing audio and generating text',
        });

        // Use standard formatting utility for consistency
        const diarizedTranscript = formatTranscriptSegments(transcriptionOutput);
        const accuracyAssessment = "Completed";

        let resultItemError: string | undefined = undefined;
        if (diarizedTranscript.trim() === "" || (diarizedTranscript.startsWith("[") && diarizedTranscript.toLowerCase().includes("error"))) {
            resultItemError = diarizedTranscript || `Transcription failed for ${audioFile.name}.`;
        }

        const resultItem: TranscriptionResultItem = {
          id: `${uniqueId}-${audioFile.name}-${i}`,
          fileName: audioFile.name,
          audioDataUri: audioDataUri,
          diarizedTranscript,
          accuracyAssessment,
          error: resultItemError,
        };
        
        newResults.push(resultItem);
        setResults([...newResults]); // Update UI incrementally
        updateProgress(audioFile.name, {
          step: 'Completed',
          status: 'success',
          progress: 100,
          message: resultItemError ? 'Transcription failed' : `Transcribed successfully - ${accuracyAssessment}`,
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
        const errorItem: TranscriptionResultItem = {
          id: `${uniqueId}-${audioFile.name}-${i}`,
          fileName: audioFile.name,
          audioDataUri: audioDataUri,
          diarizedTranscript: `[Critical Error processing file: ${errorMessage}]`,
          accuracyAssessment: "Error",
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
            transcriptionOutput: {
              callMeta: { sampleRateHz: null, durationSeconds: null },
              segments: [],
              summary: { overview: "", keyPoints: [], actions: [] },
            },
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
        <Card className="w-full max-w-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><UploadCloud className="mr-2 h-6 w-6 text-primary"/> Transcribe Audio File(s)</CardTitle>
            <CardDescription>Upload one or more audio files to get their text transcripts in English Roman script ONLY, with speaker labels and timestamps. All languages (including Hindi, Tamil, Telugu, etc.) will be transcribed using Roman alphabet transliteration.</CardDescription>
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
              {audioFiles.some(file => file.size > LARGE_FILE_THRESHOLD) && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                  <p className="text-xs text-amber-800">
                    ⚠️ Large files detected. Processing may take 5-15 minutes per file.
                  </p>
                </div>
              )}
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

        {progressItems.length > 0 && (
          <BatchProgressList
            items={progressItems}
            title="Transcription Progress"
            description="Track the progress of each file being transcribed."
          />
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
