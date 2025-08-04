
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { CallScoringResultsCard } from '@/components/features/call-scoring/call-scoring-results-card';
import { Badge } from "@/components/ui/badge";

import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { useWhisper } from '@/hooks/useWhisper';
import { useProductContext } from '@/hooks/useProductContext';
import { useSpeechSynthesis, CURATED_VOICE_PROFILES, CuratedVoice } from '@/hooks/useSpeechSynthesis';


import { 
    SALES_PLANS, ET_PLAN_CONFIGURATIONS,
    Product, SalesPlan, CustomerCohort,
    ConversationTurn, 
    GeneratePitchOutput, ETPlanConfiguration,
    ScoreCallOutput, KnowledgeFile,
    VoiceSalesAgentFlowInput, VoiceSalesAgentFlowOutput,
    VoiceSalesAgentActivityDetails,
} from '@/types';
import { runVoiceSalesAgentTurn } from '@/ai/flows/voice-sales-agent-flow';

import { PhoneCall, Send, AlertTriangle, Bot, SquareTerminal, User as UserIcon, Info, Radio, Mic, Wifi, PhoneOff, Redo, Settings, Volume2, Pause, Sparkles, Loader2, PlayCircle, FileAudio, Download, Timer } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from '@/lib/utils';
import { scoreCall } from '@/ai/flows/call-scoring';

// Helper to prepare Knowledge Base context
const prepareKnowledgeBaseContext = (
  knowledgeBaseFiles: KnowledgeFile[],
  product: Product
): string => {
  const productSpecificFiles = knowledgeBaseFiles.filter(f => f.product === product);
  if (productSpecificFiles.length === 0) return "No specific knowledge base content found for this product.";
  const MAX_CONTEXT_LENGTH = 15000; 
  let combinedContext = `Knowledge Base Context for Product: ${product}\n---\n`;
  for (const file of knowledgeBaseFiles) {
    let contentToInclude = `(File: ${file.name}, Type: ${file.type}. Content not directly viewed for non-text or large files; AI should use name/type as context.)`;
    if (file.isTextEntry && file.textContent) {
        contentToInclude = file.textContent.substring(0,2000) + (file.textContent.length > 2000 ? "..." : "");
    }
    const itemContent = `Item: ${file.name}\nType: ${file.isTextEntry ? 'Text Entry' : 'File'}\nContent Summary/Reference:\n${contentToInclude}\n---\n`;
    if (combinedContext.length + itemContent.length > MAX_CONTEXT_LENGTH) {
        combinedContext += "... (Knowledge Base truncated due to length limit for AI context)\n";
        break;
    }
    combinedContext += itemContent;
  }
  return combinedContext;
};

// Helper to convert AudioBuffer to WAV format Blob
const bufferToWave = (abuffer: AudioBuffer): Blob => {
  let numOfChan = abuffer.numberOfChannels,
      len = abuffer.length * numOfChan * 2 + 44,
      buffer = new ArrayBuffer(len),
      view = new DataView(buffer),
      channels = [], i, sample,
      offset = 0,
      pos = 0;

  const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2; };
  const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4; };

  setUint32(0x46464952); // "RIFF"
  setUint32(len - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit
  setUint32(0x61746164); // "data" - chunk
  setUint32(len - pos - 4); // chunk length

  for (i = 0; i < abuffer.numberOfChannels; i++) channels.push(abuffer.getChannelData(i));
  while (pos < len) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++
  }
  return new Blob([view], { type: 'audio/wav' });
};


const stitchAudio = async (conversation: ConversationTurn[]): Promise<string | null> => {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffers: AudioBuffer[] = [];

        for (const turn of conversation) {
            if (turn.audioDataUri && turn.audioDataUri.startsWith("data:audio")) {
                try {
                    const response = await fetch(turn.audioDataUri);
                    const arrayBuffer = await response.arrayBuffer();
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    audioBuffers.push(audioBuffer);
                } catch(decodeError){
                    console.error("Failed to decode audio data for a turn. Skipping this turn.", {turn, decodeError});
                }
            }
        }
        
        if (audioBuffers.length === 0) return null;

        // Use the sample rate of the first buffer as the target sample rate
        const targetSampleRate = audioBuffers[0].sampleRate;
        let totalLength = 0;
        
        // Resample all buffers to the target sample rate and calculate total length
        const resampledBuffers: AudioBuffer[] = [];
        for (const buffer of audioBuffers) {
            if (buffer.sampleRate === targetSampleRate) {
                resampledBuffers.push(buffer);
                totalLength += buffer.length;
            } else {
                 const tempContext = new OfflineAudioContext(buffer.numberOfChannels, buffer.duration * targetSampleRate, targetSampleRate);
                 const tempSource = tempContext.createBufferSource();
                 tempSource.buffer = buffer;
                 tempSource.connect(tempContext.destination);
                 tempSource.start();
                 const resampled = await tempContext.startRendering();
                 resampledBuffers.push(resampled);
                 totalLength += resampled.length;
            }
        }
        
        // Use the channel count of the first buffer
        const numberOfChannels = audioBuffers[0].numberOfChannels;
        const outputBuffer = audioContext.createBuffer(numberOfChannels, totalLength, targetSampleRate);

        let offset = 0;
        for (const buffer of resampledBuffers) {
            for(let channel = 0; channel < numberOfChannels; channel++) {
                outputBuffer.getChannelData(channel).set(buffer.getChannelData(channel), offset);
            }
            offset += buffer.length;
        }

        const wavBlob = bufferToWave(outputBuffer);
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => { resolve(reader.result as string); };
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(wavBlob);
        });
    } catch (error) {
        console.error("Audio stitching failed:", error);
        return null;
    }
};


const VOICE_AGENT_CUSTOMER_COHORTS: CustomerCohort[] = [
  "Business Owners", "Financial Analysts", "Active Investors", "Corporate Executives", "Young Professionals", "Students",
  "Payment Dropoff", "Paywall Dropoff", "Plan Page Dropoff", "Assisted Buying", "Expired Users",
  "New Prospect Outreach", "Premium Upsell Candidates",
];

const SAMPLE_TEXT = "Hello, this is a sample of the selected voice that you can listen to.";
const SAMPLE_TEXT_HINDI = "नमस्ते, यह चुनी हुई आवाज़ का एक नमूना है जिसे आप सुन सकते हैं।";


export default function VoiceSalesAgentPage() {
  const [isInteractionStarted, setIsInteractionStarted] = useState(false);
  const [agentName, setAgentName] = useState<string>(""); 
  const [userName, setUserName] = useState<string>(""); 
  
  const { availableProducts, getProductByName } = useProductContext();
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();

  const [selectedSalesPlan, setSelectedSalesPlan] = useState<SalesPlan | undefined>();
  const [selectedEtPlanConfig, setSelectedEtPlanConfig] = useState<ETPlanConfiguration | undefined>();
  const [offerDetails, setOfferDetails] = useState<string>("");
  const [selectedCohort, setSelectedCohort] = useState<CustomerCohort | undefined>();
  
  const [selectedVoiceName, setSelectedVoiceName] = useState<string | undefined>(undefined);
  
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPitch, setCurrentPitch] = useState<GeneratePitchOutput | null>(null);
  const [finalScore, setFinalScore] = useState<ScoreCallOutput | null>(null);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [currentCallStatus, setCurrentCallStatus] = useState<string>("Idle");
  const [finalStitchedAudioUri, setFinalStitchedAudioUri] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  const [interimTranscript, setInterimTranscript] = useState("");

  const onSpeechEnd = useCallback(() => {
    if (isInteractionStarted && !isCallEnded) {
      setCurrentCallStatus("Listening...");
    }
  }, [isInteractionStarted, isCallEnded]);
  
  const onSpeechStart = useCallback(() => {
      // Start the timer only when the first AI speech begins and the call is not already running.
      if (isInteractionStarted && !isCallEnded && !callTimerRef.current) {
          callTimerRef.current = setInterval(() => {
              setCallDuration(prev => prev + 1);
          }, 1000);
      }
  }, [isInteractionStarted, isCallEnded]);

  const {
    isSupported: isSpeechSynthSupported,
    speak,
    cancel,
    isSpeaking,
    isLoading: areVoicesLoading,
    curatedVoices,
  } = useSpeechSynthesis({ onEnd: onSpeechEnd, onStart: onSpeechStart });

  const selectedVoiceObject = useMemo(() => {
    return curatedVoices.find(v => v.name === selectedVoiceName);
  }, [curatedVoices, selectedVoiceName]);

  const { toast } = useToast();
  const { logActivity, updateActivity } = useActivityLogger();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const conversationEndRef = useRef<null | HTMLDivElement>(null);
  const currentActivityId = useRef<string | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer effect - This is now controlled by onSpeechStart
  useEffect(() => {
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };


  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);
  
  useEffect(() => { if (selectedProduct !== "ET") setSelectedEtPlanConfig(undefined); }, [selectedProduct]);

  useEffect(() => {
    if (!selectedVoiceName && !areVoicesLoading && curatedVoices.length > 0) {
        const defaultVoice = curatedVoices.find(v => v.isDefault) || curatedVoices.find(v => v.name.includes("Indian")) || curatedVoices[0];
        if (defaultVoice) {
            setSelectedVoiceName(defaultVoice.name);
        }
    }
  }, [areVoicesLoading, curatedVoices, selectedVoiceName]);
  
  const handleUserInterruption = useCallback(() => {
    cancel();
  }, [cancel]);

  
  const handlePlaySample = (voiceObj?: CuratedVoice) => {
    if (isSpeaking) {
      cancel();
    } else if (voiceObj?.voice) {
      const textToSay = voiceObj.voice.lang && voiceObj.voice.lang.toLowerCase().startsWith('hi') ? SAMPLE_TEXT_HINDI : SAMPLE_TEXT;
      speak({ text: textToSay, voice: voiceObj.voice });
    } else {
      toast({ variant: 'destructive', title: 'No Voice Selected', description: 'Please select a voice to play a sample.' });
    }
  };


  const processAgentTurn = useCallback(async (
    action: VoiceSalesAgentFlowInput['action'],
    userInputText?: string,
    userAudioUri?: string,
  ) => {
    const productInfo = getProductByName(selectedProduct || "");
    if (!selectedProduct || !selectedCohort || !userName.trim() || !productInfo) {
      toast({ variant: "destructive", title: "Missing Info", description: "Please select a Product, Customer Cohort, and enter the Customer's Name." });
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setCurrentCallStatus( action === "START_CONVERSATION" ? "Initiating call..." : action === "END_CALL_AND_SCORE" ? "Ending..." : "AI thinking...");

    const kbContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, selectedProduct as Product);
    
    const conversationHistoryForFlow = [...conversation];
     if (action === "PROCESS_USER_RESPONSE" && userInputText) {
        const userTurnId = `user-temp-${Date.now()}`;
        conversationHistoryForFlow.push({ id: userTurnId, speaker: 'User', text: userInputText, timestamp: new Date().toISOString(), audioDataUri: userAudioUri });
    }
    
    try {
        const flowInput: VoiceSalesAgentFlowInput = {
            product: selectedProduct as Product,
            productDisplayName: productInfo.displayName,
            salesPlan: selectedSalesPlan, etPlanConfiguration: selectedProduct === "ET" ? selectedEtPlanConfig : undefined,
            offer: offerDetails, customerCohort: selectedCohort, agentName: agentName, userName: userName,
            knowledgeBaseContext: kbContext, conversationHistory: conversationHistoryForFlow,
            currentPitchState: currentPitch, action: action,
            currentUserInputText: userInputText,
            voiceProfileId: selectedVoiceObject?.voice.name,
        };
        const flowResult: VoiceSalesAgentFlowOutput = await runVoiceSalesAgentTurn(flowInput);
      
      const textToSpeak = flowResult.currentAiSpeech?.text;
      
      if (flowResult.errorMessage) throw new Error(flowResult.errorMessage);
      
      let aiAudioUri: string | undefined;
      if(textToSpeak){
          speak({ text: textToSpeak, voice: selectedVoiceObject?.voice });
          setCurrentCallStatus("AI Speaking...");
          
          setConversation(prev => [...prev, {
            id: `ai-${Date.now()}`, speaker: 'AI', text: textToSpeak, timestamp: new Date().toISOString()
          }]);
          
      } else {
          if (!isCallEnded) setCurrentCallStatus("Listening...");
      }
      
      if (flowResult.generatedPitch) setCurrentPitch(flowResult.generatedPitch);
      if (flowResult.callScore) setFinalScore(flowResult.callScore);

      if (flowResult.nextExpectedAction === "END_CALL" || flowResult.nextExpectedAction === "CALL_SCORED") {
        setIsCallEnded(true);
        setCurrentCallStatus("Call Ended");
        
        const finalConversationState = [...conversation,
            ...(userInputText ? [{ id: `user-final-${Date.now()}`, speaker: 'User', text: userInputText, timestamp: new Date().toISOString(), audioDataUri: userAudioUri }] : []),
            ...(textToSpeak ? [{ id: `ai-final-${Date.now()}`, speaker: 'AI', text: textToSpeak, timestamp: new Date().toISOString(), audioDataUri: aiAudioUri }] : [])
        ];
        
        setCurrentCallStatus("Stitching Audio...");
        const finalStitchedAudio = await stitchAudio(finalConversationState);
        setFinalStitchedAudioUri(finalStitchedAudio);

        if(currentActivityId.current) {
            updateActivity(currentActivityId.current, {
                status: 'Completed',
                fullConversation: finalConversationState,
                fullTranscriptText: finalConversationState.map(t => `${t.speaker}: ${t.text}`).join('\n'),
                finalScore: flowResult.callScore,
                fullCallAudioDataUri: finalStitchedAudio ?? undefined,
            });
        }

        if(flowResult.callScore) {
          toast({ title: 'Call Ended & Scored', description: 'Final report is available.'});
          setCurrentCallStatus("Call Ended & Scored");
        } else {
          toast({ title: 'Call Ended', description: 'Call has been logged.'});
          setCurrentCallStatus("Call Ended & Logged");
        }
      }

    } catch (e: any) {
        setError(e.message || "An unexpected error occurred in the sales agent flow.");
        setCurrentCallStatus("Client Error");
    } finally {
      setIsLoading(false);
    }
  }, [selectedProduct, selectedSalesPlan, selectedEtPlanConfig, offerDetails, selectedCohort, agentName, userName, conversation, currentPitch, knowledgeBaseFiles, toast, getProductByName, selectedVoiceObject, speak, isCallEnded, updateActivity]);

  const handleUserInputSubmit = useCallback((text: string, audioDataUri?: string) => {
    if (!text.trim() || isLoading || isSpeaking || isCallEnded) return;
    setInterimTranscript("");
    const userTurn: ConversationTurn = { id: `user-${Date.now()}`, speaker: 'User', text: text, timestamp: new Date().toISOString(), audioDataUri: audioDataUri };
    setConversation(prev => [...prev, userTurn]);
    processAgentTurn("PROCESS_USER_RESPONSE", text, audioDataUri);
  }, [isLoading, isSpeaking, isCallEnded, processAgentTurn]); 
  
  const { startRecording, stopRecording, isRecording, transcript, recordedAudioUri } = useWhisper({
      onTranscribe: (text: string) => {
          handleUserInterruption();
          setInterimTranscript(text);
      },
      onTranscriptionComplete: (text: string, audioDataUri?: string) => {
          if (!text.trim() || isLoading || isSpeaking || isCallEnded) return;
          setInterimTranscript("");
          const userTurn: ConversationTurn = { id: `user-${Date.now()}`, speaker: 'User', text: text, timestamp: new Date().toISOString(), audioDataUri: audioDataUri };
          setConversation(prev => [...prev, userTurn]);
          processAgentTurn("PROCESS_USER_RESPONSE", text, audioDataUri);
      },
      captureAudio: true,
      stopTimeout: 2000,
  });

  
  // Master useEffect for controlling recording state
  useEffect(() => {
      const shouldBeListening = isInteractionStarted && !isLoading && !isSpeaking && !isCallEnded;
      if (shouldBeListening && !isRecording) {
          startRecording();
      } else if (!shouldBeListening && isRecording) {
          stopRecording();
      }
  }, [isInteractionStarted, isLoading, isSpeaking, isCallEnded, isRecording, startRecording, stopRecording]);

  const handleStartConversation = useCallback(() => {
    if (!userName.trim() || !selectedProduct || !selectedCohort) {
        toast({ variant: "destructive", title: "Missing Info", description: "Please select a Product, Customer Cohort, and enter the Customer's Name." });
        return;
    }
    setConversation([]); setCurrentPitch(null); setFinalScore(null); setIsCallEnded(false); setIsInteractionStarted(true); setFinalStitchedAudioUri(null); setCallDuration(0);
    
    const productInfo = getProductByName(selectedProduct);
    
    const activityDetails: Partial<VoiceSalesAgentActivityDetails> = {
      input: { product: selectedProduct, customerCohort: selectedCohort, agentName: agentName, userName: userName, voiceProfileId: selectedVoiceObject?.voice.name },
      status: 'In Progress'
    };
    const activityId = logActivity({ module: "AI Voice Sales Agent", product: selectedProduct, agentName, details: activityDetails });
    currentActivityId.current = activityId;

    processAgentTurn("START_CONVERSATION");
  }, [userName, selectedProduct, selectedCohort, agentName, selectedVoiceObject, logActivity, toast, processAgentTurn, getProductByName]);


  const handleEndCall = useCallback(async () => {
    if (isLoading || isCallEnded) return;

    cancel();
    stopRecording();
    setIsCallEnded(true); // Immediately stop further interactions
    setCurrentCallStatus("Ending Interaction & Scoring...");
    
    toast({ title: "Ending Call", description: "Generating final transcript and scoring report..." });

    // Use a small timeout to allow the final user speech to be processed
    await new Promise(resolve => setTimeout(resolve, 500));

    const lastUserText = interimTranscript || transcript.text;
    
    processAgentTurn("END_CALL_AND_SCORE", lastUserText, recordedAudioUri);

  }, [isLoading, isCallEnded, processAgentTurn, interimTranscript, recordedAudioUri, stopRecording, cancel, toast, transcript.text]);


  const handleReset = useCallback(() => {
    setIsInteractionStarted(false); setConversation([]); setCurrentPitch(null); setFinalScore(null); setIsCallEnded(false);
    setError(null); setCurrentCallStatus("Idle"); currentActivityId.current = null;
    cancel();
    setFinalStitchedAudioUri(null);
    stopRecording();
    setCallDuration(0);
    if(callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = null;
  }, [stopRecording, cancel]);
  
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Voice Sales Agent" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Sparkles className="mr-2 h-6 w-6 text-primary"/> Configure AI Voice Call</CardTitle>
            <CardDescription>
                This agent uses your browser's built-in text-to-speech engine. Voice quality varies by browser and OS.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             {!isSpeechSynthSupported && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Browser Not Supported</AlertTitle>
                    <AlertDescription>Your browser does not support the Web Speech API required for this feature. Please try Chrome or Firefox.</AlertDescription>
                </Alert>
            )}
            <Accordion type="single" collapsible defaultValue={isInteractionStarted ? "" : "item-config"} className="w-full">
                <AccordionItem value="item-config">
                    <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90 [&[data-state=open]>&svg]:rotate-180">
                        <div className="flex items-center"><Settings className="mr-2 h-4 w-4 text-accent"/>Call Configuration</div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-3 space-y-3">
                         <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                 <Label>AI Voice Profile (Agent)</Label>
                                  <div className="mt-2 flex items-center gap-2">
                                    <Select value={selectedVoiceName} onValueChange={(value) => setSelectedVoiceName(value)} disabled={isInteractionStarted || isSpeaking || areVoicesLoading}>
                                        <SelectTrigger className="flex-grow"><SelectValue placeholder={areVoicesLoading ? "Loading voices..." : "Select a voice"} /></SelectTrigger>
                                        <SelectContent>{curatedVoices.map(voice => (<SelectItem key={voice.name} value={voice.name}>{voice.name}</SelectItem>))}</SelectContent>
                                    </Select>
                                    <Button variant="outline" size="icon" onClick={() => handlePlaySample(selectedVoiceObject)} disabled={isInteractionStarted || isSpeaking || areVoicesLoading} title="Play sample">
                                      {isSpeaking ? <Pause className="h-4 w-4"/> : <Volume2 className="h-4 w-4"/>}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Select the AI agent's voice.</p>
                             </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-1">
                                <Label htmlFor="product-select-sales">Product <span className="text-destructive">*</span></Label>
                                <Select value={selectedProduct} onValueChange={(value) => setSelectedProduct(value as Product)} disabled={isInteractionStarted}>
                                    <SelectTrigger id="product-select-sales"><SelectValue placeholder="Select a Product" /></SelectTrigger>
                                    <SelectContent>{availableProducts.map((p) => (<SelectItem key={p.name} value={p.name}>{p.displayName}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1"><Label htmlFor="cohort-select">Customer Cohort <span className="text-destructive">*</span></Label><Select value={selectedCohort} onValueChange={(val) => setSelectedCohort(val as CustomerCohort)} disabled={isInteractionStarted}><SelectTrigger id="cohort-select"><SelectValue placeholder="Select Cohort" /></SelectTrigger><SelectContent>{VOICE_AGENT_CUSTOMER_COHORTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1"><Label htmlFor="agent-name">Agent Name</Label><Input id="agent-name" placeholder="e.g., Alex (AI Agent)" value={agentName} onChange={e => setAgentName(e.target.value)} disabled={isInteractionStarted} /></div>
                            <div className="space-y-1"><Label htmlFor="user-name">Customer Name <span className="text-destructive">*</span></Label><Input id="user-name" placeholder="e.g., Priya Sharma" value={userName} onChange={e => setUserName(e.target.value)} disabled={isInteractionStarted} /></div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {selectedProduct === "ET" && (<div className="space-y-1"><Label htmlFor="et-plan-config-select">ET Plan Configuration (Optional)</Label><Select value={selectedEtPlanConfig} onValueChange={(val) => setSelectedEtPlanConfig(val as ETPlanConfiguration)} disabled={isInteractionStarted}><SelectTrigger id="et-plan-config-select"><SelectValue placeholder="Select ET Plan" /></SelectTrigger><SelectContent>{ET_PLAN_CONFIGURATIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>)}
                            <div className="space-y-1"><Label htmlFor="plan-select">Sales Plan (Optional)</Label><Select value={selectedSalesPlan} onValueChange={(val) => setSelectedSalesPlan(val as SalesPlan)} disabled={isInteractionStarted}><SelectTrigger id="plan-select"><SelectValue placeholder="Select Sales Plan" /></SelectTrigger><SelectContent>{SALES_PLANS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                             <div className="space-y-1"><Label htmlFor="offer-details">Offer Details (Optional)</Label><Input id="offer-details" placeholder="e.g., 20% off" value={offerDetails} onChange={e => setOfferDetails(e.target.value)} disabled={isInteractionStarted} /></div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
            
            {!isInteractionStarted && (
                 <Button onClick={handleStartConversation} disabled={isLoading || !selectedProduct || !selectedCohort || !userName.trim() || !isSpeechSynthSupported} className="w-full mt-4">
                    <PhoneCall className="mr-2 h-4 w-4"/> Start Voice Call
                </Button>
            )}
          </CardContent>
        </Card>

        {isInteractionStarted && (
          <Card className="w-full max-w-4xl mx-auto mt-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center"><SquareTerminal className="mr-2 h-5 w-5 text-primary"/> Conversation Log</div>
                <div className="flex items-center gap-4">
                    <Badge variant="secondary" className="text-sm font-mono"><Timer className="mr-1.5 h-4 w-4"/> {formatDuration(callDuration)}</Badge>
                     <Badge variant={isSpeaking ? "outline" : "default"} className={cn("text-xs transition-colors", isSpeaking ? "bg-amber-100 text-amber-800" : isRecording ? "bg-red-100 text-red-700" : isCallEnded ? "bg-gray-200 text-gray-600" : "bg-green-100 text-green-800")}>
                        {isRecording ? <Radio className="mr-1.5 h-3.5 w-3.5 text-red-600 animate-pulse"/> : isSpeaking ? <Bot className="mr-1.5 h-3.5 w-3.5"/> : isCallEnded ? <PhoneOff className="mr-1.5 h-3.5 w-3.5"/> : <Mic className="mr-1.5 h-3.5 w-3.5"/>}
                        {isRecording ? "Listening..." : isSpeaking ? "AI Speaking..." : isCallEnded ? "Call Ended" : currentCallStatus}
                    </Badge>
                </div>
              </CardTitle>
              <CardDescription>
                Interaction with {userName || "Customer"}. AI Agent: {agentName || "Default AI"}. Product: {getProductByName(selectedProduct || "")?.displayName}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] w-full border rounded-md p-3 bg-muted/20 mb-3">
                {conversation.map((turn) => <ConversationTurnComponent key={turn.id} turn={turn} />)}
                 {isRecording && (interimTranscript || transcript.text) && (
                  <p className="text-sm text-muted-foreground italic px-3 py-1">" {interimTranscript || transcript.text} "</p>
                )}
                {isLoading && <LoadingSpinner size={16} className="mx-auto my-2" />}
                <div ref={conversationEndRef} />
              </ScrollArea>
              
               {error && (
                <Alert variant="destructive" className="mb-3">
                    <Accordion type="single" collapsible>
                      <AccordionItem value="item-1" className="border-b-0">
                        <AccordionTrigger className="p-0 hover:no-underline text-sm font-semibold [&_svg]:ml-1">
                          <div className="flex items-center"><AlertTriangle className="h-4 w-4 mr-2" /> An error occurred. Click to see details.</div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 text-xs">
                          <pre className="whitespace-pre-wrap break-all bg-destructive/10 p-2 rounded-md font-mono">{error}</pre>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                </Alert>
              )}
               <div className="text-xs text-muted-foreground mb-2">Optional: Type a response instead of speaking.</div>
               <UserInputArea
                  onSubmit={(text) => handleUserInputSubmit(text)}
                  disabled={isLoading || isSpeaking || isCallEnded}
                />
            </CardContent>
            <CardFooter className="flex justify-between items-center">
                 <Button onClick={handleEndCall} variant="destructive" size="sm" disabled={isLoading || isCallEnded}>
                   <PhoneOff className="mr-2 h-4 w-4"/> End Interaction & Score
                </Button>
                 <Button onClick={handleReset} variant="outline" size="sm">
                    <Redo className="mr-2 h-4 w-4"/> New Call
                </Button>
            </CardFooter>
          </Card>
        )}

        {isCallEnded && (
          <div className="w-full max-w-4xl mx-auto mt-4 space-y-4">
             {finalStitchedAudioUri ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-md flex items-center"><FileAudio className="mr-2 h-5 w-5 text-primary"/>Full Call Recording</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row items-center gap-4">
                       <audio controls src={finalStitchedAudioUri} className="w-full sm:flex-grow h-10">
                            Your browser does not support the audio element.
                        </audio>
                    </CardContent>
                </Card>
             ) : (
                 <Alert variant="default">
                    <AlertTriangle className="h-4 w-4"/>
                    <AlertTitle>Audio Recording Not Available</AlertTitle>
                    <AlertDescription>The full audio recording for this call could not be generated or saved.</AlertDescription>
                 </Alert>
             )}
            {finalScore && (
                <CallScoringResultsCard 
                    results={finalScore} 
                    fileName={`Interaction: ${selectedProduct} with ${userName || "Customer"}`} 
                    isHistoricalView={true} 
                />
            )}
          </div>
        )}
      </main>
    </div>
  );
}


interface UserInputAreaProps {
  onSubmit: (text: string) => void;
  disabled: boolean;
}
function UserInputArea({ onSubmit, disabled }: UserInputAreaProps) {
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(text.trim()){
      onSubmit(text);
      setText("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type an optional text response here..."
        disabled={disabled}
        autoComplete="off"
      />
      <Button type="submit" disabled={disabled || !text.trim()}>
        <Send className="h-4 w-4"/>
      </Button>
    </form>
  )
}
