
"use client";

import { useState } from 'react';
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
import { Terminal, Copy, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { fileToDataUrl } from '@/lib/file-utils';
import { exportToTxt } from '@/lib/export';

const MAX_AUDIO_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a", "audio/ogg", "audio/webm", "audio/aac", "audio/flac"
];

export default function TranscriptionPage() {
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const { toast } = useToast();
  const { logActivity } = useActivityLogger();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_AUDIO_FILE_SIZE) {
        setError(`File size exceeds ${MAX_AUDIO_FILE_SIZE / (1024*1024)}MB limit.`);
        setAudioFile(null);
        setFileName(null);
        return;
      }
      if (!ALLOWED_AUDIO_TYPES.includes(file.type)) {
        setError("Unsupported audio file type.");
        setAudioFile(null);
        setFileName(null);
        return;
      }
      setAudioFile(file);
      setFileName(file.name);
      setError(null); // Clear previous errors
    }
  };

  const handleTranscribe = async () => {
    if (!audioFile) {
      setError("Please select an audio file first.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setTranscript(null);

    try {
      const audioDataUri = await fileToDataUrl(audioFile);
      const input: TranscriptionInput = { audioDataUri };
      const result = await transcribeAudio(input);
      setTranscript(result.transcript);
      toast({
        title: "Transcription Complete!",
        description: `Successfully transcribed ${fileName}.`,
      });
      logActivity({
        module: "Transcription",
        details: `Transcribed audio file: ${fileName}`,
      });
    } catch (e) {
      console.error("Error transcribing audio:", e);
      const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Transcription Failed",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCopyToClipboard = () => {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript)
      .then(() => toast({ title: "Success", description: "Transcript copied to clipboard!" }))
      .catch(() => toast({ variant: "destructive", title: "Error", description: "Failed to copy transcript." }));
  };
  
  const handleDownloadTxt = () => {
    if (!transcript || !fileName) return;
    try {
      const txtFilename = fileName.substring(0, fileName.lastIndexOf('.')) + "_transcript.txt" || "transcript.txt";
      exportToTxt(txtFilename, transcript);
      toast({ title: "Success", description: "Transcript TXT downloaded." });
    } catch (error) {
       toast({ variant: "destructive", title: "Error", description: "Failed to download TXT." });
    }
  };


  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Audio Transcription" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-8">
        <Card className="w-full max-w-lg shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Transcribe Audio File</CardTitle>
            <CardDescription>Upload an audio file to get its text transcript.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="audio-upload">Audio File</Label>
              <Input 
                id="audio-upload" 
                type="file" 
                accept={ALLOWED_AUDIO_TYPES.join(",")} 
                onChange={handleFileChange}
                className="pt-1.5"
              />
              {fileName && <p className="text-sm text-muted-foreground mt-1">Selected: {fileName}</p>}
              <p className="text-xs text-muted-foreground">
                Supported: MP3, WAV, M4A, OGG, etc. (Max 15MB)
              </p>
            </div>
            {error && !isLoading && ( // Show file validation errors immediately
              <Alert variant="destructive" className="mt-4">
                <Terminal className="h-4 w-4" />
                <AlertTitle>File Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button onClick={handleTranscribe} disabled={isLoading || !audioFile || !!error} className="w-full">
              {isLoading ? "Transcribing..." : "Transcribe Audio"}
            </Button>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="flex flex-col items-center gap-2">
            <LoadingSpinner size={32} />
            <p className="text-muted-foreground">Processing audio...</p>
          </div>
        )}

        {error && isLoading && ( // Show errors that occur during transcription process
          <Alert variant="destructive" className="mt-8 max-w-lg">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Transcription Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {transcript && !isLoading && (
          <Card className="w-full max-w-2xl shadow-xl">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl text-primary">Transcription Result</CardTitle>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopyToClipboard}>
                        <Copy className="mr-2 h-4 w-4" /> Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownloadTxt}>
                        <Download className="mr-2 h-4 w-4" /> Download TXT
                    </Button>
                </div>
              </div>
              {fileName && <CardDescription>Transcript for: {fileName}</CardDescription>}
            </CardHeader>
            <CardContent>
              <Textarea
                value={transcript}
                readOnly
                className="min-h-[300px] text-sm bg-muted/20"
                aria-label="Transcription text"
              />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
