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
const MIN_SAMPLE_DURATION_SECONDS = 1; // Minimum duration for a sample to be considered valid

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
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn("Error stopping media recorder (already stopped or invalid state):", e);
      }
    }
    mediaRecorderRef.current = null; 
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
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
      
      const cleanupAndResolve = (isValid: boolean, message?: string) => {
        URL.revokeObjectURL(audioUrl);
        tempAudio.onloadedmetadata = null;
        tempAudio.onerror = null;
        tempAudio.remove(); // Ensure element is removed from DOM if it was appended
        if (message) {
            setFileError(message);
            toast({ variant: "destructive", title: "Sample Validation Error", description: message });
        }
        resolve(isValid);
      };

      tempAudio.onloadedmetadata = () => {
        const duration = tempAudio.duration;
        if (isNaN(duration) || !isFinite(duration)) {
          cleanupAndResolve(false, `Could not determine duration for '${audioFile.name}'. The file might be corrupted or in an unsupported format for duration check. Please try a different file or recording.`);
          return;
        }
        if (duration > MAX_SAMPLE_DURATION_SECONDS) {
          cleanupAndResolve(false, `Audio duration (${duration.toFixed(1)}s) exceeds ${MAX_SAMPLE_DURATION_SECONDS}s limit. Sample: '${audioFile.name}'. Please provide a shorter sample.`);
        } else if (duration < MIN_SAMPLE_DURATION_SECONDS) {
          cleanupAndResolve(false, `Audio duration (${duration.toFixed(1)}s) is too short. Min ${MIN_SAMPLE_DURATION_SECONDS}s required. Sample: '${audioFile.name}'. Please provide a longer sample.`);
        } else {
          setFileError(null); 
          cleanupAndResolve(true);
        }
      };
      tempAudio.onerror = (e) => {
        let errorDetails = "Unknown error during metadata read.";
        if (tempAudio.error) {
            errorDetails = `Error code: ${tempAudio.error.code || 'N/A'}, message: ${tempAudio.error.message || 'No specific message'}`;
        }
        console.error("Audio metadata validation error:", e, tempAudio.error);
        cleanupAndResolve(false, `Could not read metadata from '${audioFile.name}'. It might be corrupted or an unsupported format. Details: ${errorDetails}. Try a standard format like MP3/WAV for uploads if recording fails.`);
      };
      tempAudio.preload = "metadata"; // Important for some browsers
      tempAudio.src = audioUrl;
      tempAudio.load();
    });
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setSelectedFile(null);
    if (audioPreviewRef.current) audioPreviewRef.current.src = "";
    stopMediaStream(); 
    setIsRecording(false); 
    setRecordingTime(0); 


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
        if (fileInputRef.current) fileInputRef.current.value = ""; // Clear input if validation failed
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
    setInternalLoading(true);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setFileError("Media API (getUserMedia) not supported on this browser. Please use a modern browser or upload a file.");
        setInternalLoading(false);
        return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      const MimeTypesToTry = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/mpeg', 'audio/wav'];
      let supportedMimeType = MimeTypesToTry.find(type => MediaRecorder.isTypeSupported(type)) || '';
      
      if (!supportedMimeType) {
        console.warn("Preferred MIME types not supported by MediaRecorder, using browser default.");
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
        setIsRecording(false); // Set recording state immediately on stop
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        setRecordingTime(0); // Reset timer
        
        if (audioChunksRef.current.length === 0) {
            console.warn("Recording stopped but no audio data chunks were received.");
            setFileError("No audio data captured. Recording might have been too short or an issue occurred. Please try again.");
            stopMediaStream();
            setInternalLoading(false);
            return;
        }

        setInternalLoading(true); 

        const finalMimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: finalMimeType });
        
        let extension = finalMimeType.split('/')[1]?.split(';')[0] || 'webm';
        if (extension === 'mpeg') extension = 'mp3'; // Common case
        else if (extension === 'x-m4a') extension = 'm4a';

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
        
        stopMediaStream(); 
        setInternalLoading(false);
      };
      
      recorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        const errorName = (event as any)?.error?.name || 'Unknown MediaRecorder Error';
        setFileError(`Recording error: ${errorName}. Ensure microphone permissions. Try again or upload a file.`);
        setIsRecording(false);
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        setRecordingTime(0);
        stopMediaStream();
        setInternalLoading(false);
      };

      recorder.start();
      setIsRecording(true);
      setInternalLoading(false); 
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prevTime => {
            const newTime = prevTime + 1;
            if (newTime >= MAX_SAMPLE_DURATION_SECONDS) {
                handleStopRecording(); 
            }
            return newTime;
        });
      }, 1000);
      toast({title: "Recording Started", description: `Speak for ${MIN_SAMPLE_DURATION_SECONDS}-${MAX_SAMPLE_DURATION_SECONDS}s. Auto-stops or click "Stop".`});
    } catch (err: any) {
      console.error("Error starting recording (getUserMedia):", err);
      let errMsg = "Could not start recording. Ensure microphone access is allowed.";
      if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errMsg = "No microphone found or access denied. Please check your microphone and browser permissions.";
      } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errMsg = "Microphone access was denied. Please enable it in your browser settings for this site.";
      }
      setFileError(errMsg);
      setIsRecording(false);
      stopMediaStream();
      setInternalLoading(false);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop(); // This will trigger the onstop event
    } else {
      // If stop is called when not actively recording, ensure cleanup
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      setRecordingTime(0);
      stopMediaStream();
    }
  };

  const handleCreateProfileId = async () => {
    if (!selectedFile) {
      toast({ variant: "destructive", title: "No Sample", description: "Please select or record a valid voice sample first." });
      return;
    }
    setInternalLoading(true);
    setFileError(null);
    
    try {
        // Simulate API call for profile creation/ID generation
        await new Promise(resolve => setTimeout(resolve, 1200)); 

        const newProfile: VoiceProfile = {
            id: `vpf_sim_${Date.now().toString(36)}_${selectedFile.name.substring(0,5).replace(/[^a-z0-9]/gi, '')}`,
            name: `Simulated Profile (Based on: ${selectedFile.name.substring(0, 15)}${selectedFile.name.length > 15 ? '...' : ''})`,
            sampleFileName: selectedFile.name,
            createdAt: new Date().toISOString(),
        };

        onVoiceProfileCreated(newProfile);
        toast({
            title: "Simulated Voice Profile ID Created",
            description: `Profile ID "${newProfile.name}" (based on sample: ${newProfile.sampleFileName}) generated. Note: Actual voice output will use a standard TTS voice.`,
        });
        
        setSelectedFile(null); 
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (audioPreviewRef.current) { audioPreviewRef.current.src = ""; audioPreviewRef.current.load(); }
    } catch (apiError: any) {
        console.error("Error during (simulated) voice profile ID creation:", apiError);
        setFileError(`Error processing sample for profile ID: ${apiError.message || 'Unknown error'}`);
        toast({ variant: "destructive", title: "Processing Error", description: "Could not process the voice sample for profile ID generation."});
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
          Provide AI Voice Sample (Conceptual)
        </CardTitle>
        <CardDescription>
          Upload an audio file or record directly (any common audio format, {MIN_SAMPLE_DURATION_SECONDS}-{MAX_SAMPLE_DURATION_SECONDS}s duration).
          A conceptual Voice Profile ID will be generated for use in simulated TTS.
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
                <Label>{isRecording ? `Recording: ${recordingTime}s / ${MAX_SAMPLE_DURATION_SECONDS}s` : "Or Record Sample Directly"}</Label>
                <Button 
                    onClick={isRecording ? handleStopRecording : handleStartRecording} 
                    variant={isRecording ? "destructive" : "outline"} 
                    className="w-full"
                    disabled={loading && !isRecording} // Allow stopping if loading but recording
                >
                    {isRecording ? (
                        <><Square className="mr-2 h-4 w-4 fill-current"/> Stop Recording</>
                    ) : (
                        <><Mic className="mr-2 h-4 w-4"/> Record Audio Sample</>
                    )}
                </Button>
            </div>
        </div>
         {isRecording && (
            <Alert variant="default" className="bg-red-50 border-red-200 text-red-700">
                <Radio className="h-4 w-4 text-red-600 animate-pulse" />
                <AlertTitle>Recording In Progress... ({recordingTime}s)</AlertTitle>
                <AlertDescription>
                    Speak clearly. Click "Stop Recording" or it auto-stops at {MAX_SAMPLE_DURATION_SECONDS}s. Minimum duration is {MIN_SAMPLE_DURATION_SECONDS}s.
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
          onClick={handleCreateProfileId}
          disabled={!selectedFile || !!fileError || loading || isRecording}
          className="w-full"
        >
          {loading && !isRecording ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing Sample for Profile ID...</>
          ) : (
            <><FileAudio className="mr-2 h-4 w-4" /> Create Profile ID from Sample</>
          )}
        </Button>
         <Alert variant="default" className="mt-2 text-xs">
            <Info className="h-4 w-4" />
            <AlertTitle className="font-semibold">Important Note on Voice Output</AlertTitle>
            <AlertDescription>
                This feature allows you to provide a voice sample for concept demonstration and to generate a Voice Profile ID. 
                The actual AI voice output in conversations will use a **standard, simulated Text-to-Speech (TTS) voice**. 
                True dynamic voice cloning to match the sample's characteristics is not implemented. The generated profile ID is used for reference in the simulated TTS.
            </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
