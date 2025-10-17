
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { ConversationTurn as ConversationTurnComponent } from '@/components/features/voice-agents/conversation-turn';
import { Badge } from "@/components/ui/badge";

import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { useWhisper } from '@/hooks/useWhisper';
import { useProductContext } from '@/hooks/useProductContext';
import { GOOGLE_PRESET_VOICES, SAMPLE_TEXT } from '@/hooks/use-voice-samples';
import { synthesizeSpeechOnClient } from '@/lib/tts-client';
import { runVoiceSalesAgentTurn } from '@/ai/flows/voice-sales-agent-flow';
import { generateFullCallAudio } from '@/ai/flows/generate-full-call-audio';

import {
    Product, SalesPlan, CustomerCohort,
    ConversationTurn, GeneratePitchOutput,
    ScoreCallOutput, KnowledgeFile,
    VoiceSalesAgentFlowInput, VoiceSalesAgentActivityDetails, ProductObject, TranscriptionOutput
} from '@/types';

import { PhoneCall, AlertTriangle, Bot, User as UserIcon, Info, Mic, Radio, PhoneOff, Redo, Settings, Volume2, Loader2, SquareTerminal, Star, PlayCircle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PostCallReviewProps } from '@/components/features/voice-sales-agent/post-call-review';

// Dynamically import the PostCallReview component to reduce initial page load size
const PostCallReview = dynamic<PostCallReviewProps>(
  () => import('@/components/features/voice-sales-agent/post-call-review').then((mod) => mod.PostCallReview),
  {
    loading: () => (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin"/> Loading call review...
        </div>
    ),
    ssr: false
  }
);


const prepareKnowledgeBaseContext = (
  knowledgeBaseFiles: KnowledgeFile[],
  productObject: ProductObject,
  conversationHistory: ConversationTurn[],
  customerCohort?: string
): string => {
  if (!productObject) {
    return "No product information available.";
  }
    const MAX_CONTEXT_LENGTH = 30000;
    let combinedContext = `--- START OF KNOWLEDGE BASE CONTEXT FOR PRODUCT: ${productObject.displayName} ---\n`;
    combinedContext += `Brand Name: ${productObject.brandName || 'Not provided'}\n`;
    if (customerCohort) {
        combinedContext += `Target Customer Cohort: ${customerCohort}\n`;
    }
    combinedContext += "--------------------------------------------------\n\n";

    const productSpecificFiles = knowledgeBaseFiles.filter(f => f.product === productObject.name);

    const addSection = (title: string, files: KnowledgeFile[]) => {
        if (files.length > 0) {
            combinedContext += `--- ${title.toUpperCase()} ---\n`;
            files.forEach(file => {
                let itemContext = `\n--- Item: ${file.name} ---\n`;
                if (file.isTextEntry && file.textContent) {
                    itemContext += `Content:\n${file.textContent}\n`;
                } else {
                    itemContext += `(This is a reference to a ${file.type} file named '${file.name}'. The AI should infer context from its name, type, and category.)\n`;
                }
                if (combinedContext.length + itemContext.length <= MAX_CONTEXT_LENGTH) {
                    combinedContext += itemContext;
                }
            });
            combinedContext += `--- END ${title.toUpperCase()} ---\n\n`;
        }
    };

    const pitchDocs = productSpecificFiles.filter(f => f.category === 'Pitch');
    const productDescDocs = productSpecificFiles.filter(f => f.category === 'Product Description');
    const pricingDocs = productSpecificFiles.filter(f => f.category === 'Pricing');
    const rebuttalDocs = productSpecificFiles.filter(f => f.category === 'Rebuttals');
    const otherDocs = productSpecificFiles.filter(f => !f.category || !['Pitch', 'Product Description', 'Pricing', 'Rebuttals'].includes(f.category));

    addSection("PITCH STRUCTURE & FLOW CONTEXT (Prioritize for overall script structure)", pitchDocs);
    addSection("PRODUCT DETAILS & FACTS (Prioritize for benefits, features, pricing)", [...productDescDocs, ...pricingDocs]);
    addSection("COMMON OBJECTIONS & REBUTTALS", rebuttalDocs);
    addSection("GENERAL SUPPLEMENTARY CONTEXT", otherDocs);


    if (productSpecificFiles.length === 0) {
        combinedContext += "No specific knowledge base files or text entries were found for this product.\n";
    }

    if(combinedContext.length >= MAX_CONTEXT_LENGTH) {
      console.warn("Knowledge base context truncated due to length limit.");
    }

    combinedContext += `--- END OF KNOWLEDGE BASE CONTEXT ---`;
    return combinedContext.substring(0, MAX_CONTEXT_LENGTH);
};

const mapSpeakerToRole = (speaker: ConversationTurn['speaker']): 'AGENT' | 'USER' =>
  speaker === 'AI' ? 'AGENT' : 'USER';


type CallState = "IDLE" | "CONFIGURING" | "LISTENING" | "PROCESSING" | "AI_SPEAKING" | "ENDED" | "ERROR";

export default function VoiceSalesAgentPage() {
  const [callState, setCallState] = useState<CallState>("CONFIGURING");
  const callStateRef = useRef(callState);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  const [currentTranscription, setCurrentTranscription] = useState("");
  const [isClient, setIsClient] = useState(false);

  const [agentName, setAgentName] = useState<string>("");
  const [userName, setUserName] = useState<string>("");

  const { availableProducts, getProductByName } = useProductContext();
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>("ET");
  const productInfo = getProductByName(selectedProduct || "");
  const [selectedSalesPlan, setSelectedSalesPlan] = useState<SalesPlan | undefined>();
  const [selectedSpecialConfig, setSelectedSpecialConfig] = useState<string | undefined>();
  const [offerDetails, setOfferDetails] = useState<string>("");
  const [selectedCohort, setSelectedCohort] = useState<CustomerCohort | undefined>("Payment Dropoff");

  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentPitch, setCurrentPitch] = useState<GeneratePitchOutput | null>(null);

  const [finalCallArtifacts, setFinalCallArtifacts] = useState<{ transcript: string; transcriptAccuracy?: string; audioUri?: string; score?: ScoreCallOutput } | null>(null);
  const [isVoicePreviewPlaying, setIsVoicePreviewPlaying] = useState(false);
  const supportsMediaRecorder = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined';

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [isAutoEnding, setIsAutoEnding] = useState(false);
  const [activeAudioSrc, setActiveAudioSrc] = useState<string | null>(null);

  const { toast } = useToast();
  const { activities, logActivity, updateActivity } = useActivityLogger();
  const { files: allKbFiles } = useKnowledgeBase();
  const conversationEndRef = useRef<null | HTMLDivElement>(null);
  const currentActivityId = useRef<string | null>(null);

  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(GOOGLE_PRESET_VOICES[0].id);
  const isCallInProgress = callState !== 'CONFIGURING' && callState !== 'IDLE' && callState !== 'ENDED';

  const productKbFiles = useMemo(() => {
      if (!selectedProduct || !allKbFiles) return [];
      return allKbFiles.filter(f => f.product === selectedProduct);
  }, [allKbFiles, selectedProduct]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const recordingDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const agentSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const setupRecordingGraph = useCallback(async () => {
    if (!supportsMediaRecorder || !audioPlayerRef.current) {
      return;
    }
    if (!audioContextRef.current) {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextCtor();
    }
    if (audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
      } catch (err) {
        console.warn('VoiceAgent: failed to resume audio context', err);
      }
    }
    if (!recordingDestinationRef.current) {
      recordingDestinationRef.current = audioContextRef.current.createMediaStreamDestination();
    }
    if (!micStreamRef.current) {
      micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    if (micStreamRef.current && !micSourceRef.current && recordingDestinationRef.current) {
      micSourceRef.current = audioContextRef.current.createMediaStreamSource(micStreamRef.current);
      micSourceRef.current.connect(recordingDestinationRef.current);
    }
    if (!agentSourceRef.current && recordingDestinationRef.current) {
      agentSourceRef.current = audioContextRef.current.createMediaElementSource(audioPlayerRef.current);
      agentSourceRef.current.connect(audioContextRef.current.destination);
      agentSourceRef.current.connect(recordingDestinationRef.current);
    }
    if (recordingDestinationRef.current && !mediaRecorderRef.current) {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      mediaRecorderRef.current = new MediaRecorder(recordingDestinationRef.current.stream, { mimeType });
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
      recordedChunksRef.current = [];
      mediaRecorderRef.current.start(1000);
    }
  }, [supportsMediaRecorder]);

  const stopRecordingGraph = useCallback(async () => {
    if (!supportsMediaRecorder) {
      return null;
    }
    let blob: Blob | null = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      blob = await new Promise<Blob>((resolve) => {
        const recorder = mediaRecorderRef.current!;
        const handleStop = () => {
          recorder.removeEventListener('stop', handleStop);
          resolve(
            new Blob(recordedChunksRef.current, {
              type: recorder.mimeType || 'audio/webm',
            })
          );
        };
        recorder.addEventListener('stop', handleStop);
        recorder.stop();
      });
    } else if (recordedChunksRef.current.length > 0) {
      blob = new Blob(recordedChunksRef.current, {
        type: mediaRecorderRef.current?.mimeType || 'audio/webm',
      });
    }

    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    micSourceRef.current?.disconnect();
    micSourceRef.current = null;
    agentSourceRef.current?.disconnect();
    agentSourceRef.current = null;
    recordingDestinationRef.current = null;
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch (err) {
        console.warn('VoiceAgent: failed to close audio context', err);
      }
      audioContextRef.current = null;
    }
    return blob;
  }, [supportsMediaRecorder]);

  const blobToDataUri = useCallback((blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read audio recording.'));
        }
      };
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read audio recording.'));
      reader.readAsDataURL(blob);
    });
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const cancelAudio = useCallback(() => {
    audioQueueRef.current = []; // Clear the queue
    if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.removeAttribute('src');
        audioPlayerRef.current.currentTime = 0;
    }
    setActiveAudioSrc(null);
    setCurrentlyPlayingId(null);
    setCurrentWordIndex(-1);
    if (callStateRef.current === 'AI_SPEAKING') {
        setCallState('LISTENING');
    }
  }, []);

  const onTranscribe = useCallback((text: string) => {
    // This is for real-time transcription display and barge-in
    if (callStateRef.current === 'AI_SPEAKING' && text.trim().length > 0) {
      cancelAudio();
    }
    setCurrentTranscription(text);
  }, [cancelAudio]);

  const processAgentTurnRef = useRef<any>(null);

  const playAudioSafely = useCallback((audioEl: HTMLAudioElement, onError: (err: any) => void) => {
    const playPromise = audioEl.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch((err: any) => {
        if (err?.name === 'AbortError' || err?.message?.includes('The play() request was interrupted')) {
          return;
        }
        onError(err);
      });
    }
  }, []);

  const handleTurnAudioPlayback = useCallback((audioUri: string, turnId: string) => {
    if (!audioPlayerRef.current) return;
    audioQueueRef.current = [];
    setActiveAudioSrc(audioUri);
    audioPlayerRef.current.pause();
    audioPlayerRef.current.src = audioUri;
    audioPlayerRef.current.currentTime = 0;
    setCurrentWordIndex(-1);
    setCurrentlyPlayingId(turnId);
    setCallState('AI_SPEAKING');
    playAudioSafely(audioPlayerRef.current, (e) => {
      console.error('VoiceAgent: playback failed', e);
      setCallState('LISTENING');
    });
  }, [playAudioSafely]);

  const onTranscriptionComplete = useCallback(async (text: string) => {
      if (callStateRef.current !== 'LISTENING' && callStateRef.current !== 'AI_SPEAKING') return;

      const userInputText = text.trim();
      setCurrentTranscription("");

      const userTurn: ConversationTurn | null = userInputText
        ? { id: `user-${Date.now()}`, speaker: 'User', text: userInputText, timestamp: new Date().toISOString() }
        : null;

      const newConversation = userTurn ? [...conversation, userTurn] : conversation;
      if(userTurn) setConversation(newConversation);

      if (processAgentTurnRef.current) {
        processAgentTurnRef.current(newConversation, userInputText);
      }
    }, [conversation]);

  const { isRecording, startRecording, stopRecording } = useWhisper({
    onTranscriptionComplete: onTranscriptionComplete,
    onTranscribe: onTranscribe,
    silenceTimeout: 30,
    inactivityTimeout: 9000,
  });

  const synthesizeAndPlay = useCallback(async (text: string, turnId: string) => {
    const trimmed = text?.trim();
    if (!trimmed) {
      setCallState('LISTENING');
      return;
    }

    setCallState('AI_SPEAKING');

    try {
      if (supportsMediaRecorder) {
        await setupRecordingGraph();
      }

      const textToSynthesize = trimmed.replace(/\bET\b/g, 'E T');
      const synthesisResult = await synthesizeSpeechOnClient({ text: textToSynthesize, voice: selectedVoiceId });
      const audioUri = synthesisResult.audioDataUri;

      setConversation(prev =>
        prev.map(turn =>
          turn.id === turnId ? { ...turn, audioDataUri: audioUri } : turn
        )
      );

      if (audioPlayerRef.current) {
        audioQueueRef.current = [];
        setActiveAudioSrc(audioUri);
        setCurrentlyPlayingId(turnId);
        setCurrentWordIndex(-1);
        try {
          if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
          }
        } catch (err) {
          console.warn('VoiceAgent: failed to resume audio context before playback', err);
        }
        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = audioUri;
        audioPlayerRef.current.currentTime = 0;
        playAudioSafely(audioPlayerRef.current, (e) => {
          console.error("Audio playback error:", e);
          toast({ variant: 'destructive', title: 'Playback Error', description: `Could not play audio: ${(e as Error).message}` });
          setCallState("LISTENING");
        });
      } else {
        setCallState('LISTENING');
      }
    } catch (e: any) {
      console.error("TTS synthesis error:", e);
      toast({ variant: 'destructive', title: 'TTS Error', description: e.message });
      setCallState('LISTENING');
    }
  }, [selectedVoiceId, toast, supportsMediaRecorder, setupRecordingGraph, playAudioSafely]);

  const inactivityCounter = useRef(0);

  const processAgentTurn = useCallback(async (
    currentConversation: ConversationTurn[],
    userInputText: string,
  ) => {
    if (!selectedProduct || !selectedCohort || !productInfo) return;
    setError(null);
    setCallState("PROCESSING");

    const kbContext = prepareKnowledgeBaseContext(productKbFiles, productInfo, currentConversation, selectedCohort);

    try {
      const flowInput: VoiceSalesAgentFlowInput = {
        action: "PROCESS_USER_RESPONSE",
        product: selectedProduct as Product, productDisplayName: productInfo.displayName, brandName: productInfo.brandName,
        salesPlan: selectedSalesPlan, specialPlanConfigurations: selectedSpecialConfig, offer: offerDetails,
        customerCohort: selectedCohort, agentName, userName,
        knowledgeBaseContext: kbContext,
        conversationHistory: currentConversation, currentPitchState: currentPitch,
        currentUserInputText: userInputText,
        inactivityCounter: inactivityCounter.current,
        brandUrl: productInfo.brandUrl,
      };

      const flowResult = await runVoiceSalesAgentTurn(flowInput);
      if (flowResult.generatedPitch) setCurrentPitch(flowResult.generatedPitch);

      if (flowResult.errorMessage) {
          throw new Error(flowResult.errorMessage);
      }

      if (!userInputText) {
        inactivityCounter.current += 1;
      } else {
        inactivityCounter.current = 0;
      }

      const aiResponseText = flowResult.currentAiResponseText;
      if (aiResponseText) {
          const aiTurn: ConversationTurn = { id: `ai-${Date.now()}`, speaker: 'AI' as const, text: aiResponseText, timestamp: new Date().toISOString() };
          setConversation(prev => [...prev, aiTurn]);
          if (flowResult.nextExpectedAction === 'INTERACTION_ENDED') {
            setIsAutoEnding(true);
          }
          await synthesizeAndPlay(aiResponseText, aiTurn.id);
      } else {
          setCallState('LISTENING');
      }

    } catch (e: any) {
      const errorMessage = `I'm sorry, a critical system error occurred. Details: ${e.message.substring(0, 200)}...`;
      const errorTurn: ConversationTurn = { id: `error-${Date.now()}`, speaker: 'AI', text: errorMessage, timestamp: new Date().toISOString() };
      setConversation(prev => [...prev, errorTurn]);
      setError(e.message);
      await synthesizeAndPlay(errorMessage, errorTurn.id);
    }
  }, [selectedProduct, productInfo, agentName, userName, selectedSalesPlan, selectedSpecialConfig, offerDetails, selectedCohort, currentPitch, productKbFiles, toast, synthesizeAndPlay]);

  processAgentTurnRef.current = processAgentTurn;

  const handleScorePostCall = useCallback(async ({ transcript, audioDataUri, transcriptAccuracy }: { transcript: string; audioDataUri?: string; transcriptAccuracy?: string; }) => {
    if (!transcript || !selectedProduct) return;

    const { scoreCall } = await import('@/ai/flows/call-scoring');

    try {
        const productData = getProductByName(selectedProduct);
        if(!productData) throw new Error("Product details not found for scoring.");

        const productContext = prepareKnowledgeBaseContext(productKbFiles, productData, [], selectedCohort);

        const scoreOutput = await scoreCall({
          product: selectedProduct as Product,
          agentName,
          audioDataUri,
          transcriptOverride: transcript,
          productContext,
          brandUrl: productData.brandUrl,
        });

        setFinalCallArtifacts(prev => prev
          ? { ...prev, transcript, transcriptAccuracy, audioUri: audioDataUri, score: scoreOutput }
          : { transcript, transcriptAccuracy, audioUri: audioDataUri, score: scoreOutput }
        );

        if (currentActivityId.current) {
          const existingActivity = activities.find(a => a.id === currentActivityId.current);
          if (existingActivity) {
            updateActivity(currentActivityId.current, { ...existingActivity.details, finalScore: scoreOutput });
          }
        }
        toast({ title: "Scoring Complete!", description: "The call has been scored successfully."});
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Scoring Failed", description: e.message });
    }
  }, [selectedProduct, selectedCohort, getProductByName, productKbFiles, agentName, updateActivity, toast, activities]);

  const handleEndInteraction = useCallback(async (status: 'Completed' | 'Completed (Page Unloaded)' = 'Completed') => {
    if (callStateRef.current === "ENDED") return;

    stopRecording();
    cancelAudio();
    setCallState("PROCESSING");

    const finalConversation = conversation;
    let audioDataUri: string | undefined;
    let transcriptAccuracy: string | undefined;

    try {
      const recordingBlob = await stopRecordingGraph();
      if (recordingBlob && recordingBlob.size > 0) {
        audioDataUri = await blobToDataUri(recordingBlob);
      }
    } catch (err) {
      console.warn('VoiceAgent: failed to capture live recording, falling back to synthesis', err);
    }

    if (!audioDataUri) {
      try {
        const audioResult = await generateFullCallAudio({ conversationHistory: finalConversation, agentVoiceProfile: selectedVoiceId });
        if (audioResult.audioDataUri) {
          audioDataUri = audioResult.audioDataUri;
        } else if (audioResult.errorMessage) {
          toast({ variant: 'destructive', title: "Audio Generation Failed", description: audioResult.errorMessage });
        }
      } catch (e) {
        toast({ variant: 'destructive', title: "Audio Generation Error", description: (e as Error).message });
      }
    }

    const fallbackTranscript = finalConversation
      .map(turn => `[${new Date(turn.timestamp).toLocaleTimeString()}] ${mapSpeakerToRole(turn.speaker)}:\n${turn.text}`)
      .join('\n\n');

    let transcriptText = fallbackTranscript;

    if (audioDataUri) {
      try {
        const { transcribeAudio } = await import('@/ai/flows/transcription-flow');
        const transcription: TranscriptionOutput | undefined = await transcribeAudio({ audioDataUri });
        if (transcription?.diarizedTranscript) {
          transcriptText = transcription.diarizedTranscript;
        }
        if (transcription?.accuracyAssessment) {
          transcriptAccuracy = transcription.accuracyAssessment;
        }
      } catch (err) {
        console.warn('VoiceAgent: transcription failed, using fallback transcript', err);
      }
    }

    setFinalCallArtifacts({ transcript: transcriptText, transcriptAccuracy, audioUri: audioDataUri });

    if (currentActivityId.current) {
        const existingActivity = activities.find(a => a.id === currentActivityId.current);
        if(existingActivity) {
          updateActivity(currentActivityId.current, {
            ...existingActivity.details,
            status,
            fullTranscriptText: transcriptText,
            fullConversation: finalConversation,
            fullCallAudioDataUri: audioDataUri,
            selectedKbIds: productKbFiles.map(f => f.id)
          });
        }
    }

    setCallState("ENDED");

    if (status === 'Completed') {
      await handleScorePostCall({ transcript: transcriptText, audioDataUri, transcriptAccuracy });
    }
  }, [conversation, stopRecording, cancelAudio, stopRecordingGraph, blobToDataUri, generateFullCallAudio, selectedVoiceId, toast, activities, updateActivity, productKbFiles, handleScorePostCall]);


  const handleStartConversation = useCallback(async () => {
    if (!userName.trim() || !agentName.trim() || !selectedProduct || !selectedCohort || !productInfo) {
      toast({ variant: "destructive", title: "Missing Info", description: "Agent Name, Customer Name, Product, and Cohort are required." });
      return;
    }

    if (productKbFiles.length === 0) {
      toast({title: "No Knowledge Base Files", description: `There are no KB files for '${productInfo.displayName}'. The AI will rely on its general knowledge.`, duration: 6000});
    }

    inactivityCounter.current = 0;
    setConversation([]); setCurrentPitch(null); setFinalCallArtifacts(null);
    setCallState("PROCESSING");

    const activityDetails: Partial<VoiceSalesAgentActivityDetails> = {
      input: { product: selectedProduct, customerCohort: selectedCohort, agentName, userName, voiceName: selectedVoiceId, selectedKbIds: productKbFiles.map(f=>f.id) },
      status: 'In Progress'
    };
    const activityId = logActivity({ module: "Browser Voice Agent", product: selectedProduct, agentName, details: activityDetails });
    currentActivityId.current = activityId;

    try {
        if (supportsMediaRecorder) {
          await setupRecordingGraph();
        }

        const kbContext = prepareKnowledgeBaseContext(productKbFiles, productInfo, [], selectedCohort);

        const flowInput: VoiceSalesAgentFlowInput = {
            action: 'START_CONVERSATION',
            product: selectedProduct as Product, productDisplayName: productInfo.displayName, brandName: productInfo.brandName,
            salesPlan: selectedSalesPlan, specialPlanConfigurations: selectedSpecialConfig, offer: offerDetails,
            customerCohort: selectedCohort, agentName, userName,
            knowledgeBaseContext: kbContext,
            conversationHistory: [], currentPitchState: null,
            brandUrl: productInfo.brandUrl,
        };
        const pitchResult = await runVoiceSalesAgentTurn(flowInput);

        if (pitchResult.errorMessage || !pitchResult.generatedPitch || !pitchResult.currentAiResponseText) {
          throw new Error(pitchResult.errorMessage || "Failed to generate initial pitch.");
        }

        setCurrentPitch(pitchResult.generatedPitch);
        const openingText = pitchResult.currentAiResponseText;
        const aiTurn: ConversationTurn = { id: `ai-${Date.now()}`, speaker: 'AI' as const, text: openingText, timestamp: new Date().toISOString()};
        setConversation([aiTurn]);

        await synthesizeAndPlay(openingText, aiTurn.id);

    } catch(e: any) {
        const errorMessage = e.message || "Failed to start conversation.";
        setError(errorMessage);
        setCallState("ERROR");
        const errorTurn: ConversationTurn = { id: `error-${Date.now()}`, speaker: 'AI', text: errorMessage, timestamp: new Date().toISOString() };
        setConversation(prev => [...prev, errorTurn]);
        if (supportsMediaRecorder) {
          await stopRecordingGraph();
        }
    }
  }, [userName, agentName, selectedProduct, productInfo, selectedCohort, selectedVoiceId, selectedSalesPlan, selectedSpecialConfig, offerDetails, logActivity, toast, productKbFiles, synthesizeAndPlay, supportsMediaRecorder, setupRecordingGraph, stopRecordingGraph]);

  const handlePreviewVoice = useCallback(async () => {
      const player = new Audio();
      player.onended = () => setIsVoicePreviewPlaying(false);
      player.onpause = () => setIsVoicePreviewPlaying(false);
      player.onerror = () => {
        toast({variant: 'destructive', title: 'Audio Playback Error'});
        setIsVoicePreviewPlaying(false);
      };

      setIsVoicePreviewPlaying(true);
      try {
        const textToSynthesize = SAMPLE_TEXT.replace(/\bET\b/g, 'E T');
        const result = await synthesizeSpeechOnClient({ text: textToSynthesize, voice: selectedVoiceId });
        player.src = result.audioDataUri;
        const playPromise = player.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch((e: any) => {
            if (e?.name === 'AbortError' || e?.message?.includes('The play() request was interrupted')) {
              return;
            }
            toast({variant: 'destructive', title: 'Audio Playback Error', description: e?.message});
            setIsVoicePreviewPlaying(false);
          });
        }
      } catch (e: any) {
          toast({variant: 'destructive', title: 'TTS Error', description: e.message});
          setIsVoicePreviewPlaying(false);
      }
  }, [selectedVoiceId, toast]);

  const handleReset = useCallback(() => {
    if (currentActivityId.current && callStateRef.current !== 'CONFIGURING') {
        const finalConversation = Array.isArray(conversation) ? conversation : [];
        const existingActivity = activities.find(a => a.id === currentActivityId.current);
        if(existingActivity) {
          updateActivity(currentActivityId.current, { ...existingActivity.details, status: 'Completed (Reset)', fullTranscriptText: finalConversation.map(t => `${mapSpeakerToRole(t.speaker)}: ${t.text}`).join('\n'), fullConversation: finalConversation });
        }
        toast({ title: 'Interaction Logged', description: 'The previous call was logged before resetting.' });
    }
    setCallState("CONFIGURING");
    setConversation([]); setCurrentPitch(null); setFinalCallArtifacts(null);
    setError(null); currentActivityId.current = null;
    setCurrentTranscription("");
    cancelAudio(); stopRecording();
    if (supportsMediaRecorder) {
      stopRecordingGraph().catch(() => {});
    }
  }, [cancelAudio, conversation, updateActivity, toast, stopRecording, stopRecordingGraph, supportsMediaRecorder, activities]);

  useEffect(() => {
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation, currentTranscription]);

  useEffect(() => {
    const audioEl = audioPlayerRef.current;
    const playNextInQueue = () => {
        if (audioQueueRef.current.length > 0) {
            const nextSrc = audioQueueRef.current.shift()!;
            setActiveAudioSrc(nextSrc);
            audioEl!.pause();
            audioEl!.src = nextSrc;
            audioEl!.currentTime = 0;
            playAudioSafely(audioEl!, (e) => {
                console.error("Audio playback error in queue:", e);
                setCallState("LISTENING");
            });
        } else {
            setCurrentlyPlayingId(null);
            setCurrentWordIndex(-1);
            if (isAutoEnding) {
                handleEndInteraction();
                setIsAutoEnding(false);
            } else if (callStateRef.current === "AI_SPEAKING") {
                setCallState('LISTENING');
            }
        }
    };

    const onTimeUpdate = () => {
      if (!audioEl || audioEl.paused || !currentlyPlayingId) return;
      if (!isFinite(audioEl.duration) || audioEl.duration <= 0) return;

      const turn = conversation.find(t => t.id === currentlyPlayingId);
      if (!turn) return;

      const totalWords = turn.text.trim().split(/\s+/).filter(Boolean).length;
      if (totalWords === 0) return;

      const progressRatio = Math.min(Math.max(audioEl.currentTime / audioEl.duration, 0), 1);
      const computedIndex = Math.floor(progressRatio * (totalWords - 1));
      setCurrentWordIndex(prev => (prev === computedIndex ? prev : computedIndex));
    };

    if (audioEl) {
        audioEl.addEventListener('ended', playNextInQueue);
        audioEl.addEventListener('timeupdate', onTimeUpdate);
    }
    return () => {
      if(audioEl) {
        audioEl.removeEventListener('ended', playNextInQueue);
        audioEl.removeEventListener('timeupdate', onTimeUpdate);
      }
    };
  }, [conversation, currentlyPlayingId, handleEndInteraction, isAutoEnding, playAudioSafely]);

  useEffect(() => {
    if (callState === 'LISTENING' && !isRecording) {
        startRecording();
    } else if (callState !== 'LISTENING' && isRecording) {
        stopRecording();
    }
  }, [callState, isRecording, startRecording, stopRecording]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (isCallInProgress && currentActivityId.current) {
            handleEndInteraction('Completed (Page Unloaded)');
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isCallInProgress, handleEndInteraction]);


  const getCallStatusBadge = () => {
    switch (callState) {
        case "LISTENING": return <Badge variant="default" className="text-xs bg-green-100 text-green-800"><Mic className="mr-1.5 h-3.5 w-3.5"/>Listening...</Badge>;
        case "AI_SPEAKING": return <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800"><Bot className="mr-1.5 h-3.5 w-3.5"/>AI Speaking (Interruptible)</Badge>;
        case "PROCESSING": return <Badge variant="secondary" className="text-xs"><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/>Processing...</Badge>;
        case "ENDED": return <Badge variant="secondary" className="text-xs bg-gray-200 text-gray-600"><PhoneOff className="mr-1.5 h-3.5 w-3.5"/>Interaction Ended</Badge>;
        case "ERROR": return <Badge variant="destructive" className="text-xs"><AlertTriangle className="mr-1.5 h-3.5 w-3.5"/>Error</Badge>;
        default: return <Badge variant="outline" className="text-xs">Idle</Badge>;
    }
  }

  const availableCohorts = useMemo(() => productInfo?.customerCohorts || [], [productInfo]);
  const availableSalesPlans = useMemo(() => productInfo?.salesPlans || [], [productInfo]);
  const availableSpecialConfigs = useMemo(() => productInfo?.specialPlanConfigurations || [], [productInfo]);

  useEffect(() => {
    if (productInfo && availableCohorts.length > 0 && !availableCohorts.includes(selectedCohort || '')) {
      setSelectedCohort(availableCohorts[0]);
    }
  }, [productInfo, availableCohorts, selectedCohort]);

  return (
    <>
    <div className="flex flex-col h-full">
      <PageHeader title="AI Voice Sales Agent" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <audio
          ref={audioPlayerRef}
          controls
          preload="auto"
          className={`w-full max-w-4xl mx-auto mb-4 ${activeAudioSrc ? '' : 'opacity-50 pointer-events-none'}`}
          src={activeAudioSrc || undefined}
        />
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Radio className="mr-2 h-6 w-6 text-primary"/> Configure AI Voice Call</CardTitle>
            <CardDescription>Set up agent, customer, product, and voice profile details before starting the call. The entire Knowledge Base for the selected product will be used as context.</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible defaultValue={callState === 'CONFIGURING' ? "item-config" : ""} className="w-full">
                <AccordionItem value="item-config">
                    <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90 [&[data-state=open]>&svg]:rotate-180">
                        <div className="flex items-center"><Settings className="mr-2 h-4 w-4 text-accent"/>Call Configuration</div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-3 space-y-4">
                         <div className="space-y-1">
                             <Label>AI Voice Profile (Agent)</Label>
                              <div className="mt-2 flex items-center gap-2">
                                <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId} disabled={isCallInProgress}>
                                    <SelectTrigger className="flex-grow"><SelectValue placeholder={"Select a voice"} /></SelectTrigger>
                                    <SelectContent>{GOOGLE_PRESET_VOICES.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <Button variant="outline" size="sm" onClick={handlePreviewVoice} disabled={isVoicePreviewPlaying || isCallInProgress}>
                                  {isVoicePreviewPlaying ? <Loader2 className="h-4 w-4 animate-spin"/> : <PlayCircle className="h-4 w-4"/>}
                                </Button>
                            </div>
                         </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-1">
                                <Label htmlFor="product-select">Product <span className="text-destructive">*</span></Label>
                                <Select value={selectedProduct} onValueChange={(value) => setSelectedProduct(value as Product)} disabled={isCallInProgress}>
                                    <SelectTrigger id="product-select"><SelectValue placeholder="Select a Product" /></SelectTrigger>
                                    <SelectContent>{availableProducts.map((p) => (<SelectItem key={p.name} value={p.name}>{p.displayName}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="cohort-select">Customer Cohort <span className="text-destructive">*</span></Label>
                                <Select value={selectedCohort} onValueChange={(value) => setSelectedCohort(value as CustomerCohort)} disabled={isCallInProgress || !productInfo || availableCohorts.length === 0}>
                                    <SelectTrigger id="cohort-select"><SelectValue placeholder="Select Cohort" /></SelectTrigger>
                                    <SelectContent>{availableCohorts.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1"><Label htmlFor="agent-name">Agent Name <span className="text-destructive">*</span></Label><Input id="agent-name" placeholder="e.g., Samantha" value={agentName} onChange={e => setAgentName(e.target.value)} disabled={isCallInProgress} /></div>
                            <div className="space-y-1"><Label htmlFor="user-name">Customer Name <span className="text-destructive">*</span></Label><Input id="user-name" placeholder="e.g., Rohan" value={userName} onChange={e => setUserName(e.target.value)} disabled={isCallInProgress} /></div>
                        </div>
                          {isClient && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {availableSpecialConfigs.length > 0 && (<div className="space-y-1">
                                  <Label htmlFor="special-plan-config-select">Special Plan Configuration (Optional)</Label>
                                  <Select value={selectedSpecialConfig} onValueChange={(value) => setSelectedSpecialConfig(value as string)} disabled={isCallInProgress}>
                                      <SelectTrigger id="special-plan-config-select"><SelectValue placeholder="Select special config" /></SelectTrigger>
                                      <SelectContent>{availableSpecialConfigs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                  </Select>
                              </div>)}
                              {availableSalesPlans.length > 0 && (
                                <div className="space-y-1">
                                      <Label htmlFor="plan-select">Sales Plan (Optional)</Label>
                                      <Select value={selectedSalesPlan} onValueChange={(value) => setSelectedSalesPlan(value as SalesPlan)} disabled={isCallInProgress}>
                                          <SelectTrigger id="plan-select"><SelectValue placeholder="Select Sales Plan" /></SelectTrigger>
                                          <SelectContent>{availableSalesPlans.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                      </Select>
                                  </div>
                              )}
                              <div className="space-y-1"><Label htmlFor="offer-details">Offer Details (Optional)</Label><Input id="offer-details" placeholder="e.g., 20% off" value={offerDetails} onChange={e => setOfferDetails(e.target.value)} disabled={isCallInProgress} /></div>
                          </div>
                          )}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
            {callState === 'CONFIGURING' && (
                 <Button onClick={handleStartConversation} disabled={!selectedProduct || !selectedCohort || !userName.trim() || !agentName.trim()} className="w-full mt-4">
                    <PhoneCall className="mr-2 h-4 w-4"/> Start Voice Call
                </Button>
            )}
          </CardContent>
        </Card>
        {callState !== 'CONFIGURING' && callState !== 'IDLE' && (
          <Card className="w-full max-w-4xl mx-auto mt-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center"><SquareTerminal className="mr-2 h-5 w-5 text-primary"/> Conversation Log</div>
                {getCallStatusBadge()}
              </CardTitle>
              <CardDescription>Interaction with {userName || "Customer"}. Agent: {agentName || "Default AI"}. Product: {productInfo?.displayName}.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] w-full border rounded-md p-3 bg-muted/20 mb-3">
                {conversation.map((turn) => <ConversationTurnComponent
                    key={turn.id}
                    turn={turn}
                    onPlayAudio={handleTurnAudioPlayback}
                    currentlyPlayingId={currentlyPlayingId}
                    wordIndex={turn.id === currentlyPlayingId ? currentWordIndex : -1}
                />)}
                {callState === "LISTENING" && (
                   <div className="flex items-start gap-2.5 my-3 justify-end user-line">
                      <div className="flex flex-col gap-1 w-full max-w-[80%] items-end">
                           <Card className="max-w-full w-fit p-3 rounded-xl shadow-sm bg-accent/80 text-accent-foreground rounded-br-none">
                            <CardContent className="p-0 text-sm">
                                <p className="italic">{currentTranscription || " Listening..."}</p>
                            </CardContent>
                          </Card>
                      </div>
                      <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="bg-accent text-accent-foreground"><UserIcon size={18}/></AvatarFallback></Avatar>
                  </div>
                )}
                {callState === "PROCESSING" && <LoadingSpinner size={16} className="mx-auto my-2" />}
                <div ref={conversationEndRef} />
              </ScrollArea>

               {error && (<Alert variant="destructive" className="mb-3"><Accordion type="single" collapsible><AccordionItem value="item-1" className="border-b-0"><AccordionTrigger className="p-0 hover:no-underline text-sm font-semibold [&_svg]:ml-1"><div className="flex items-center"><AlertTriangle className="h-4 w-4 mr-2" /> An error occurred. Click to see details.</div></AccordionTrigger><AccordionContent className="pt-2 text-xs"><pre className="whitespace-pre-wrap break-all bg-destructive/10 p-2 rounded-md font-mono">{error}</pre></AccordionContent></AccordionItem></Accordion></Alert>)}
            </CardContent>
            <CardFooter className="flex justify-between items-center">
                 <Button onClick={() => handleEndInteraction()} variant="destructive" size="sm" disabled={callState === "ENDED"}>
                   <PhoneOff className="mr-2 h-4 w-4"/> End Interaction
                </Button>
                 <Button onClick={handleReset} variant="outline" size="sm">
                    <Redo className="mr-2 h-4 w-4"/> New Call
                </Button>
            </CardFooter>
          </Card>
        )}
        {finalCallArtifacts && callState === 'ENDED' && (
           <PostCallReview
              artifacts={finalCallArtifacts}
              agentName={agentName}
              userName={userName}
              product={selectedProduct as Product}
           />
        )}
      </main>
    </div>
    </>
  );
}
