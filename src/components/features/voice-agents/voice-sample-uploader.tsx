
"use client";

import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UploadCloud, FileAudio, XCircle, CheckCircle, Info, Loader2, Mic, Square, Radio, AlertTriangleIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { VoiceProfile } from '@/types';

interface VoiceSampleUploaderProps {
  onVoiceProfileCreated: (profile: VoiceProfile) => void;
  isLoading?: boolean;
}

const MAX_SAMPLE_DURATION_SECONDS = 30;
const MIN_SAMPLE_DURATION_SECONDS = 1;

export function VoiceSampleUploader({ onVoiceProfileCreated, isLoading: isExternallyLoading }: VoiceSampleUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);


  const stopMediaStream = () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null; // Ensure it's cleared
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    // setRecordingTime(0); // Reset time when stream fully stops
    // setIsRecording(false); // Reset recording state
  };

  useEffect(() => {
    return () => {
      stopMediaStream(); // Cleanup on unmount
    };
  }, []);

  const validateAudioDuration = async (audioFile: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const audioUrl = URL.createObjectURL(audioFile);
      const tempAudio = document.createElement('audio');
      
      const cleanupAndResolve = (isValid: boolean) => {
        URL.revokeObjectURL(audioUrl);
        tempAudio.onloadedmetadata = null; // Remove listeners
        tempAudio.onerror = null;
        resolve(isValid);
      };

      tempAudio.onloadedmetadata = () => {
        const duration = tempAudio.duration;
        if (isNaN(duration) || !isFinite(duration)) {
          const errorMsg = `Could not determine duration for '${audioFile.name}'. The file might be corrupted or in an unsupported format for duration check.`;
          setFileError(errorMsg);
          toast({ variant: "destructive", title: "Recording Processing Error", description: `Could not determine duration for the recorded sample. It may be corrupted. Please try again or upload a file.` });
          cleanupAndResolve(false);
          return;
        }
        if (duration > MAX_SAMPLE_DURATION_SECONDS) {
          const errorMsg = `Audio duration (${duration.toFixed(1)}s) exceeds ${MAX_SAMPLE_DURATION_SECONDS}s limit. Recorded sample too long.`;
          setFileError(errorMsg);
          toast({ variant: "destructive", title: "Recording Too Long", description: `Sample is ${duration.toFixed(1)}s, max is ${MAX_SAMPLE_DURATION_SECONDS}s. Please record a shorter sample.` });
          cleanupAndResolve(false);
        } else if (duration < MIN_SAMPLE_DURATION_SECONDS) {
          const errorMsg = `Audio duration (${duration.toFixed(1)}s) is too short. Min ${MIN_SAMPLE_DURATION_SECONDS}s required. Recorded sample too short.`;
          setFileError(errorMsg);
          toast({ variant: "destructive", title: "Recording Too Short", description: `Sample is ${duration.toFixed(1)}s, min is ${MIN_SAMPLE_DURATION_SECONDS}s. Please record a longer sample.` });
          cleanupAndResolve(false);
        } else {
          setFileError(null); // Clear previous errors if valid
          cleanupAndResolve(true);
        }
      };
      tempAudio.onerror = (e) => {
        let errorDetails = "Unknown error during metadata read.";
        if (tempAudio.error) {
            errorDetails = `Error code: ${tempAudio.error.code || 'N/A'}, message: ${tempAudio.error.message || 'No specific message'}`;
        }
        console.error("Audio metadata validation error:", e, tempAudio.error);
        const errorMsg = `Could not read metadata from '${audioFile.name}'. It might be corrupted or an unsupported format. Details: ${errorDetails}. Try a standard format like MP3/WAV for uploads if recording fails.`;
        setFileError(errorMsg);
        toast({ variant: "destructive", title: "Recording Processing Error", description: `Could not read metadata from the recorded sample. It might be corrupted. Please try again or upload a file.` });
        cleanupAndResolve(false);
      };
      tempAudio.src = audioUrl;
      tempAudio.load(); // Explicitly load to trigger metadata
    });
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setSelectedFile(null);
    if (audioPreviewRef.current) audioPreviewRef.current.src = "";
    stopMediaStream(); // Stop any active recording
    setIsRecording(false); // Ensure recording state is false
    setRecordingTime(0); // Reset timer


    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("audio/")) {
        setFileError("Invalid file type. Please upload an audio file (e.g., MP3, WAV, M4A, OGG, WEBM).");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setInternalLoading(true);
      const isValidDuration = await validateAudioDuration(file);
      setInternalLoading(false);
      if (isValidDuration) {
        setSelectedFile(file);
        if (audioPreviewRef.current) {
          audioPreviewRef.current.src = URL.createObjectURL(file);
          audioPreviewRef.current.load();
        }
      } else {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  const handleStartRecording = async () => {
    setFileError(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (audioPreviewRef.current) audioPreviewRef.current.src = "";
    audioChunksRef.current = [];
    setRecordingTime(0);
    setInternalLoading(true); // Loading while setting up

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setFileError("Media PUMAs (getUserMedia) not supported on this browser. Try a different browser or upload a file.");
        setInternalLoading(false);
        return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      const MimeTypesToTry = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/mpeg', 'audio/wav'];
      let supportedMimeType = '';
      for (const mimeType of MimeTypesToTry) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          supportedMimeType = mimeType;
          break;
        }
      }
      if (!supportedMimeType) {
        console.warn("Preferred MIME types not supported, using browser default for MediaRecorder.");
      }

      const options = supportedMimeType ? { mimeType: supportedMimeType } : {};
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        // Note: setInternalLoading(true) will be set just before validateAudioDuration
        // and setInternalLoading(false) after it.
        if (audioChunksRef.current.length === 0) {
            console.warn("Recording stopped but no audio data chunks were received. Possibly too short or an issue with MediaRecorder.");
            setFileError("No audio data was captured during recording. It might have been too short. Please try again.");
            setIsRecording(false);
            if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
            setRecordingTime(0);
            stopMediaStream(); // Ensure stream is released
            setInternalLoading(false); // Ensure loading is false if no chunks
            return;
        }

        setInternalLoading(true); // Indicate processing of recorded data

        const finalMimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: finalMimeType });
        
        let extension = 'webm';
        if (finalMimeType.includes('mpeg')) extension = 'mp3';
        else if (finalMimeType.includes('ogg')) extension = 'ogg';
        else if (finalMimeType.includes('mp4')) extension = 'm4a';
        else if (finalMimeType.includes('wav')) extension = 'wav';
        
        const fileName = `recorded_sample_${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
        const newAudioFile = new File([audioBlob], fileName, { type: finalMimeType });
        
        audioChunksRef.current = []; 

        const isValidDuration = await validateAudioDuration(newAudioFile);
        
        if (isValidDuration) {
          setSelectedFile(newAudioFile);
          if (audioPreviewRef.current) {
            audioPreviewRef.current.src = URL.createObjectURL(newAudioFile);
            audioPreviewRef.current.load();
          }
          setFileError(null); 
        } else {
          setSelectedFile(null); 
          if (audioPreviewRef.current) audioPreviewRef.current.src = "";
        }
        
        setIsRecording(false);
        if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
        }
        setRecordingTime(0);
        stopMediaStream(); // Final cleanup of stream after processing
        setInternalLoading(false); // Processing done
      };
      
      recorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        setFileError(`Recording error: ${(event as any)?.error?.name || 'Unknown error'}. Please try again or upload a file.`);
        setIsRecording(false);
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        setRecordingTime(0);
        stopMediaStream();
        setInternalLoading(false);
      };

      recorder.start();
      setIsRecording(true);
      setInternalLoading(false); // Setup done, now actually recording
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prevTime => {
            const newTime = prevTime + 1;
            if (newTime >= MAX_SAMPLE_DURATION_SECONDS) {
                handleStopRecording(); 
            }
            return newTime;
        });
      }, 1000);
      toast({title: "Recording Started", description: `Speak for ${MIN_SAMPLE_DURATION_SECONDS} to ${MAX_SAMPLE_DURATION_SECONDS}s. Click "Stop Recording" or it will auto-stop.`});
    } catch (err) {
      console.error("Error starting recording (getUserMedia):", err);
      setFileError("Could not start recording. Ensure microphone access is allowed. Check browser console for details.");
      setIsRecording(false);
      stopMediaStream(); // Clean up if start fails
      setInternalLoading(false);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop(); // This will trigger the onstop event
    }
    // Other cleanup (like interval, isRecording state) is handled in onstop
    // or if stop is called when not actively recording.
    if (!isRecording) { // If somehow stop is called when not recording
        stopMediaStream();
        setRecordingTime(0);
    }
  };

  const handleCloneVoice = async () => {
    if (!selectedFile) {
      toast({ variant: "destructive", title: "No Sample", description: "Please select or record a voice sample first." });
      return;
    }
    setInternalLoading(true);
    setFileError(null);
    
    try {
        // Simulate API call for profile creation
        await new Promise(resolve => setTimeout(resolve, 1500)); 

        const newProfile: VoiceProfile = {
            id: `vpf_${Date.now().toString(36)}_${selectedFile.name.substring(0,5).replace(/[^a-z0-9]/gi, '')}`,
            name: `Voice Profile (Sample: ${selectedFile.name.substring(0, 15)}${selectedFile.name.length > 15 ? '...' : ''})`,
            sampleFileName: selectedFile.name,
            createdAt: new Date().toISOString(),
        };

        onVoiceProfileCreated(newProfile);
        toast({
            title: "Voice Profile ID Created",
            description: `Profile ID based on "${newProfile.sampleFileName}" registered. Actual output uses standard TTS.`,
        });
        
        setSelectedFile(null); 
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (audioPreviewRef.current) audioPreviewRef.current.src = "";
    } catch (apiError: any) {
        console.error("Error during (simulated) voice profile creation:", apiError);
        setFileError(`Error processing sample: ${apiError.message || 'Unknown error'}`);
        toast({ variant: "destructive", title: "Processing Error", description: "Could not process the voice sample."});
    } finally {
        setInternalLoading(false);
    }
  };

  const loading = isExternallyLoading || internalLoading;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <UploadCloud className="mr-2 h-5 w-5 text-primary" />
          Provide AI Voice Sample
        </CardTitle>
        <CardDescription>
          Upload an audio file or record directly (any common audio format, {MIN_SAMPLE_DURATION_SECONDS}-{MAX_SAMPLE_DURATION_SECONDS}s duration).
          A Voice Profile ID will be generated.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="space-y-1">
                <Label htmlFor="voice-sample-upload">Upload Audio File</Label>
                <Input
                    id="voice-sample-upload"
                    type="file"
                    accept="audio/*" 
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    disabled={loading || isRecording}
                    className="pt-1.5"
                />
            </div>
            <div className="space-y-1">
                <Label>{isRecording ? `Recording Time: ${recordingTime}s / ${MAX_SAMPLE_DURATION_SECONDS}s` : "Or Record Directly"}</Label>
                <Button 
                    onClick={isRecording ? handleStopRecording : handleStartRecording} 
                    variant={isRecording ? "destructive" : "outline"} 
                    className="w-full"
                    disabled={loading}
                >
                    {isRecording ? (
                        <><Square className="mr-2 h-4 w-4 fill-current"/> Stop Recording</>
                    ) : (
                        <><Mic className="mr-2 h-4 w-4"/> Record Sample</>
                    )}
                </Button>
            </div>
        </div>
         {isRecording && (
            <Alert variant="default" className="bg-red-50 border-red-200 text-red-700">
                <Radio className="h-4 w-4 text-red-600 animate-pulse" />
                <AlertTitle>Recording In Progress... ({recordingTime}s)</AlertTitle>
                <AlertDescription>
                    Speak clearly. Click "Stop Recording" or it will auto-stop at {MAX_SAMPLE_DURATION_SECONDS}s.
                </AlertDescription>
            </Alert>
        )}

        {fileError && (
          <Alert variant="destructive">
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertTitle>Sample Error</AlertTitle>
            <AlertDescription>{fileError}</AlertDescription>
          </Alert>
        )}

        {selectedFile && !fileError && (
          <Alert variant="default" className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-700">Audio Sample Ready: {selectedFile.name}</AlertTitle>
            <AlertDescription className="text-green-600 text-xs">
              Type: {selectedFile.type || "N/A"}, Size: {(selectedFile.size / (1024)).toFixed(1)} KB.
            </AlertDescription>
             <audio ref={audioPreviewRef} controls className="mt-2 w-full h-10" />
          </Alert>
        )}
        
        <Button
          onClick={handleCloneVoice}
          disabled={!selectedFile || !!fileError || loading || isRecording}
          className="w-full"
        >
          {loading && !isRecording ? ( // Show "Processing Sample" only if not actively recording
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing Sample...</>
          ) : (
            <><FileAudio className="mr-2 h-4 w-4" /> Use this Sample</>
          )}
        </Button>
         <Alert variant="default" className="mt-2 text-xs">
            <Info className="h-4 w-4" />
            <AlertTitle className="font-semibold">Important Note on Voice Output</AlertTitle>
            <AlertDescription>
                This feature allows you to provide a voice sample for concept demonstration. The actual AI voice output in conversations will use a standard, high-quality Text-to-Speech (TTS) voice. True dynamic voice cloning to match the sample's characteristics is not implemented in this version.
            </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

