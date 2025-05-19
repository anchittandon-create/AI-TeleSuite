
"use client";

import { useState, ChangeEvent, useId } from 'react';
import { transcribeAudio } from '@/ai/flows/transcription-flow';
import type { TranscriptionInput, TranscriptionOutput } from '@/ai/flows/transcription-flow';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Copy, Download, UploadCloud, FileText, List, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { fileToDataUrl } from '@/lib/file-utils';
import { exportToTxt } from '@/lib/export';
import { TranscriptionResultsTable, TranscriptionResultItem } from '@/components/features/transcription/transcription-results-table';

const MAX_AUDIO_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a", "audio/ogg", "audio/webm", "audio/aac", "audio/flac"
];

export default function TranscriptionPage() {
  const [transcriptionResults, setTranscriptionResults] = useState<TranscriptionResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [processedFileCount, setProcessedFileCount] = useState(0);

  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const uniqueId = useId();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setTranscriptionResults([]);
    const files = event.target.files;
    if (files && files.length > 0) {
      const selectedFilesArray = Array.from(files);
      const validFiles: File[] = [];
      let fileErrorFound = false;

      for (const file of selectedFilesArray) {
        if (file.size > MAX_AUDIO_FILE_SIZE) {
          setError(`File "${file.name}" exceeds ${MAX_AUDIO_FILE_SIZE / (1024*1024)}MB limit. Please select smaller files or upload individually.`);
          fileErrorFound = true;
          break;
        }
        if (!ALLOWED_AUDIO_TYPES.includes(file.type)) {
          setError(`File "${file.name}" has an unsupported audio type. Please select valid audio files.`);
          fileErrorFound = true;
          break;
        }
        validFiles.push(file);
      }

      if (fileErrorFound) {
        setAudioFiles([]);
        event.target.value = ''; // Clear the input
      } else {
        setAudioFiles(validFiles);
      }
    } else {
      setAudioFiles([]);
    }
  };

  const handleTranscribe = async () => {
    if (audioFiles.length === 0) {
      setError("Please select one or more audio files first.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setTranscriptionResults([]);
    setProcessedFileCount(0);

    const results: TranscriptionResultItem[] = [];
    let currentFileIndex = 0;

    for (const audioFile of audioFiles) {
      currentFileIndex++;
      setProcessedFileCount(currentFileIndex);
      try {
        const audioDataUri = await fileToDataUrl(audioFile);
        const input: TranscriptionInput = { audioDataUri };
        const result: TranscriptionOutput = await transcribeAudio(input);
        results.push({
          id: `${uniqueId}-${audioFile.name}-${currentFileIndex}`,
          fileName: audioFile.name,
          diarizedTranscript: result.diarizedTranscript,
          accuracyAssessment: result.accuracyAssessment,
        });
        logActivity({
          module: "Transcription",
          details: `Transcribed audio file: ${audioFile.name}. Accuracy: ${result.accuracyAssessment}`,
        });
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred during transcription.";
        results.push({
          id: `${uniqueId}-${audioFile.name}-${currentFileIndex}`,
          fileName: audioFile.name,
          diarizedTranscript: `[Error transcribing file: ${errorMessage}]`,
          accuracyAssessment: "Error in processing.",
          error: errorMessage,
        });
        toast({
          variant: "destructive",
          title: `Transcription Failed for ${audioFile.name}`,
          description: errorMessage,
        });
        console.error(`Error transcribing ${audioFile.name}:`, e);
      }
    }
    
    setTranscriptionResults(results);
    setIsLoading(false);

    if (results.length > 0 && results.every(r => !r.error)) {
        toast({
            title: "Transcription Complete!",
            description: `Successfully transcribed ${results.length} file(s).`,
        });
    } else if (results.some(r => r.error) && results.some(r => !r.error)) {
        toast({
            title: "Partial Transcription Complete",
            description: "Some files were transcribed successfully, while others failed. Check results below.",
            variant: "default"
        });
    } else if (results.every(r => r.error) && results.length > 0) {
         toast({
            title: "All Transcriptions Failed",
            description: "Could not transcribe any of the selected files. Check individual errors below or try again.",
            variant: "destructive"
        });
    }
  };
  
  const handleCopyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => toast({ title: "Success", description: "Transcript copied to clipboard!" }))
      .catch(() => toast({ variant: "destructive", title: "Error", description: "Failed to copy transcript." }));
  };
  
  const handleDownloadTxt = (text: string, fileName: string) => {
    if (!text || !fileName) return;
    try {
      const txtFilename = fileName.substring(0, fileName.lastIndexOf('.')) + "_transcript.txt" || "transcript.txt";
      exportToTxt(txtFilename, text);
      toast({ title: "Success", description: "Transcript TXT downloaded." });
    } catch (error) {
       toast({ variant: "destructive", title: "Error", description: "Failed to download TXT." });
    }
  };

  const getAccuracyIcon = (assessment?: string) => {
    if (!assessment) return <ShieldAlert className="h-4 w-4 text-muted-foreground" />;
    const lowerAssessment = assessment.toLowerCase();
    if (lowerAssessment.includes("high")) return <ShieldCheck className="h-4 w-4 text-green-500" />;
    if (lowerAssessment.includes("medium")) return <ShieldCheck className="h-4 w-4 text-yellow-500" />;
    if (lowerAssessment.includes("low") || lowerAssessment.includes("error")) return <ShieldAlert className="h-4 w-4 text-red-500" />;
    return <ShieldAlert className="h-4 w-4 text-muted-foreground" />;
  };

  const singleResult = transcriptionResults.length === 1 ? transcriptionResults[0] : null;

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Audio Transcription" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-8">
        <Card className="w-full max-w-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><UploadCloud className="mr-2 h-6 w-6 text-primary"/> Transcribe Audio File(s)</CardTitle>
            <CardDescription>Upload one or more audio files to get their text transcripts in English, with speaker labels and accuracy assessment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="audio-upload">Audio File(s)</Label>
              <Input 
                id="audio-upload" 
                type="file" 
                accept={ALLOWED_AUDIO_TYPES.join(",")} 
                onChange={handleFileChange}
                multiple 
                className="pt-1.5"
              />
              {audioFiles.length > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  Selected: {audioFiles.map(f => f.name).join(', ')} ({audioFiles.length} file(s))
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Supported: MP3, WAV, M4A, OGG, etc. (Max 15MB per file). Audio will be transcribed to English.
              </p>
            </div>
            {error && !isLoading && (
              <Alert variant="destructive" className="mt-4">
                <Terminal className="h-4 w-4" />
                <AlertTitle>File Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button 
              onClick={handleTranscribe} 
              disabled={isLoading || audioFiles.length === 0 || !!error} 
              className="w-full"
            >
              {isLoading ? `Transcribing (${processedFileCount}/${audioFiles.length})...` : `Transcribe ${audioFiles.length > 1 ? audioFiles.length + ' Files' : 'Audio'}`}
            </Button>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="flex flex-col items-center gap-2">
            <LoadingSpinner size={32} />
            <p className="text-muted-foreground">
              {audioFiles.length > 1 ? `Processing file ${processedFileCount} of ${audioFiles.length}...` : 'Processing audio...'}
            </p>
          </div>
        )}

        {error && isLoading && (
          <Alert variant="destructive" className="mt-8 max-w-lg">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Transcription Process Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!isLoading && transcriptionResults.length > 0 && (
          <>
            {singleResult && !singleResult.error && (
              <Card className="w-full max-w-2xl shadow-xl">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-xl text-primary flex items-center"><FileText className="mr-2 h-5 w-5"/>Transcription Result</CardTitle>
                        {singleResult.fileName && <CardDescription>Transcript for: {singleResult.fileName}</CardDescription>}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground" title={`Accuracy: ${singleResult.accuracyAssessment}`}>
                        {getAccuracyIcon(singleResult.accuracyAssessment)}
                        {singleResult.accuracyAssessment}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={singleResult.diarizedTranscript}
                    readOnly
                    className="min-h-[300px] text-sm bg-muted/20 whitespace-pre-wrap"
                    aria-label="Transcription text"
                  />
                   <div className="flex gap-2 mt-4 justify-end">
                        <Button variant="outline" size="sm" onClick={() => handleCopyToClipboard(singleResult.diarizedTranscript)}>
                            <Copy className="mr-2 h-4 w-4" /> Copy
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDownloadTxt(singleResult.diarizedTranscript, singleResult.fileName)}>
                            <Download className="mr-2 h-4 w-4" /> Download TXT
                        </Button>
                    </div>
                </CardContent>
              </Card>
            )}
             {singleResult && singleResult.error && (
                <Alert variant="destructive" className="w-full max-w-2xl">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Error Transcribing: {singleResult.fileName}</AlertTitle>
                    <AlertDescription>{singleResult.error}</AlertDescription>
                     <div className="flex items-center gap-2 text-sm mt-2" title={`Accuracy: ${singleResult.accuracyAssessment}`}>
                        {getAccuracyIcon(singleResult.accuracyAssessment)}
                        {singleResult.accuracyAssessment}
                    </div>
                </Alert>
            )}

            {transcriptionResults.length > 1 && (
                <Card className="w-full max-w-4xl shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-xl text-primary flex items-center"><List className="mr-2 h-5 w-5"/>Transcription Results ({transcriptionResults.length} files)</CardTitle>
                        <CardDescription>Review transcripts for the uploaded audio files. Includes speaker labels and accuracy assessment.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <TranscriptionResultsTable results={transcriptionResults} />
                    </CardContent>
                </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}

