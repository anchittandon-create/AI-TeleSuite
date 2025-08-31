
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
import { Separator } from '@/components/ui/separator';

import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { useWhisper } from '@/hooks/useWhisper';
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
    VoiceSalesAgentFlowInput, VoiceSalesAgentActivityDetails, ProductObject
} from '@/types';

import { PhoneCall, Send, AlertTriangle, Bot, User as UserIcon, Info, Mic, Radio, PhoneOff, Redo, Settings, Volume2, Loader2, SquareTerminal, Star, FileAudio, Copy, Download, PauseCircle, PlayCircle, Brain, UserCheck } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { exportPlainTextFile, downloadDataUriFile } from '@/lib/export';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format, parseISO } from 'date-fns';


const prepareKnowledgeBaseContext = (
  knowledgeBaseFiles: KnowledgeFile[] | undefined,
  productObject: ProductObject,
  customerCohort?: string
): string => {
    if (!knowledgeBaseFiles || !Array.isArray(knowledgeBaseFiles)) {
        return "Knowledge Base not yet loaded or is empty.";
    }

    const productSpecificFiles = knowledgeBaseFiles.filter(f => f.product === productObject.name);

    const pitchDocs = productSpecificFiles.filter(f => f.category === 'Pitch');
    const productDescDocs = productSpecificFiles.filter(f => f.category === 'Product Description');
    const pricingDocs = productSpecificFiles.filter(f => f.category === 'Pricing');
    const rebuttalDocs = productSpecificFiles.filter(f => f.category === 'Rebuttals');
    const otherDocs = productSpecificFiles.filter(f => !['Pitch', 'Product Description', 'Pricing', 'Rebuttals'].includes(f.category || ''));


    const MAX_TOTAL_CONTEXT_LENGTH = 20000;
    let combinedContext = `--- START OF KNOWLEDGE BASE CONTEXT ---\n`;
    combinedContext += `Product Display Name: ${productObject.displayName}\n`;
    combinedContext += `Brand Name: ${productObject.brandName || 'Not provided'}\n`;
    if (customerCohort) {
        combinedContext += `Target Customer Cohort: ${customerCohort}\n`;
    }
    combinedContext += "--------------------------------------------------\n\n";

    const addSection = (title: string, files: KnowledgeFile[]) => {
        if (files.length > 0) {
            combinedContext += `--- ${title.toUpperCase()} ---\n`;
            files.forEach(file => {
                let itemContext = `Item Name: ${file.name}\nType: ${file.isTextEntry ? 'Text Entry' : file.type}\n`;
                if (file.isTextEntry && file.textContent) {
                    itemContext += `Content:\n${file.textContent.substring(0, 3000)}\n`;
                } else if (!file.isTextEntry) {
                    itemContext += `(This is a ${file.type} file. Its content cannot be read directly; infer context from its name, type, and category.)\n`;
                }
                if (combinedContext.length + itemContext.length <= MAX_TOTAL_CONTEXT_LENGTH) {
                    combinedContext += itemContext + "\n";
                }
            });
            combinedContext += `--- END ${title.toUpperCase()} ---\n\n`;
        }
    };

    addSection("PITCH STRUCTURE & FLOW CONTEXT (Prioritize for overall script structure, opening, and flow)", pitchDocs);
    addSection("PRODUCT DETAILS & FACTS (Prioritize for benefits, features, specifics)", [...productDescDocs, ...rebuttalDocs]);
    addSection("PRICING DETAILS", pricingDocs);
    addSection("GENERAL SUPPLEMENTARY CONTEXT", otherDocs);


    if (productSpecificFiles.length === 0) {
        combinedContext += "No specific knowledge base files or text entries were found for this product.\n";
    }

    combinedContext += `--- END OF KNOWLEDGE BASE CONTEXT ---`;
    return combinedContext;
};

type CallState = "IDLE" | "CONFIGURING" | "LISTENING" | "PROCESSING" | "AI_SPEAKING" | "ENDED" | "ERROR";

export default function VoiceSalesAgentPage() {
  const [callState, setCallState] = useState<CallState>("CONFIGURING");
  const [currentTranscription, setCurrentTranscription] = useState("");
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
  const [error, setError] = useState<string | null>(null);
  const [currentPitch, setCurrentPitch] = useState<GeneratePitchOutput | null>(null);
  
  const [finalCallArtifacts, setFinalCallArtifacts] = useState<{ transcript: string, score?: ScoreCallOutput } | null>(null);
  const [isScoringPostCall, setIsScoringPostCall] = useState(false);
  const [isVoicePreviewPlaying, setIsVoicePreviewPlaying] = useState(false);
  
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [isAutoEnding, setIsAutoEnding] = useState(false);
  
  const { toast } = useToast();
  const { activities, logActivity, updateActivity } = useActivityLogger();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const conversationEndRef = useRef<null | HTMLDivElement>(null);
  const currentActivityId = useRef<string | null>(null);
  
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(GOOGLE_PRESET_VOICES[0].id);

  const isCallInProgress = callState !== 'CONFIGURING' && callState !== 'IDLE' && callState !== 'ENDED';
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  const cancelAudio = useCallback(() => {
    if (audioPlayerRef.current && !audioPlayerRef.current.paused) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = "";
    }
    setCurrentlyPlayingId(null);
    setCurrentWordIndex(-1);
    if (callState === 'AI_SPEAKING') {
        setCallState('LISTENING');
    }
  }, [callState]);

  const onTranscriptionComplete = useCallback((text: string) => {
      if (!text.trim() || callState !== 'LISTENING') return;
      setCurrentTranscription("");
      const userTurn: ConversationTurn = { id: `user-${Date.now()}`, speaker: 'User', text, timestamp: new Date().toISOString() };
      const newConversation = [...conversation, userTurn];
      setConversation(newConversation);
      processAgentTurn(newConversation, text);
    }, [callState, conversation]);

  const { isRecording, startRecording, stopRecording } = useWhisper({
    onTranscriptionComplete: onTranscriptionComplete,
    onTranscribe: (text: string) => {
        // This is the core interruption logic.
        if (callState === 'AI_SPEAKING') {
            cancelAudio();
        }
        setCurrentTranscription(text);
    },
  });
  
  const processAgentTurn = useCallback(async (
    currentConversation: ConversationTurn[],
    userInputText?: string,
  ) => {
    if (!selectedProduct || !selectedCohort || !productInfo) return;
    setError(null);
    setCallState("PROCESSING");

    const kbContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, productInfo, selectedCohort);
    
    const synthesizeAndPlay = async (text: string, turnId: string) => {
      try {
        const textToSynthesize = text.replace(/\bET\b/g, 'E T');
        const synthesisResult = await synthesizeSpeechOnClient({ text: textToSynthesize, voice: selectedVoiceId });
        setConversation(prev => prev.map(turn => turn.id === turnId ? { ...turn, audioDataUri: synthesisResult.audioDataUri } : turn));
        if (audioPlayerRef.current) {
            setCurrentlyPlayingId(turnId);
            setCallState("AI_SPEAKING");
            audioPlayerRef.current.src = synthesisResult.audioDataUri;
            audioPlayerRef.current.play().catch(e => {
                console.error("Audio playback error:", e);
                toast({ variant: 'destructive', title: 'Playback Error', description: `Could not play audio: ${(e as Error).message}` });
                setCallState("LISTENING");
            });
        }
      } catch(e: any) {
          toast({variant: 'destructive', title: 'TTS Error', description: e.message});
          setCallState('LISTENING');
      }
    };
    
    try {
      const flowInput: VoiceSalesAgentFlowInput = {
        action: "PROCESS_USER_RESPONSE",
        product: selectedProduct as Product, productDisplayName: productInfo.displayName, brandName: productInfo.brandName,
        salesPlan: selectedSalesPlan, etPlanConfiguration: selectedEtPlanConfig, offer: offerDetails,
        customerCohort: selectedCohort, agentName, userName,
        knowledgeBaseContext: kbContext, // Pass KB context on every turn
        conversationHistory: currentConversation, currentPitchState: currentPitch, 
        currentUserInputText: userInputText,
      };
      
      const flowResult = await runVoiceSalesAgentTurn(flowInput);
      if (flowResult.generatedPitch) setCurrentPitch(flowResult.generatedPitch);
      
      if (flowResult.errorMessage) {
          throw new Error(flowResult.errorMessage);
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
      const errorMessage = `I'm sorry, I had trouble processing that. Could you please rephrase?`;
      const errorTurn: ConversationTurn = { id: `error-${Date.now()}`, speaker: 'AI', text: errorMessage, timestamp: new Date().toISOString() };
      setConversation(prev => [...prev, errorTurn]);
      setError(e.message);
      await synthesizeAndPlay(errorMessage, errorTurn.id);
    }
  }, [
      selectedProduct, productInfo, agentName, userName, selectedSalesPlan, selectedEtPlanConfig, offerDetails,
      selectedCohort, selectedVoiceId,
      currentPitch, knowledgeBaseFiles, toast
  ]);
  
  const handleScorePostCall = useCallback(async (transcript: string) => {
    if (!transcript || !selectedProduct) return;
    setIsScoringPostCall(true);
    setFinalCallArtifacts(prev => prev ? { ...prev, score: undefined } : { transcript });
    try {
        const productData = getProductByName(selectedProduct);
        if(!productData) throw new Error("Product details not found for scoring.");
        const productContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, productData, selectedCohort);
        const scoreOutput = await scoreCall({ product: selectedProduct as Product, agentName, transcriptOverride: transcript, productContext });

        setFinalCallArtifacts(prev => prev ? { ...prev, score: scoreOutput } : null);
        if (currentActivityId.current) updateActivity(currentActivityId.current, { finalScore: scoreOutput });
        toast({ title: "Scoring Complete!", description: "The call has been scored successfully."});
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Scoring Failed", description: e.message });
    } finally {
        setIsScoringPostCall(false);
    }
  }, [selectedProduct, selectedCohort, getProductByName, knowledgeBaseFiles, agentName, updateActivity, toast]);

  const handleEndInteraction = useCallback(async () => {
    if (callState === "ENDED") return;
    
    stopRecording();
    cancelAudio();
    
    setCallState("ENDED");
    const finalConversation = conversation;
    
    const finalTranscriptText = finalConversation
        .map(turn => `[${format(parseISO(turn.timestamp), 'HH:mm:ss')}] ${turn.speaker.toUpperCase()}:\n${turn.text}`)
        .join('\n\n');

    setFinalCallArtifacts({ transcript: finalTranscriptText });
    
    if (currentActivityId.current) {
        updateActivity(currentActivityId.current, { status: 'Completed', fullTranscriptText: finalTranscriptText, fullConversation: finalConversation });
    }

    await handleScorePostCall(finalTranscriptText);

  }, [callState, updateActivity, conversation, cancelAudio, stopRecording, handleScorePostCall]);


  const handleStartConversation = useCallback(async () => {
    if (!userName.trim() || !agentName.trim() || !selectedProduct || !selectedCohort || !productInfo) {
      toast({ variant: "destructive", title: "Missing Info", description: "Agent Name, Customer Name, Product, and Cohort are required." });
      return;
    }
    setConversation([]); setCurrentPitch(null); setFinalCallArtifacts(null);
    setCallState("PROCESSING");
    
    const lastScoredCall = activities
      .filter(a => a.module === "Call Scoring" && a.product === selectedProduct && a.details && a.details.scoreOutput && a.details.scoreOutput.callCategorisation !== "Error")
      .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    
    const lastCallFeedback = lastScoredCall?.details?.scoreOutput 
      ? `Strengths from last call: ${lastScoredCall.details.scoreOutput.strengths.join(', ')}. Areas to improve from last call: ${lastScoredCall.details.scoreOutput.areasForImprovement.join(', ')}`
      : "No previous call performance data available.";
      
    const activityDetails: Partial<VoiceSalesAgentActivityDetails> = {
      input: { product: selectedProduct, customerCohort: selectedCohort, agentName, userName, voiceName: selectedVoiceId },
      status: 'In Progress',
      lastCallFeedbackContext: lastCallFeedback
    };
    const activityId = logActivity({ module: "AI Voice Sales Agent", product: selectedProduct, agentName, details: activityDetails });
    currentActivityId.current = activityId;
    
    const synthesizeAndPlay = async (text: string, turnId: string) => {
      try {
        const textToSynthesize = text.replace(/\bET\b/g, 'E T');
        const synthesisResult = await synthesizeSpeechOnClient({ text: textToSynthesize, voice: selectedVoiceId });
        setConversation(prev => prev.map(turn => turn.id === turnId ? { ...turn, audioDataUri: synthesisResult.audioDataUri } : turn));
        if (audioPlayerRef.current) {
            setCurrentlyPlayingId(turnId);
            setCallState("AI_SPEAKING");
            audioPlayerRef.current.src = synthesisResult.audioDataUri;
            audioPlayerRef.current.play().catch(e => {
                console.error("Audio playback error:", e);
                toast({ variant: 'destructive', title: 'Playback Error', description: `Could not play audio: ${(e as Error).message}` });
                setCallState("LISTENING");
            });
        }
      } catch(e: any) {
          toast({variant: 'destructive', title: 'TTS Error', description: e.message});
          setCallState('LISTENING');
      }
    };
    
    try {
        const kbContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, productInfo, selectedCohort);
        const pitchInput = { product: selectedProduct as Product, customerCohort: selectedCohort, knowledgeBaseContext: kbContext, agentName, userName, brandName: productInfo.brandName, salesPlan: selectedSalesPlan, etPlanConfiguration: selectedEtPlanConfig, offer: offerDetails };
        const pitchResult = await generatePitch(pitchInput);

        if (pitchResult.pitchTitle.includes("Failed")) throw new Error(`Pitch generation failed: ${pitchResult.warmIntroduction || "Unknown error"}`);
        
        setCurrentPitch(pitchResult);
        const openingText = pitchResult.warmIntroduction || "Hello, how can I help you today?";
        const aiTurn: ConversationTurn = { id: `ai-${Date.now()}`, speaker: 'AI' as const, text: openingText, timestamp: new Date().toISOString()};
        setConversation([aiTurn]);
        
        await synthesizeAndPlay(openingText, aiTurn.id);

    } catch(e: any) {
        const errorMessage = e.message || "Failed to start conversation.";
        setError(errorMessage);
        setCallState("ERROR");
        const errorTurn: ConversationTurn = { id: `error-${Date.now()}`, speaker: 'AI', text: errorMessage, timestamp: new Date().toISOString() };
        setConversation(prev => [...prev, errorTurn]);
    }
  }, [userName, agentName, selectedProduct, productInfo, selectedCohort, selectedVoiceId, selectedSalesPlan, selectedEtPlanConfig, offerDetails, logActivity, toast, knowledgeBaseFiles, activities]);
  
  const handlePreviewVoice = useCallback(async () => {
      const player = previewAudioPlayerRef.current;
      if (player && !player.paused) {
          player.pause();
          return;
      }

      setIsVoicePreviewPlaying(true);
      try {
        const textToSynthesize = SAMPLE_TEXT.replace(/\bET\b/g, 'E T');
        const result = await synthesizeSpeechOnClient({ text: textToSynthesize, voice: selectedVoiceId });
        if (!player) {
          previewAudioPlayerRef.current = new Audio();
        }
        
        previewAudioPlayerRef.current!.src = result.audioDataUri;
        previewAudioPlayerRef.current!.play();
        previewAudioPlayerRef.current!.onended = () => setIsVoicePreviewPlaying(false);
        previewAudioPlayerRef.current!.onpause = () => setIsVoicePreviewPlaying(false);
        previewAudioPlayerRef.current!.onerror = () => {
          toast({variant: 'destructive', title: 'Audio Playback Error'});
          setIsVoicePreviewPlaying(false);
        };
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
    setError(null); currentActivityId.current = null; setIsScoringPostCall(false);
    setCurrentTranscription("");
    cancelAudio(); stopRecording();
  }, [cancelAudio, conversation, updateActivity, toast, callState, stopRecording]);
  
  useEffect(() => {
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation, currentTranscription]);
  
  useEffect(() => {
    const audioEl = audioPlayerRef.current;
    const onEnded = () => {
      setCurrentlyPlayingId(null);
      setCurrentWordIndex(-1);
      if (isAutoEnding) {
          handleEndInteraction();
          setIsAutoEnding(false);
      } else if (callState === "AI_SPEAKING") {
          setCallState('LISTENING');
      }
    };
    const onTimeUpdate = () => {
      if (audioEl && !audioEl.paused && currentlyPlayingId) {
        const turn = conversation.find(t => t.id === currentlyPlayingId);
        if (turn) {
          const words = turn.text.split(/(\s+)/);
          const durationPerWord = audioEl.duration / (words.length || 1);
          const newWordIndex = Math.floor(audioEl.currentTime / durationPerWord);
          setCurrentWordIndex(newWordIndex);
        }
      }
    };
    if (audioEl) {
        audioEl.addEventListener('ended', onEnded);
        audioEl.addEventListener('timeupdate', onTimeUpdate);
        audioEl.addEventListener('pause', onEnded);
    }
    return () => { 
      if(audioEl) {
        audioEl.removeEventListener('ended', onEnded); 
        audioEl.removeEventListener('timeupdate', onTimeUpdate);
        audioEl.removeEventListener('pause', onEnded);
      }
    };
  }, [callState, conversation, currentlyPlayingId, handleEndInteraction, isAutoEnding]); 
  
  useEffect(() => {
    // This is the core logic for managing the microphone state.
    if (callState === 'LISTENING' && !isRecording) {
        startRecording();
    } else if (callState !== 'LISTENING' && isRecording) {
        stopRecording();
    }
  }, [callState, isRecording, startRecording, stopRecording]);

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
  const availableEtPlanConfigs = useMemo(() => productInfo?.etPlanConfigurations || [], [productInfo]);

  useEffect(() => {
    if (productInfo && availableCohorts.length > 0 && !availableCohorts.includes(selectedCohort || '')) {
      setSelectedCohort(availableCohorts[0]);
    }
  }, [productInfo, availableCohorts, selectedCohort]);

  return (
    <div className="flex flex-col h-full">
      <audio ref={audioPlayerRef} className="hidden" />
      <audio ref={previewAudioPlayerRef} className="hidden" />
      <PageHeader title="AI Voice Sales Agent" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Radio className="mr-2 h-6 w-6 text-primary"/> Configure AI Voice Call</CardTitle>
            <CardDescription>Set up agent, customer, product, and voice profile details before starting the call.</CardDescription>
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
                                  {isVoicePreviewPlaying ? <PauseCircle className="h-4 w-4"/> : <PlayCircle className="h-4 w-4"/>}
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
                    currentlyPlayingId={currentlyPlayingId}
                    wordIndex={turn.id === currentlyPlayingId ? currentWordIndex : -1}
                />)}
                {callState === "LISTENING" && (
                   <div className="flex items-start gap-2.5 my-3 justify-end">
                      <div className="flex flex-col gap-1 w-full max-w-[80%] items-end">
                           <Card className="max-w-full w-fit p-3 rounded-xl shadow-sm bg-accent text-accent-foreground rounded-br-none">
                            <CardContent className="p-0 text-sm">
                                <span className="italic">{currentTranscription || " Listening..."}</span>
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
                        <ScrollArea className="h-40 mt-1 border rounded-md p-3">
                           <pre className="text-xs whitespace-pre-wrap break-words font-mono">
                             {finalCallArtifacts.transcript}
                           </pre>
                        </ScrollArea>
                         <div className="mt-2 flex gap-2">
                             <Button variant="outline" size="xs" onClick={() => exportPlainTextFile(`SalesCall_${userName || 'User'}_transcript.txt`, finalCallArtifacts.transcript)}><Download className="mr-1 h-3"/>Download .txt</Button>
                         </div>
                    </div>
                    <Separator/>
                    {isScoringPostCall && !finalCallArtifacts.score && (
                         <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin"/> Scoring in progress...
                         </div>
                    )}
                    {finalCallArtifacts.score && (
                        <div className="space-y-2">
                            <h4 className="text-md font-semibold">Call Scoring Report</h4>
                            <CallScoringResultsCard results={finalCallArtifacts.score} fileName={`Simulated Call - ${userName}`} agentName={agentName} product={selectedProduct as Product} isHistoricalView={true}/>
                        </div>
                    )}
                </CardContent>
            </Card>
        )}
      </main>
    </div>
  );
}
