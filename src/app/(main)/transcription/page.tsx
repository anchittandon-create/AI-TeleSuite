"use client";

import { useState, ChangeEvent, useId, useRef, useEffect } from 'react';
import { scoreCall } from '@/ai/flows/call-scoring';
import type { ScoreCallInput, ScoreCallOutput } from '@/ai/flows/call-scoring';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, UploadCloud, InfoIcon, Mic, ListChecks } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { fileToDataUrl } from '@/lib/file-utils';
import { CallScoringResultsTable, ScoredCallResultItem } from '@/components/features/call-scoring/call-scoring-results-table';
import { CallScoringResultsCard } from '@/components/features/call-scoring/call-scoring-results-card';
import type { ActivityLogEntry, Product, PRODUCTS } from '@/types';

const MAX_AUDIO_FILE_SIZE = 100 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a", "audio/ogg", "audio/webm", "audio/aac", "audio/flac"
];

export default function TranscriptionAndAnalysisPage() {
  const [results, setResults] = useState<ScoredCallResultItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(undefined);
  const [processedFileCount, setProcessedFileCount] = useState(0);
  
  const { toast } = useToast();
  const { logBatchActivities } = useActivityLogger();
  const uniqueId = useId();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setResults(null);
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
          setError(`File "${file.name}" has an unsupported audio type.`);
          fileErrorFound = true;
          break;
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
    if (!selectedProduct) {
      setError("Please select a Product Focus for analysis.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setResults(null);
    setProcessedFileCount(0);

    const allResults: ScoredCallResultItem[] = [];
    const activitiesToLog: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>[] = [];
    let currentFileIndex = 0;

    for (const audioFile of audioFiles) {
      currentFileIndex++;
      setProcessedFileCount(currentFileIndex);
      let audioDataUri = "";
      try {
        audioDataUri = await fileToDataUrl(audioFile);
        const input: ScoreCallInput = { audioDataUri, product: selectedProduct };
        const scoreOutput = await scoreCall(input);

        let resultItemError: string | undefined = undefined;
        if (scoreOutput.callCategorisation === "Error" || scoreOutput.transcriptAccuracy === "Error" || (scoreOutput.transcript && scoreOutput.transcript.startsWith("[") && scoreOutput.transcript.toLowerCase().includes("error"))) {
            resultItemError = scoreOutput.summary || `Analysis failed for ${audioFile.name}.`;
        }

        const resultItem: ScoredCallResultItem = {
          id: `${uniqueId}-${audioFile.name}-${currentFileIndex}`,
          fileName: audioFile.name,
          audioDataUri: audioDataUri,
          ...scoreOutput,
          error: resultItemError,
        };
        allResults.push(resultItem);

        activitiesToLog.push({
          module: "Call Scoring", // Log as Call Scoring for dashboard consistency
          product: selectedProduct,
          details: {
            fileName: audioFile.name,
            scoreOutput: scoreOutput,
            error: resultItemError,
          }
        });

      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
        const errorScoreOutput: ScoreCallOutput = {
            transcript: `[Critical Error processing file: ${errorMessage}]`,
            transcriptAccuracy: "Error",
            overallScore: 0,
            callCategorisation: "Error",
            metricScores: [],
            summary: errorMessage,
            strengths: [],
            areasForImprovement: ["Resolve system error."],
        };
        allResults.push({
          id: `${uniqueId}-${audioFile.name}-${currentFileIndex}`,
          fileName: audioFile.name,
          audioDataUri: audioDataUri,
          ...errorScoreOutput,
          error: errorMessage,
        });
        activitiesToLog.push({
          module: "Call Scoring",
          product: selectedProduct,
          details: {
            fileName: audioFile.name,
            error: errorMessage,
            scoreOutput: errorScoreOutput,
          }
        });
        toast({
          variant: "destructive",
          title: `Analysis Failed for ${audioFile.name}`,
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
            title: "Analysis Complete!",
            description: `Successfully analyzed ${allResults.length} file(s).`,
        });
    }
  };
  
  const singleResult = results && results.length === 1 ? results[0] : null;

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Transcription &amp; Call Analysis" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-8">
        <Card className="w-full max-w-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><UploadCloud className="mr-2 h-6 w-6 text-primary"/> Analyze Call Recording(s)</CardTitle>
            <CardDescription>Upload audio files to receive a full analysis, including transcription and performance scoring.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="product-select">Product Focus <span className="text-destructive">*</span></Label>
              <Select value={selectedProduct} onValueChange={(value) => setSelectedProduct(value as Product)}>
                <SelectTrigger id="product-select">
                  <SelectValue placeholder="Select product (ET / TOI)" />
                </SelectTrigger>
                <SelectContent>
                  {(["ET", "TOI"] as const).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
                <AlertDescription>Longer audio may take more time. Shorter files process faster.</AlertDescription>
            </Alert>
            {error && !isLoading && (
              <Alert variant="destructive" className="mt-4"><Terminal className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
            )}
            <Button
              onClick={handleAnalyze}
              disabled={isLoading || audioFiles.length === 0 || !!error || !selectedProduct}
              className="w-full"
            >
              {isLoading ? `Analyzing (${processedFileCount}/${audioFiles.length})...` : `Analyze ${audioFiles.length > 0 ? audioFiles.length : ''} Call(s)`}
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
            singleResult ? (
                <CallScoringResultsCard results={singleResult} fileName={singleResult.fileName} audioDataUri={singleResult.audioDataUri} />
            ) : (
                <CallScoringResultsTable results={results} />
            )
        )}
      </main>
    </div>
  );
}
