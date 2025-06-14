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
    mediaRecorderRef.current = null;
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setRecordingTime(0);
    setIsRecording(false);
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
      tempAudio.onloadedmetadata = () => {
        URL.revokeObjectURL(audioUrl);
        const duration = tempAudio.duration;
        if (duration > MAX_SAMPLE_DURATION_SECONDS) {
          setFileError(`Audio duration (${duration.toFixed(1)}s) exceeds ${MAX_SAMPLE_DURATION_SECONDS}s.`);
          resolve(false);
        } else if (duration < MIN_SAMPLE_DURATION_SECONDS) {
          setFileError(`Audio duration (${duration.toFixed(1)}s) is too short. Min ${MIN_SAMPLE_DURATION_SECONDS}s required.`);
          resolve(false);
        } else {
          resolve(true);
        }
      };
      tempAudio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        setFileError("Could not read audio file metadata for duration check. Ensure it's a valid, non-corrupted audio file.");
        resolve(false);
      };
      tempAudio.src = audioUrl;
    });
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setSelectedFile(null);
    if (audioPreviewRef.current) audioPreviewRef.current.src = "";
    stopMediaStream();

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

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setFileError("Media PUMAs (getUserMedia) not supported on this browser. Try a different browser or upload a file.");
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
        // If common types not supported, try with no specific mimeType (browser default)
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
        const finalMimeType = mediaRecorderRef.current?.mimeType || 'audio/webm'; // Default to webm if somehow not set
        const audioBlob = new Blob(audioChunksRef.current, { type: finalMimeType });
        
        let extension = 'webm'; // Default extension
        if (finalMimeType.includes('mpeg')) extension = 'mp3';
        else if (finalMimeType.includes('ogg')) extension = 'ogg';
        else if (finalMimeType.includes('mp4')) extension = 'mp4';
        else if (finalMimeType.includes('wav')) extension = 'wav';
        
        const fileName = `recorded_sample_${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
        const newAudioFile = new File([audioBlob], fileName, { type: finalMimeType });
        
        audioChunksRef.current = []; 

        setInternalLoading(true);
        const isValidDuration = await validateAudioDuration(newAudioFile);
        setInternalLoading(false);

        if (isValidDuration) {
          setSelectedFile(newAudioFile);
          if (audioPreviewRef.current) {
            audioPreviewRef.current.src = URL.createObjectURL(newAudioFile);
          }
        } else {
          setSelectedFile(null); 
          if (audioPreviewRef.current) audioPreviewRef.current.src = "";
        }
        stopMediaStream(); // Also stops the tracks
      };
      
      recorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        setFileError(`Recording error: ${(event as any)?.error?.name || 'Unknown error'}. Please try again or upload a file.`);
        stopMediaStream();
      };

      recorder.start();
      setIsRecording(true);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prevTime => {
            const newTime = prevTime + 1;
            if (newTime >= MAX_SAMPLE_DURATION_SECONDS) {
                handleStopRecording(); // Auto-stop
            }
            return newTime;
        });
      }, 1000);
      toast({title: "Recording Started", description: `Speak for ${MIN_SAMPLE_DURATION_SECONDS} to ${MAX_SAMPLE_DURATION_SECONDS}s. Click "Stop Recording" or it will auto-stop.`});
    } catch (err) {
      console.error("Error starting recording (getUserMedia):", err);
      setFileError("Could not start recording. Ensure microphone access is allowed. Check browser console for details.");
      setIsRecording(false);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop(); 
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    //Tracks are stopped in recorder.onstop or stopMediaStream
    setIsRecording(false);
  };

  const handleCloneVoice = async () => {
    if (!selectedFile) {
      toast({ variant: "destructive", title: "No Sample", description: "Please select or record a voice sample first." });
      return;
    }
    setInternalLoading(true);
    setFileError(null);
    
    // Simulate processing time
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
      description: `Profile "${newProfile.name}" registered. Note: True voice cloning is not implemented; a standard TTS voice will be used.`,
    });
    
    setSelectedFile(null); 
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (audioPreviewRef.current) audioPreviewRef.current.src = "";
    setInternalLoading(false);
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
          {loading ? (
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

