
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
import { Badge } from "@/components/ui/badge";
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { useWhisper } from '@/hooks/use-whisper';
import { useProductContext } from '@/hooks/useProductContext';
import { GOOGLE_PRESET_VOICES, SAMPLE_TEXT } from '@/hooks/use-voice-samples';
import { synthesizeSpeechOnClient } from '@/lib/tts-client';
import { scoreCall } from '@/ai/flows/call-scoring';
import { CallScoringResultsCard } from '@/components/features/call-scoring/call-scoring-results-card';
import { runVoiceSalesAgentTurn } from '@/ai/flows/voice-sales-agent-flow';
import { generatePitch } from '@/ai/flows/pitch-generator';


import { 
    Product, SalesPlan, CustomerCohort,
    ConversationTurn, GeneratePitchOutput,
    ScoreCallOutput, KnowledgeFile,
    VoiceSalesAgentFlowInput, VoiceSalesAgentActivityDetails
} from '@/types';

import { PhoneCall, Send, AlertTriangle, Bot, User as UserIcon, Info, Mic, Radio, PhoneOff, Redo, Settings, Volume2, Loader2, SquareTerminal, Star, FileAudio, Copy, Download, PauseCircle, PlayCircle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { exportPlainTextFile, downloadDataUriFile } from '@/lib/export';

// Helper function to prepare Knowledge Base context string
const prepareKnowledgeBaseContext = (
  knowledgeBaseFiles: KnowledgeFile[] | undefined,
  product: Product
): string => {
  if (!knowledgeBaseFiles || !Array.isArray(knowledgeBaseFiles)) {
    return "Knowledge Base not yet loaded or is empty.";
  }
  const productSpecificFiles = knowledgeBaseFiles.filter(f => f.product === product);
  if (productSpecificFiles.length === 0) return "No specific knowledge base content found for this product.";
  
  const MAX_CONTEXT_LENGTH = 15000; 
  let combinedContext = `Knowledge Base Context for Product: ${product}\n---\n`;
  for (const file of productSpecificFiles) {
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

type CallState = "IDLE" | "CONFIGURING" | "LISTENING" | "PROCESSING" | "AI_SPEAKING" | "ENDED" | "ERROR";

const USER_SILENCE_REMINDER_TIMEOUT = 15000; // 15 seconds

export default function VoiceSalesAgentPage() {
  const [callState, setCallState] = useState<CallState>("CONFIGURING");
  const [isClient, setIsClient] = useState(false);

  const [agentName, setAgentName] = useState<string>("");
  const [userName, setUserName] = useState<string>(""); 
  
  const { availableProducts, getProductByName } = useProductContext();
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>("ET");
  
  const productInfo = getProductByName(selectedProduct || "");

  const [selectedSalesPlan, setSelectedSalesPlan] = useState<SalesPlan | undefined>();
  const [selectedEtPlanConfig, setSelectedEtPlanConfig] = useState<string | undefined>();
  const [offerDetails, setOfferDetails] = useState<string>("");
  const [selectedCohort, setSelectedCohort] = useState<CustomerCohort | undefined>("Business Owners");
  
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [currentPitch, setCurrentPitch] = useState<GeneratePitchOutput | null>(null);
  
  const [finalCallArtifacts, setFinalCallArtifacts] = useState<{ transcript: string, audioUri?: string, score?: ScoreCallOutput } | null>(null);
  const [isScoringPostCall, setIsScoringPostCall] = useState(false);
  const [isVoicePreviewPlaying, setIsVoicePreviewPlaying] = useState(false);

  const { toast } = useToast();
  const { logActivity, updateActivity } = useActivityLogger();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const conversationEndRef = useRef<null | HTMLDivElement>(null);
  const currentActivityId = useRef<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const userSilenceTimer = useRef<NodeJS.Timeout | null>(null);
  
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(GOOGLE_PRESET_VOICES[0].id);

  const isCallInProgress = callState !== 'CONFIGURING' && callState !== 'IDLE' && callState !== 'ENDED';
  
  const playAudio = useCallback((audioDataUri: string, turnId: string) => {
    if (audioPlayerRef.current) {
        setCurrentlyPlayingId(turnId);
        setCallState("AI_SPEAKING");
        audioPlayerRef.current.src = audioDataUri;
        audioPlayerRef.current.play().catch(e => {
            console.error("Audio playback error:", e);
            toast({ variant: 'destructive', title: 'Playback Error', description: `Could not play audio: ${(e as Error).message}` });
            setCallState("LISTENING");
        });
    }
  }, [toast]);
  
  const cancelAudio = useCallback(() => {
    if (audioPlayerRef.current && !audioPlayerRef.current.paused) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
    }
    setCurrentlyPlayingId(null);
    if(callState === "AI_SPEAKING") {
        setCallState("LISTENING");
    }
  }, [callState]);

  const synthesizeAndPlay = useCallback(async (text: string, turnId: string) => {
    try {
      const synthesisResult = await synthesizeSpeechOnClient({ text, voice: selectedVoiceId });
      setConversation(prev => prev.map(turn => turn.id === turnId ? { ...turn, audioDataUri: synthesisResult.audioDataUri } : turn));
      playAudio(synthesisResult.audioDataUri, turnId);
    } catch(e: any) {
        toast({variant: 'destructive', title: 'TTS Error', description: e.message});
        setCallState('LISTENING');
    }
  }, [playAudio, selectedVoiceId, toast]);

   const processAgentTurn = useCallback(async (
    currentConversation: ConversationTurn[],
    userInputText?: string,
  ) => {
    if (!selectedProduct || !selectedCohort || !productInfo) {
      toast({ variant: "destructive", title: "Missing Info", description: "Product and Cohort must be selected." });
      setCallState("CONFIGURING");
      return;
    }
    
    setError(null);
    setCallState("PROCESSING");

    const kbContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, selectedProduct as Product);
    
    try {
      const flowInput: VoiceSalesAgentFlowInput = {
        action: "PROCESS_USER_RESPONSE",
        product: selectedProduct as Product,
        productDisplayName: productInfo.displayName, brandName: productInfo.brandName,
        salesPlan: selectedSalesPlan, etPlanConfiguration: selectedEtPlanConfig, offer: offerDetails,
        customerCohort: selectedCohort, agentName, userName,
        knowledgeBaseContext: kbContext, 
        conversationHistory: currentConversation, currentPitchState: currentPitch, 
        currentUserInputText: userInputText,
      };
      
      const flowResult = await runVoiceSalesAgentTurn(flowInput);
      
      if (flowResult.generatedPitch) setCurrentPitch(flowResult.generatedPitch);
      if (flowResult.errorMessage) throw new Error(flowResult.errorMessage);
      
      const aiResponseText = flowResult.currentAiResponseText;

      if (aiResponseText) {
          const aiTurn: ConversationTurn = { id: `ai-${Date.now()}`, speaker: 'AI' as const, text: aiResponseText, timestamp: new Date().toISOString() };
          
          setConversation(prev => [...prev, aiTurn]);
          await synthesizeAndPlay(aiResponseText, aiTurn.id);
      } else {
          setCallState('LISTENING');
      }

      if (flowResult.nextExpectedAction === 'INTERACTION_ENDED') {
        handleEndInteraction();
      }
      
    } catch (e: any) {
      const errorMessage = e.message || "An unexpected error occurred in the sales agent flow.";
      setError(errorMessage);
      setCallState("ERROR");
      const errorTurn: ConversationTurn = { id: `error-${Date.now()}`, speaker: 'AI', text: errorMessage, timestamp: new Date().toISOString() };
      setConversation(prev => [...prev, errorTurn]);
    }
  }, [
      selectedProduct, productInfo, agentName, userName, selectedSalesPlan, selectedEtPlanConfig, offerDetails,
      selectedCohort, 
      currentPitch, knowledgeBaseFiles, synthesizeAndPlay, toast
  ]);
  
  const { startRecording, stopRecording, isRecording } = useWhisper({
    onTranscriptionComplete: (text: string) => {
        if (!text.trim() || callState === 'PROCESSING' || callState === 'CONFIGURING' || callState === 'ENDED') return;
        setInterimTranscript("");
        const userTurn: ConversationTurn = { id: `user-${Date.now()}`, speaker: 'User', text: text, timestamp: new Date().toISOString() };
        
        setConversation(prev => {
            const newConversation = [...prev, userTurn];
            processAgentTurn(newConversation, text);
            return newConversation;
        });
    },
    onTranscribe: (text: string) => {
      if (callState === 'AI_SPEAKING' && text.trim()) {
          cancelAudio();
      }
      setInterimTranscript(text);
    },
    stopTimeout: 1000, 
  });


  const handleEndInteraction = useCallback(() => {
    if (callState === "ENDED") return;
    
    stopRecording();
    const finalConversationState = conversation;
    setCallState("ENDED");
    
    if (!currentActivityId.current) {
        toast({ variant: 'destructive', title: 'Logging Error', description: 'Could not find activity to update. The call may not be saved correctly.'});
        return;
    };
    
    const finalTranscriptText = (finalConversationState ?? []).map(turn => `${turn.speaker}: ${turn.text}`).join('\n');
    setFinalCallArtifacts({ transcript: finalTranscriptText });
    updateActivity(currentActivityId.current, { status: 'Completed', fullTranscriptText: finalTranscriptText, fullConversation: finalConversationState });
    
  }, [callState, updateActivity, toast, conversation, stopRecording]);

  const handleStartConversation = useCallback(async () => {
    if (!userName.trim() || !agentName.trim()) {
        toast({ variant: "destructive", title: "Missing Info", description: "Agent Name and Customer Name are required." });
        return;
    }
     if (!selectedProduct || !selectedCohort || !productInfo) {
        toast({ variant: "destructive", title: "Missing Info", description: "Please select a Product and Customer Cohort." });
        return;
    }
    setConversation([]); setCurrentPitch(null); setFinalCallArtifacts(null);
    setCallState("PROCESSING");
    
    const activityDetails: Partial<VoiceSalesAgentActivityDetails> = {
      input: { product: selectedProduct, customerCohort: selectedCohort, agentName: agentName, userName: userName, voiceName: selectedVoiceId },
      status: 'In Progress'
    };
    const activityId = logActivity({ module: "AI Voice Sales Agent", product: selectedProduct, agentName, details: activityDetails });
    currentActivityId.current = activityId;
    
    try {
        const kbContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, selectedProduct as Product);
        const pitchInput = { product: selectedProduct as Product, customerCohort: selectedCohort, knowledgeBaseContext: kbContext, agentName, userName, brandName: productInfo.brandName };
        const pitchResult = await generatePitch(pitchInput);

        if (pitchResult.pitchTitle.includes("Failed")) {
            throw new Error(`Pitch generation failed: ${pitchResult.warmIntroduction || "Unknown error"}`);
        }
        
        setCurrentPitch(pitchResult);
        const openingText = pitchResult.warmIntroduction || "Hello, how can I help you today?";

        const aiTurn: ConversationTurn = { id: `ai-${Date.now()}`, speaker: 'AI', text: openingText, timestamp: new Date().toISOString() };
        setConversation([aiTurn]);
        
        await synthesizeAndPlay(openingText, aiTurn.id);

    } catch(e: any) {
        const errorMessage = e.message || "Failed to start conversation.";
        setError(errorMessage);
        setCallState("ERROR");
        const errorTurn: ConversationTurn = { id: `error-${Date.now()}`, speaker: 'AI', text: errorMessage, timestamp: new Date().toISOString() };
        setConversation(prev => [...prev, errorTurn]);
    }

  }, [
      userName, agentName, selectedProduct, productInfo, selectedCohort, selectedVoiceId, logActivity, toast, knowledgeBaseFiles, synthesizeAndPlay
  ]);
  
  const handlePreviewVoice = useCallback(async () => {
    setIsVoicePreviewPlaying(true);
    try {
        const result = await synthesizeSpeechOnClient({ text: SAMPLE_TEXT, voice: selectedVoiceId });
        const tempAudio = new Audio(result.audioDataUri);
        tempAudio.play();
        tempAudio.onended = () => setIsVoicePreviewPlaying(false);
        tempAudio.onerror = (e) => {
            console.error("Audio preview playback error:", e);
            toast({variant: 'destructive', title: 'Audio Playback Error', description: 'Could not play the generated voice sample.'});
            setIsVoicePreviewPlaying(false);
        }
    } catch (e: any) {
        toast({variant: 'destructive', title: 'TTS Error', description: e.message});
        setIsVoicePreviewPlaying(false);
    }
  }, [selectedVoiceId, toast]);

  const handleReset = useCallback(() => {
    if (currentActivityId.current && callState !== 'CONFIGURING') {
        const finalConversation = Array.isArray(conversation) ? conversation : [];
        updateActivity(currentActivityId.current, { status: 'Completed (Reset)', fullTranscriptText: finalConversation.map(t => `${t.speaker}: ${t.text}`).join('\n'), fullConversation: finalConversation });
        toast({ title: 'Interaction Logged', description: 'The previous call was logged before resetting.' });
    }
    setCallState("CONFIGURING");
    setConversation([]); setCurrentPitch(null); setFinalCallArtifacts(null);
    setError(null); 
    currentActivityId.current = null;
    setIsScoringPostCall(false);
    if (callState === 'AI_SPEAKING') cancelAudio();
    stopRecording();
  }, [cancelAudio, conversation, updateActivity, toast, callState, stopRecording]);
  
  const handleScorePostCall = async () => {
    if (!finalCallArtifacts || !finalCallArtifacts.transcript || !selectedProduct) {
        toast({variant: 'destructive', title: "Error", description: "No final transcript or product context available to score."});
        return;
    }
    setIsScoringPostCall(true);
    try {
        const productData = getProductByName(selectedProduct);
        const productContext = productData ? prepareKnowledgeBaseContext(knowledgeBaseFiles, selectedProduct as Product) : "No product context available.";

        const scoreOutput = await scoreCall({
            product: selectedProduct as Product,
            agentName: agentName,
            transcriptOverride: finalCallArtifacts.transcript,
            productContext: productContext,
        });

        setFinalCallArtifacts(prev => prev ? { ...prev, score: scoreOutput } : null);
        if (currentActivityId.current) {
            updateActivity(currentActivityId.current, { finalScore: scoreOutput });
        }
        toast({ title: "Scoring Complete!", description: "The call has been scored successfully."});
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Scoring Failed", description: e.message });
    } finally {
        setIsScoringPostCall(false);
    }
  }

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, interimTranscript]);
  
  useEffect(() => {
    if (productInfo && !selectedEtPlanConfig && productInfo.etPlanConfigurations && productInfo.etPlanConfigurations.length > 0) {
      setSelectedEtPlanConfig(productInfo.etPlanConfigurations[0]);
    }
  }, [productInfo, selectedEtPlanConfig]);

  useEffect(() => {
    const audioEl = audioPlayerRef.current;
    const onEnd = () => {
      setCurrentlyPlayingId(null);
      if (callState === "AI_SPEAKING") {
        setCallState('LISTENING');
      }
    };
    if (audioEl) {
        audioEl.addEventListener('ended', onEnd);
    }
    return () => {
        if(audioEl) audioEl.removeEventListener('ended', onEnd);
    };
  }, [callState]); 
  
  // Effect for user silence detection
  useEffect(() => {
    if (userSilenceTimer.current) {
        clearTimeout(userSilenceTimer.current);
    }

    if (callState === 'LISTENING') {
        userSilenceTimer.current = setTimeout(() => {
            if (isRecording) {
                const reminderText = "Are you still there?";
                const aiTurn: ConversationTurn = { id: `ai-reminder-${Date.now()}`, speaker: 'AI', text: reminderText, timestamp: new Date().toISOString() };
                setConversation(prev => [...prev, aiTurn]);
                synthesizeAndPlay(reminderText, aiTurn.id);
            }
        }, USER_SILENCE_REMINDER_TIMEOUT);
    }

    return () => {
        if (userSilenceTimer.current) {
            clearTimeout(userSilenceTimer.current);
        }
    };
  }, [callState, isRecording, synthesizeAndPlay]);

  useEffect(() => {
    if (callState === 'LISTENING' && !isRecording) {
        startRecording();
    } else if (callState !== 'LISTENING' && isRecording) {
        stopRecording();
    }
  }, [callState, isRecording, startRecording, stopRecording]);

  const getCallStatusBadge = () => {
    switch (callState) {
        case "LISTENING":
            return <Badge variant="default" className="text-xs bg-green-100 text-green-800"><Mic className="mr-1.5 h-3.5 w-3.5"/>Listening...</Badge>;
        case "AI_SPEAKING":
            return <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800"><Bot className="mr-1.5 h-3.5 w-3.5"/>AI Speaking (interruptible)</Badge>;
        case "PROCESSING":
            return <Badge variant="secondary" className="text-xs"><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/>Processing...</Badge>;
        case "ENDED":
            return <Badge variant="secondary" className="text-xs bg-gray-200 text-gray-600"><PhoneOff className="mr-1.5 h-3.5 w-3.5"/>Interaction Ended</Badge>;
        case "ERROR":
            return <Badge variant="destructive" className="text-xs"><AlertTriangle className="mr-1.5 h-3.5 w-3.5"/>Error</Badge>;
        default:
            return <Badge variant="outline" className="text-xs">Idle</Badge>;
    }
  }
  
  const availableCohorts = useMemo(() => productInfo?.customerCohorts || [], [productInfo]);
  const availableSalesPlans = useMemo(() => productInfo?.salesPlans || [], [productInfo]);
  const availableEtPlanConfigs = useMemo(() => productInfo?.etPlanConfigurations || [], [productInfo]);

  useEffect(() => {
    if (productInfo && availableCohorts.length > 0 && !availableCohorts.includes(selectedCohort || '')) {
      setSelectedCohort(availableCohorts[0]);
    }
  }, [productInfo, availableCohorts, selectedCohort]);

  return (
    <div className="flex flex-col h-full">
      <audio ref={audioPlayerRef} className="hidden" />
      <PageHeader title="AI Voice Sales Agent" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Radio className="mr-2 h-6 w-6 text-primary"/> Configure AI Voice Call</CardTitle>
            <CardDescription>
                Set up agent, customer, product, and voice profile details before starting the call.
            </CardDescription>
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
                                  {isVoicePreviewPlaying ? <Loader2 className="h-4 w-4 animate-spin"/> : <Volume2 className="h-4 w-4"/>}
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
                                    <SelectContent>
                                      {availableCohorts.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1"><Label htmlFor="agent-name">Agent Name <span className="text-destructive">*</span></Label><Input id="agent-name" placeholder="e.g., Samantha" value={agentName} onChange={e => setAgentName(e.target.value)} disabled={isCallInProgress} /></div>
                            <div className="space-y-1"><Label htmlFor="user-name">Customer Name <span className="text-destructive">*</span></Label><Input id="user-name" placeholder="e.g., Rohan" value={userName} onChange={e => setUserName(e.target.value)} disabled={isCallInProgress} /></div>
                        </div>
                        {isClient && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {selectedProduct === "ET" && availableEtPlanConfigs.length > 0 && (<div className="space-y-1">
                                  <Label htmlFor="et-plan-config-select">ET Plan Configuration (Optional)</Label>
                                  <Select value={selectedEtPlanConfig} onValueChange={(value) => setSelectedEtPlanConfig(value as string)} disabled={isCallInProgress}>
                                      <SelectTrigger id="et-plan-config-select"><SelectValue placeholder="Select ET Plan" /></SelectTrigger>
                                      <SelectContent>{availableEtPlanConfigs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
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
                 <Button onClick={handleStartConversation} disabled={callState !== 'CONFIGURING' || !selectedProduct || !selectedCohort || !userName.trim() || !agentName.trim()} className="w-full mt-4">
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
              <CardDescription>
                Interaction with {userName || "Customer"}. Agent: {agentName || "Default AI"}. Product: {productInfo?.displayName}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] w-full border rounded-md p-3 bg-muted/20 mb-3">
                {conversation.map((turn) => <ConversationTurnComponent 
                    key={turn.id} 
                    turn={turn} 
                    onPlayAudio={playAudio}
                    currentlyPlayingId={currentlyPlayingId}
                />)}
                {isRecording && interimTranscript && (
                  <ConversationTurnComponent turn={{id: 'interim', speaker: 'User', text: interimTranscript, timestamp: new Date().toISOString() }} />
                )}
                {callState === "PROCESSING" && <LoadingSpinner size={16} className="mx-auto my-2" />}
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
                  onSubmit={(text) => {
                    setInterimTranscript(""); // Clear any lingering interim text
                    const userTurn: ConversationTurn = { id: `user-${Date.now()}`, speaker: 'User', text: text, timestamp: new Date().toISOString() };
                    setConversation(prev => {
                        const newConversation = [...prev, userTurn];
                        processAgentTurn(newConversation, text);
                        return newConversation;
                    });
                  }}
                  disabled={callState !== "LISTENING"}
                />
            </CardContent>
            <CardFooter className="flex justify-between items-center">
                 <Button onClick={handleEndInteraction} variant="destructive" size="sm" disabled={callState === "ENDED"}>
                   <PhoneOff className="mr-2 h-4 w-4"/> End Interaction
                </Button>
                 <Button onClick={handleReset} variant="outline" size="sm">
                    <Redo className="mr-2 h-4 w-4"/> New Call
                </Button>
            </CardFooter>
          </Card>
        )}
        
        {finalCallArtifacts && callState === 'ENDED' && (
            <Card className="w-full max-w-4xl mx-auto mt-4">
                <CardHeader>
                    <CardTitle>Call Review & Scoring</CardTitle>
                    <CardDescription>Review the completed call transcript and score the interaction.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="final-transcript">Full Transcript</Label>
                        <Textarea id="final-transcript" value={finalCallArtifacts.transcript} readOnly className="h-40 text-xs bg-muted/50 mt-1"/>
                         <div className="mt-2 flex gap-2">
                             <Button variant="outline" size="xs" onClick={() => exportPlainTextFile(`SalesCall_${userName || 'User'}_transcript.txt`, finalCallArtifacts.transcript)}><Download className="mr-1 h-3"/>Download .txt</Button>
                         </div>
                    </div>
                    <Separator/>
                    {finalCallArtifacts.score ? (
                        <div className="space-y-2">
                            <h4 className="text-md font-semibold">Call Scoring Report</h4>
                            <CallScoringResultsCard 
                                results={finalCallArtifacts.score}
                                fileName={`Simulated Call - ${userName}`}
                                agentName={agentName}
                                product={selectedProduct as Product}
                                isHistoricalView={true}
                            />
                        </div>
                    ) : (
                        <div>
                             <h4 className="text-md font-semibold">Score this Call</h4>
                             <p className="text-sm text-muted-foreground mb-2">Run AI analysis on the final transcript.</p>
                             <Button onClick={handleScorePostCall} disabled={isScoringPostCall || !finalCallArtifacts.transcript}>
                                {isScoringPostCall ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Star className="mr-2 h-4 w-4"/>}
                                {isScoringPostCall ? "Scoring..." : "Run AI Scoring"}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
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
