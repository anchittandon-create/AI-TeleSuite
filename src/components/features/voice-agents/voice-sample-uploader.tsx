
"use client";

import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UploadCloud, FileAudio, XCircle, CheckCircle, Info, Loader2, Mic, Square, Radio } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { VoiceProfile } from '@/types';

interface VoiceSampleUploaderProps {
  onVoiceProfileCreated: (profile: VoiceProfile) => void; 
  isLoading?: boolean; 
}

const MAX_SAMPLE_DURATION_SECONDS = 30; 

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


  useEffect(() => {
    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const validateAudioDuration = async (audioFile: File): Promise<boolean> => {
    return new Promise((resolve) => {
        const audioUrl = URL.createObjectURL(audioFile);
        const tempAudio = document.createElement('audio');
        tempAudio.onloadedmetadata = () => {
            URL.revokeObjectURL(audioUrl);
            if (tempAudio.duration > MAX_SAMPLE_DURATION_SECONDS) {
                setFileError(`Audio duration (${tempAudio.duration.toFixed(1)}s) exceeds the ${MAX_SAMPLE_DURATION_SECONDS}-second limit for samples.`);
                resolve(false);
            } else if (tempAudio.duration < 1) { // Also check for very short files
                setFileError(`Audio duration (${tempAudio.duration.toFixed(1)}s) is too short. Sample should be at least 1 second.`);
                resolve(false);
            }
            else {
                resolve(true);
            }
        };
        tempAudio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            setFileError("Could not read audio file metadata to check duration. Please ensure it's a valid audio file and not corrupted.");
            resolve(false);
        };
        tempAudio.src = audioUrl;
    });
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setSelectedFile(null);
    if (audioPreviewRef.current) audioPreviewRef.current.src = "";
    
    if (isRecording) handleStopRecording();

    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("audio/")) {
        setFileError("Invalid file type. Please upload an audio file (e.g., MP3, WAV, M4A, OGG).");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      const isValidDuration = await validateAudioDuration(file);
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

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      let mimeTypeToTry = 'audio/mpeg'; // Prefer MP3
      if (!MediaRecorder.isTypeSupported(mimeTypeToTry)) {
        mimeTypeToTry = 'audio/webm;codecs=opus'; // Fallback to WebM Opus
        if (!MediaRecorder.isTypeSupported(mimeTypeToTry)) {
            mimeTypeToTry = 'audio/ogg;codecs=opus'; // Another fallback
            if (!MediaRecorder.isTypeSupported(mimeTypeToTry)) {
                 mimeTypeToTry = ''; // Browser default
            }
        }
      }
      const options = mimeTypeToTry ? { mimeType: mimeTypeToTry } : {};
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const finalMimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: finalMimeType });
        
        let extension = 'webm';
        if (finalMimeType.includes('mpeg')) extension = 'mp3';
        else if (finalMimeType.includes('ogg')) extension = 'ogg';
        
        const fileName = `recorded_sample_${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
        const newAudioFile = new File([audioBlob], fileName, { type: finalMimeType });
        
        audioChunksRef.current = []; 

        const isValidDuration = await validateAudioDuration(newAudioFile);
        if (isValidDuration) {
            setSelectedFile(newAudioFile);
            if (audioPreviewRef.current) {
                audioPreviewRef.current.src = URL.createObjectURL(newAudioFile);
            }
        } else {
            setSelectedFile(null); 
            if (audioPreviewRef.current) audioPreviewRef.current.src = "";
        }
        audioStreamRef.current?.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      };

      recorder.start();
      setIsRecording(true);
      toast({title: "Recording Started", description: `Speak for up to ${MAX_SAMPLE_DURATION_SECONDS}s. Click "Stop Recording" when done.`});
    } catch (err) {
      console.error("Error starting recording:", err);
      setFileError("Could not start recording. Please ensure microphone access is allowed in your browser settings and that your microphone is connected.");
      setIsRecording(false);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop(); 
    }
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
      title: "Voice Profile Created (Simulated)",
      description: `Profile "${newProfile.name}" is ready. Actual voice output will be standard TTS quality.`,
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
          Upload or Record Voice Sample for AI
        </CardTitle>
        <CardDescription>
          Provide a short audio sample (any common audio format, 1-{MAX_SAMPLE_DURATION_SECONDS}s duration). 
          The system will simulate creating a voice profile based on this sample.
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
                <Label>{isRecording ? "Recording Controls" : "Or Record Directly"}</Label>
                <Button 
                    onClick={isRecording ? handleStopRecording : handleStartRecording} 
                    variant={isRecording ? "destructive" : "outline"} 
                    className="w-full"
                    disabled={loading}
                >
                    {isRecording ? (
                        <><Square className="mr-2 h-4 w-4 fill-current"/> Stop Recording</>
                    ) : (
                        <><Mic className="mr-2 h-4 w-4"/> Record Sample (1-{MAX_SAMPLE_DURATION_SECONDS}s)</>
                    )}
                </Button>
            </div>
        </div>
         {isRecording && (
            <Alert variant="default" className="bg-red-50 border-red-200 text-red-700">
                <Radio className="h-4 w-4 text-red-600 animate-pulse" />
                <AlertTitle>Recording In Progress...</AlertTitle>
                <AlertDescription>
                    Speak clearly. Click "Stop Recording" when done or after {MAX_SAMPLE_DURATION_SECONDS}s.
                </AlertDescription>
            </Alert>
        )}


        {fileError && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Sample Error</AlertTitle>
            <AlertDescription>{fileError}</AlertDescription>
          </Alert>
        )}

        {selectedFile && !fileError && (
          <Alert variant="default" className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-700">Audio Sample Ready: {selectedFile.name}</AlertTitle>
            <AlertDescription className="text-green-600 text-xs">
              Type: {selectedFile.type || "N/A"}, Size: {(selectedFile.size / (1024)).toFixed(1)} KB. Ready for (simulated) profile creation.
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
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Simulating Profile Creation...</>
          ) : (
            <><FileAudio className="mr-2 h-4 w-4" /> Create Voice Profile from Sample</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
