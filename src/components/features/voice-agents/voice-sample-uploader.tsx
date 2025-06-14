
"use client";

import React, { useState, useRef, ChangeEvent } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UploadCloud, FileAudio, XCircle, CheckCircle, Info, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { VoiceProfile } from '@/types';

interface VoiceSampleUploaderProps {
  onVoiceProfileCreated: (profile: VoiceProfile) => void; // Callback when "cloning" is done
  isLoading?: boolean; // External loading state
}

const MAX_SAMPLE_SIZE = 5 * 1024 * 1024; // 5MB for voice sample
const ALLOWED_SAMPLE_TYPES = ["audio/mpeg", "audio/wav", "audio/mp3"]; // More restrictive for samples
const MAX_SAMPLE_DURATION_SECONDS = 30; // Max 30 seconds for the sample

export function VoiceSampleUploader({ onVoiceProfileCreated, isLoading: isExternallyLoading }: VoiceSampleUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setSelectedFile(null);
    if (audioRef.current) {
        audioRef.current.src = "";
    }

    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_SAMPLE_SIZE) {
        setFileError(`File is too large. Max size is ${MAX_SAMPLE_SIZE / (1024 * 1024)}MB.`);
        return;
      }
      if (!ALLOWED_SAMPLE_TYPES.includes(file.type)) {
        setFileError(`Invalid file type. Allowed types: MP3, WAV.`);
        return;
      }
      
      // Validate duration client-side (approximate)
      const audioUrl = URL.createObjectURL(file);
      const tempAudio = new Audio(audioUrl);
      tempAudio.onloadedmetadata = () => {
        URL.revokeObjectURL(audioUrl); // Clean up object URL
        if (tempAudio.duration > MAX_SAMPLE_DURATION_SECONDS) {
            setFileError(`Audio duration exceeds ${MAX_SAMPLE_DURATION_SECONDS} seconds. Please upload a shorter sample.`);
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        } else {
            setSelectedFile(file);
            if (audioRef.current) {
                audioRef.current.src = URL.createObjectURL(file); // For playback preview
            }
        }
      };
      tempAudio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        setFileError("Could not read audio file metadata to check duration. Please ensure it's a valid audio file.");
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
    }
  };

  const handleCloneVoice = async () => {
    if (!selectedFile) {
      toast({ variant: "destructive", title: "No File", description: "Please select a voice sample file first." });
      return;
    }
    setInternalLoading(true);
    setFileError(null);

    // **SIMULATION OF VOICE CLONING**
    // In a real application, this is where you'd send the file to a backend service
    // that handles voice cloning (e.g., Google Cloud Custom Voice API).
    // This would likely be an asynchronous process.
    
    // For this prototype, we'll simulate a delay and then create a dummy profile.
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing time

    const newProfile: VoiceProfile = {
      id: `vp_${Date.now()}_${selectedFile.name.substring(0,5)}`,
      name: `Cloned Voice (${selectedFile.name.substring(0, 15)}${selectedFile.name.length > 15 ? '...' : ''})`,
      sampleFileName: selectedFile.name,
      createdAt: new Date().toISOString(),
    };

    onVoiceProfileCreated(newProfile);
    toast({
      title: "Voice Profile Created (Simulated)",
      description: `Profile "${newProfile.name}" is ready. Actual cloning is prototyped.`,
    });
    
    setSelectedFile(null); // Clear selection after "cloning"
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (audioRef.current) audioRef.current.src = "";
    setInternalLoading(false);
  };

  const loading = isExternallyLoading || internalLoading;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <UploadCloud className="mr-2 h-5 w-5 text-primary" />
          Upload Voice Sample for Cloning (Simulated)
        </CardTitle>
        <CardDescription>
          Upload a short audio sample (MP3/WAV, max 30s, max {MAX_SAMPLE_SIZE / (1024 * 1024)}MB).
          The AI will simulate creating a voice profile based on this sample.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="voice-sample-upload">Voice Sample File</Label>
          <Input
            id="voice-sample-upload"
            type="file"
            accept={ALLOWED_SAMPLE_TYPES.join(",")}
            onChange={handleFileChange}
            ref={fileInputRef}
            disabled={loading}
            className="pt-1.5"
          />
        </div>

        {fileError && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>File Error</AlertTitle>
            <AlertDescription>{fileError}</AlertDescription>
          </Alert>
        )}

        {selectedFile && !fileError && (
          <Alert variant="default" className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-700">File Selected: {selectedFile.name}</AlertTitle>
            <AlertDescription className="text-green-600 text-xs">
              Type: {selectedFile.type}, Size: {(selectedFile.size / (1024)).toFixed(1)} KB. Ready for "cloning".
            </AlertDescription>
             <audio ref={audioRef} controls className="mt-2 w-full h-10" />
          </Alert>
        )}
        
        <Alert variant="default" className="mt-2 bg-accent/10 border-accent/20">
            <Info className="h-4 w-4 text-accent" />
            <AlertTitle className="text-accent-foreground/90">Prototyping Note</AlertTitle>
            <AlertDescription className="text-accent-foreground/80 text-xs">
              True dynamic voice cloning from a short sample is an advanced feature requiring specialized backend services. 
              This uploader simulates the process. The generated voice in the agent modules will use standard TTS voices.
            </AlertDescription>
        </Alert>

        <Button
          onClick={handleCloneVoice}
          disabled={!selectedFile || !!fileError || loading}
          className="w-full"
        >
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Simulating Cloning...</>
          ) : (
            <><FileAudio className="mr-2 h-4 w-4" /> Create Voice Profile (Simulated)</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
