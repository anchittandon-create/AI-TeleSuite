
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { synthesizeSpeech } from '@/ai/flows/speech-synthesis-flow';


import { 
    SALES_PLANS, ET_PLAN_CONFIGURATIONS,
    Product, SalesPlan, CustomerCohort,
    ConversationTurn, 
    GeneratePitchOutput, ETPlanConfiguration,
    ScoreCallOutput, KnowledgeFile,
    VoiceSalesAgentOption2FlowInput, VoiceSalesAgentFlowOutput,
    VoiceSalesAgentActivityDetails,
} from '@/types';
import { runVoiceSalesAgentOption2Turn } from '@/ai/flows/voice-sales-agent-option2-flow';

import { PhoneCall, Send, AlertTriangle, Bot, SquareTerminal, User as UserIcon, Info, Radio, Mic, Wifi, PhoneOff, Redo, Settings, Volume2, Pause, Sparkles, Loader2, PlayCircle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from '@/lib/utils';
import { GOOGLE_PRESET_VOICES, SAMPLE_TEXT } from '@/hooks/use-voice-samples';
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

const VOICE_AGENT_CUSTOMER_COHORTS: CustomerCohort[] = [
  "Business Owners", "Financial Analysts", "Active Investors", "Corporate Executives", "Young Professionals", "Students",
  "Payment Dropoff", "Paywall Dropoff", "Plan Page Dropoff", "Assisted Buying", "Expired Users",
  "New Prospect Outreach", "Premium Upsell Candidates",
];

const indianFemaleVoiceId = GOOGLE_PRESET_VOICES.find(v => v.name.includes("Indian English - Female"))?.id || "en-IN-Standard-A";


export default function VoiceSalesAgentOption2Page() {
  const [isInteractionStarted, setIsInteractionStarted] = useState(false);
  const [agentName, setAgentName] = useState<string>(""); 
  const [userName, setUserName] = useState<string>(""); 
  
  const { availableProducts, getProductByName } = useProductContext();
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();

  const [selectedSalesPlan, setSelectedSalesPlan] = useState<SalesPlan | undefined>();
  const [selectedEtPlanConfig, setSelectedEtPlanConfig] = useState<ETPlanConfiguration | undefined>();
  const [offerDetails, setOfferDetails] = useState<string>("");
  const [selectedCohort, setSelectedCohort] = useState<CustomerCohort | undefined>();
  
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(indianFemaleVoiceId);
  
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPitch, setCurrentPitch] = useState<GeneratePitchOutput | null>(null);
  const [finalScore, setFinalScore] = useState<ScoreCallOutput | null>(null);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [currentCallStatus, setCurrentCallStatus] = useState<string>("Idle");

  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const [isSamplePlaying, setIsSamplePlaying] = useState(false);

  const { toast } = useToast();
  const { logActivity, updateActivity } = useActivityLogger();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const conversationEndRef = useRef<null | HTMLDivElement>(null);
  const currentActivityId = useRef<string | null>(null);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);
  
  useEffect(() => { if (selectedProduct !== "ET") setSelectedEtPlanConfig(undefined); }, [selectedProduct]);
  
  const handleAudioEnded = useCallback(() => {
    setIsAiSpeaking(false);
    setIsSamplePlaying(false);
    if (isInteractionStarted && !isCallEnded) {
      setCurrentCallStatus("Listening...");
    }
  }, [isInteractionStarted, isCallEnded]);

  const handleUserInterruption = useCallback(() => {
    if (audioPlayerRef.current && !audioPlayerRef.current.paused) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      handleAudioEnded();
    }
  }, [handleAudioEnded]);

  const playAudio = useCallback(async (audioDataUri: string, isSample: boolean = false) => {
    if (audioDataUri && audioDataUri.startsWith("data:audio/")) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = audioDataUri;
        await audioPlayerRef.current.play().catch(e => {
          console.error("Audio playback error:", e);
          setError(`Error playing audio: ${e.message}`);
        });
        if (!isSample) {
          setIsAiSpeaking(true);
          setCurrentCallStatus("AI Speaking...");
        } else {
          setIsSamplePlaying(true);
        }
      }
    } else {
      setError(`Audio Error: Audio data is missing or invalid.`);
    }
  }, []);

  
  const handlePlaySample = useCallback(async () => {
    setIsSamplePlaying(true);
    setError(null);
    try {
        const result = await synthesizeSpeech({textToSpeak: SAMPLE_TEXT, voiceProfileId: selectedVoiceId});
        if (result.audioDataUri && !result.errorMessage) {
            await playAudio(result.audioDataUri, true);
        } else {
            setError(result.errorMessage || "Could not play sample. An unknown TTS error occurred.");
            setIsSamplePlaying(false);
        }
    } catch (e: any) {
        setError(e.message);
        setIsSamplePlaying(false);
    }
  }, [selectedVoiceId, playAudio]);

  const processAgentTurn = useCallback(async (
    action: VoiceSalesAgentOption2FlowInput['action'],
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
    setCurrentCallStatus( action === "START_CONVERSATION" ? "Initiating call..." : action === "END_INTERACTION" ? "Ending..." : "AI thinking...");

    const kbContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, selectedProduct as Product);
    
    let updatedConversation = [...conversation];
    if (userInputText) {
        updatedConversation.push({ id: `user-temp-${Date.now()}`, speaker: 'User', text: userInputText, timestamp: new Date().toISOString(), audioDataUri: userAudioUri });
    }

    try {
        const flowInput: VoiceSalesAgentOption2FlowInput = {
            product: selectedProduct as Product,
            productDisplayName: productInfo.displayName,
            salesPlan: selectedSalesPlan, etPlanConfiguration: selectedProduct === "ET" ? selectedEtPlanConfig : undefined,
            offer: offerDetails, customerCohort: selectedCohort, agentName: agentName, userName: userName,
            knowledgeBaseContext: kbContext, conversationHistory: updatedConversation,
            currentPitchState: currentPitch, action: action,
            currentUserInputText: userInputText,
            voiceProfileId: selectedVoiceId,
        };
        const flowResult: VoiceSalesAgentFlowOutput = await runVoiceSalesAgentOption2Turn(flowInput);
      
      const textToSpeak = flowResult.currentAiSpeech?.text;
      
      if (flowResult.errorMessage) throw new Error(flowResult.errorMessage);
      
      stopRecording();

      let aiAudioUri: string | undefined;
      if(textToSpeak){
          const ttsResult = await synthesizeSpeech({ textToSpeak, voiceProfileId: selectedVoiceId });
          if (ttsResult.errorMessage || !ttsResult.audioDataUri) {
             throw new Error(ttsResult.errorMessage || "TTS failed to produce audio.");
          }
          aiAudioUri = ttsResult.audioDataUri;
          await playAudio(aiAudioUri, false);
          const newTurn: ConversationTurn = { 
              id: `ai-${Date.now()}`, speaker: 'AI', text: textToSpeak, timestamp: new Date().toISOString(), audioDataUri: aiAudioUri
          };
          setConversation(prev => [...prev, newTurn]);
      } else {
          if (!isCallEnded) setCurrentCallStatus("Listening...");
      }
      
      if (flowResult.generatedPitch) setCurrentPitch(flowResult.generatedPitch);
      
      if (flowResult.nextExpectedAction === "INTERACTION_ENDED") {
        setIsCallEnded(true);
        setCurrentCallStatus("Interaction Ended");
        if(currentActivityId.current) {
            updateActivity(currentActivityId.current, {
                status: 'Completed',
                fullConversation: updatedConversation,
                fullTranscriptText: updatedConversation.map(t => `${t.speaker}: ${t.text}`).join('\n')
            });
        }
        toast({ title: 'Interaction Ended', description: 'The call has been logged to the Browser Agent Dashboard for later review and scoring.'});
      }

    } catch (e: any) {
        setError(e.message || "An unexpected error occurred in the sales agent flow.");
        setCurrentCallStatus("Client Error");
    } finally {
      setIsLoading(false);
    }
  }, [selectedProduct, selectedSalesPlan, selectedEtPlanConfig, offerDetails, selectedCohort, agentName, userName, conversation, currentPitch, knowledgeBaseFiles, toast, getProductByName, selectedVoiceId, playAudio, isCallEnded, updateActivity]);
  
  const handleUserInputSubmit = useCallback((text: string, audioDataUri?: string) => {
    if (!text.trim() || isLoading || isAiSpeaking || isCallEnded) return;
    const userTurn: ConversationTurn = { 
        id: `user-${Date.now()}`, speaker: 'User', text: text, timestamp: new Date().toISOString(), audioDataUri: audioDataUri,
    };
    setConversation(prev => [...prev, userTurn]);
    processAgentTurn("PROCESS_USER_RESPONSE", text, audioDataUri);
  }, [isLoading, isAiSpeaking, isCallEnded, processAgentTurn]);

  const { startRecording, stopRecording, isRecording, transcript } = useWhisper({
    onTranscribe: handleUserInterruption,
    onTranscriptionComplete: handleUserInputSubmit,
    captureAudio: true,
    stopTimeout: 300
  });

  const startListening = useCallback(() => {
      if (isInteractionStarted && !isLoading && !isAiSpeaking && !isCallEnded && !isRecording) {
        startRecording();
      }
  }, [isInteractionStarted, isLoading, isAiSpeaking, isCallEnded, isRecording, startRecording]);

  useEffect(() => {
    if (isCallEnded || isAiSpeaking || isLoading) {
        if(isRecording) stopRecording();
    } else if (isInteractionStarted && !isRecording) {
        startListening();
    }
  }, [isCallEnded, isAiSpeaking, isLoading, isInteractionStarted, isRecording, startListening, stopRecording]);


  const handleStartConversation = useCallback(() => {
    if (!userName.trim() || !selectedProduct || !selectedCohort) {
        toast({ variant: "destructive", title: "Missing Info", description: "Please select a Product, Customer Cohort, and enter the Customer's Name." });
        return;
    }
    setConversation([]); setCurrentPitch(null); setFinalScore(null); setIsCallEnded(false); setIsInteractionStarted(true);
    
    const activityDetails: Partial<VoiceSalesAgentActivityDetails> = {
      input: { product: selectedProduct, customerCohort: selectedCohort, agentName: agentName, userName: userName, voiceProfileId: selectedVoiceId },
      status: 'In Progress'
    };
    const activityId = logActivity({ module: "Browser Voice Agent", product: selectedProduct, details: activityDetails });
    currentActivityId.current = activityId;

    processAgentTurn("START_CONVERSATION");
  }, [userName, selectedProduct, selectedCohort, agentName, selectedVoiceId, logActivity, toast, processAgentTurn]);


  const handleEndCall = useCallback(async () => {
    if (audioPlayerRef.current) audioPlayerRef.current.pause();
    stopRecording();
    setIsCallEnded(true);
    setCurrentCallStatus("Ending Interaction...");
    if (isLoading) return;
    
    toast({ title: "Interaction Ended", description: "Processing final data..." });

    const finalTranscriptText = [...conversation, { speaker: 'User', text: transcript.text, timestamp: new Date().toISOString() }]
        .map(t => `${t.speaker}: ${t.text}`).join('\n');
    
    // Log final conversation state
    if (currentActivityId.current) {
        updateActivity(currentActivityId.current, {
            status: 'Completed',
            fullConversation: conversation,
            fullTranscriptText: finalTranscriptText
        });
    }

    // After logging, now score the call
    if (selectedProduct) {
        setCurrentCallStatus("Scoring call...");
        try {
            const score = await scoreCall({
                audioDataUri: "dummy-for-text",
                product: selectedProduct,
                agentName,
            }, finalTranscriptText);
            setFinalScore(score);
            if (currentActivityId.current) {
                updateActivity(currentActivityId.current, { finalScore: score });
            }
            toast({ title: "Call Scored!", description: "Final scoring report is available." });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Scoring Failed", description: e.message });
            setError(`Scoring failed: ${e.message}`);
        }
    }

    setCurrentCallStatus("Call Ended & Scored");

  }, [isLoading, conversation, transcript.text, stopRecording, currentActivityId, updateActivity, toast, selectedProduct, agentName]);


  const handleReset = useCallback(() => {
    setIsInteractionStarted(false); setConversation([]); setCurrentPitch(null); setFinalScore(null); setIsCallEnded(false);
    setError(null); setCurrentCallStatus("Idle"); currentActivityId.current = null;
    if (audioPlayerRef.current) audioPlayerRef.current.pause();
    stopRecording();
  }, [stopRecording]);
  
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Browser Voice Agent" />
      <audio ref={audioPlayerRef} onEnded={handleAudioEnded} className="hidden" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Sparkles className="mr-2 h-6 w-6 text-primary"/> Configure Browser Voice Call</CardTitle>
            <CardDescription>
                This agent uses an external TTS API for high-quality voices and your microphone for input.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                                    <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId} disabled={isInteractionStarted || isSamplePlaying}>
                                        <SelectTrigger className="flex-grow"><SelectValue placeholder="Select a preset voice" /></SelectTrigger>
                                        <SelectContent>
                                            {GOOGLE_PRESET_VOICES.map(voice => (<SelectItem key={voice.id} value={voice.id}>{voice.name}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                    <Button variant="outline" size="icon" onClick={handlePlaySample} disabled={isInteractionStarted || isSamplePlaying} title="Play sample">
                                      {isSamplePlaying ? <Loader2 className="h-4 w-4 animate-spin"/> : <Volume2 className="h-4 w-4"/>}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Select the AI agent's voice.</p>
                             </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-1">
                                <Label htmlFor="product-select-sales-opt2">Product <span className="text-destructive">*</span></Label>
                                <Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={isInteractionStarted}>
                                    <SelectTrigger id="product-select-sales-opt2"><SelectValue placeholder="Select a Product" /></SelectTrigger>
                                    <SelectContent>{availableProducts.map((p) => (<SelectItem key={p.name} value={p.name}>{p.displayName}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1"><Label htmlFor="cohort-select-opt2">Customer Cohort <span className="text-destructive">*</span></Label><Select value={selectedCohort} onValueChange={(val) => setSelectedCohort(val as CustomerCohort)} disabled={isInteractionStarted}><SelectTrigger id="cohort-select-opt2"><SelectValue placeholder="Select Cohort" /></SelectTrigger><SelectContent>{VOICE_AGENT_CUSTOMER_COHORTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1"><Label htmlFor="agent-name-opt2">Agent Name</Label><Input id="agent-name-opt2" placeholder="e.g., Alex (AI Agent)" value={agentName} onChange={e => setAgentName(e.target.value)} disabled={isInteractionStarted} /></div>
                            <div className="space-y-1"><Label htmlFor="user-name-opt2">Customer Name <span className="text-destructive">*</span></Label><Input id="user-name-opt2" placeholder="e.g., Priya Sharma" value={userName} onChange={e => setUserName(e.target.value)} disabled={isInteractionStarted} /></div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {selectedProduct === "ET" && (<div className="space-y-1"><Label htmlFor="et-plan-config-select-opt2">ET Plan Configuration (Optional)</Label><Select value={selectedEtPlanConfig} onValueChange={(val) => setSelectedEtPlanConfig(val as ETPlanConfiguration)} disabled={isInteractionStarted}><SelectTrigger id="et-plan-config-select-opt2"><SelectValue placeholder="Select ET Plan" /></SelectTrigger><SelectContent>{ET_PLAN_CONFIGURATIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>)}
                            <div className="space-y-1"><Label htmlFor="plan-select-opt2">Sales Plan (Optional)</Label><Select value={selectedSalesPlan} onValueChange={(val) => setSelectedSalesPlan(val as SalesPlan)} disabled={isInteractionStarted}><SelectTrigger id="plan-select-opt2"><SelectValue placeholder="Select Sales Plan" /></SelectTrigger><SelectContent>{SALES_PLANS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                             <div className="space-y-1"><Label htmlFor="offer-details-opt2">Offer Details (Optional)</Label><Input id="offer-details-opt2" placeholder="e.g., 20% off" value={offerDetails} onChange={e => setOfferDetails(e.target.value)} disabled={isInteractionStarted} /></div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
            
            {!isInteractionStarted && (
                 <Button onClick={handleStartConversation} disabled={isLoading || !selectedProduct || !selectedCohort || !userName.trim()} className="w-full mt-4">
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
                 <Badge variant={isAiSpeaking ? "outline" : "default"} className={cn("text-xs transition-colors", isAiSpeaking ? "bg-amber-100 text-amber-800" : isRecording ? "bg-red-100 text-red-700" : isCallEnded ? "bg-gray-200 text-gray-600" : "bg-green-100 text-green-800")}>
                    {isRecording ? <Radio className="mr-1.5 h-3.5 w-3.5 text-red-600 animate-pulse"/> : isAiSpeaking ? <Bot className="mr-1.5 h-3.5 w-3.5"/> : isCallEnded ? <PhoneOff className="mr-1.5 h-3.5 w-3.5"/> : <Mic className="mr-1.5 h-3.5 w-3.5"/>}
                    {isRecording ? "Listening..." : isAiSpeaking ? "AI Speaking..." : isCallEnded ? "Interaction Ended" : currentCallStatus}
                </Badge>
              </CardTitle>
              <CardDescription>
                Interaction with {userName || "Customer"}. AI Agent: {agentName || "Default AI"}. Product: {selectedProduct}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] w-full border rounded-md p-3 bg-muted/20 mb-3">
                {conversation.map((turn) => <ConversationTurnComponent key={turn.id} turn={turn} onPlayAudio={(uri) => playAudio(uri, false)} />)}
                 {isRecording && transcript.text && (
                  <p className="text-sm text-muted-foreground italic px-3 py-1">" {transcript.text} "</p>
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
                  onSubmit={(text) => handleUserInputSubmit(text, undefined)}
                  disabled={isLoading || isAiSpeaking || isCallEnded}
                />
            </CardContent>
            <CardFooter className="flex justify-between items-center">
                 <Button onClick={handleReset} variant="outline" size="sm">
                    <Redo className="mr-2 h-4 w-4"/> New Call
                </Button>
                <Button onClick={handleEndCall} variant="destructive" size="sm" disabled={isLoading || isCallEnded}>
                   <PhoneOff className="mr-2 h-4 w-4"/> End Interaction
                </Button>
            </CardFooter>
          </Card>
        )}

        {isCallEnded && finalScore && (
          <div className="w-full max-w-4xl mx-auto mt-4">
             <CallScoringResultsCard 
                results={finalScore} 
                fileName={`Interaction: ${selectedProduct} with ${userName || "Customer"}`} 
                isHistoricalView={true} 
            />
          </div>
        )}
      </main>
    </div>
  );
}


interface UserInputAreaProps {
  onSubmit: (text: string, audioUri?: string) => void;
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
