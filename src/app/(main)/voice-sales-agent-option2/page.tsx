
"use client";

import React, { useState, useEffect, useRef, useCallback, ChangeEvent } from 'react';
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
import { useUserProfile } from '@/hooks/useUserProfile';
import { useWhisper } from '@/hooks/use-whisper';
import { useProductContext } from '@/hooks/useProductContext';

import { 
    SALES_PLANS, CUSTOMER_COHORTS as ALL_CUSTOMER_COHORTS, ET_PLAN_CONFIGURATIONS,
    Product, SalesPlan, CustomerCohort,
    ConversationTurn, 
    GeneratePitchOutput, ETPlanConfiguration,
    ScoreCallOutput, VoiceSalesAgentActivityDetails, KnowledgeFile,
    VoiceSalesAgentFlowInput
} from '@/types';
import { runVoiceSalesAgentTurnOption2 } from '@/ai/flows/voice-sales-agent-option2-flow';
// synthesizeSpeechWithOpenTTS is now a client-side function
import { synthesizeSpeechWithOpenTTS } from '@/ai/flows/speech-synthesis-opentts-flow';

import { PhoneCall, Send, AlertTriangle, Bot, SquareTerminal, User as UserIcon, Info, Radio, Mic, Wifi, PhoneOff, Redo, Settings, Volume2, Loader2, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from '@/lib/utils';

// Helper to prepare Knowledge Base context
const prepareKnowledgeBaseContext = (
  knowledgeBaseFiles: KnowledgeFile[],
  product: Product
): string => {
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

// Cohorts for Voice Sales Agent, consistent with Pitch Generator requirements
const VOICE_AGENT_CUSTOMER_COHORTS: CustomerCohort[] = [
  "Business Owners", "Financial Analysts", "Active Investors", "Corporate Executives", "Young Professionals", "Students",
  "Payment Dropoff", "Paywall Dropoff", "Plan Page Dropoff", "Assisted Buying", "Expired Users",
  "New Prospect Outreach", "Premium Upsell Candidates",
];

const SAMPLE_TEXT = "Hello, this is a sample of the selected voice that you can listen to from your local OpenTTS server.";
// Updated with Female voices
const OPENTTS_VOICES = [
    { id: 'en-us-hfc_female-medium', name: 'Female US English' },
    { id: 'hi-in-hfc_female-medium', name: 'Female Indian Hindi' },
    { id: 'en-in-hfc_male-medium', name: 'Male Indian English' },
    { id: 'hi-in-hfc_male-medium', name: 'Male Indian Hindi' },
];


export default function VoiceSalesAgentOption2Page() {
  const { currentProfile: appAgentProfile } = useUserProfile(); 
  const [agentName, setAgentName] = useState<string>(appAgentProfile); 
  const [userName, setUserName] = useState<string>(""); 
  
  const { availableProducts, getProductByName } = useProductContext();
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  
  const [selectedSalesPlan, setSelectedSalesPlan] = useState<SalesPlan | undefined>();
  const [selectedEtPlanConfig, setSelectedEtPlanConfig] = useState<ETPlanConfiguration | undefined>();
  const [offerDetails, setOfferDetails] = useState<string>("");
  const [selectedCohort, setSelectedCohort] = useState<CustomerCohort | undefined>();
  
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(OPENTTS_VOICES[0].id);
  const [isSamplePlaying, setIsSamplePlaying] = useState(false);

  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPitch, setCurrentPitch] = useState<GeneratePitchOutput | null>(null);
  const [finalScore, setFinalScore] = useState<ScoreCallOutput | null>(null);
  const [isConversationStarted, setIsConversationStarted] = useState(false);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [currentCallStatus, setCurrentCallStatus] = useState<string>("Idle");
  
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);

  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const conversationEndRef = useRef<null | HTMLDivElement>(null);
  
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);
  
  useEffect(() => { setAgentName(appAgentProfile); }, [appAgentProfile]);
  
  useEffect(() => { if (selectedProduct !== "ET") setSelectedEtPlanConfig(undefined); }, [selectedProduct]);

  const handleAiAudioEnded = () => {
    setIsAiSpeaking(false);
    setIsSamplePlaying(false);
    if (!isCallEnded) setCurrentCallStatus("Listening...");
  };
  
  const handleUserInterruption = useCallback(() => {
    if (audioPlayerRef.current && !audioPlayerRef.current.paused) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      setIsAiSpeaking(false);
      setIsSamplePlaying(false);
      setCurrentCallStatus("Listening...");
    }
  }, []);

  const playAiAudio = useCallback(async (audioDataUri: string) => {
    if (audioDataUri && audioDataUri.startsWith("data:audio/")) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = audioDataUri;
        audioPlayerRef.current.play().catch(console.error);
        setIsAiSpeaking(true);
        setCurrentCallStatus("AI Speaking...");
      }
    } else {
        const errorMessage = `Audio Error: Audio data is missing or invalid.`;
        setError(errorMessage);
    }
  }, []);

  const handlePlaySample = async () => {
    setIsSamplePlaying(true);
    setError(null);
    try {
        const result = await synthesizeSpeechWithOpenTTS({textToSpeak: SAMPLE_TEXT, voiceProfileId: selectedVoiceId});
        if (result.audioDataUri && !result.errorMessage) {
            await playAiAudio(result.audioDataUri);
        } else {
            setError(result.errorMessage || "Could not play sample. An unknown OpenTTS error occurred.");
            setIsSamplePlaying(false);
        }
    } catch (e: any) {
        setError(e.message);
        setIsSamplePlaying(false);
    }
  };

  const processAgentTurn = useCallback(async (
    action: VoiceSalesAgentFlowInput['action'],
    userInputText?: string
  ) => {
    const productInfo = getProductByName(selectedProduct || "");
    if (!selectedProduct || !selectedCohort || !userName.trim() || !productInfo) {
      toast({ variant: "destructive", title: "Missing Info", description: "Please select a Product, Customer Cohort, and enter the Customer's Name." });
      return;
    }
    setIsLoading(true);
    setError(null);
    setCurrentCallStatus( action === "START_CONVERSATION" ? "Initiating call..." : "AI thinking...");

    const kbContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, selectedProduct as Product);
    
    const flowInput: VoiceSalesAgentFlowInput = {
      product: selectedProduct as Product,
      productDisplayName: productInfo.displayName,
      salesPlan: selectedSalesPlan, etPlanConfiguration: selectedProduct === "ET" ? selectedEtPlanConfig : undefined,
      offer: offerDetails, customerCohort: selectedCohort, agentName: agentName, userName: userName,
      knowledgeBaseContext: kbContext, conversationHistory: conversation,
      currentPitchState: currentPitch, action: action,
      currentUserInputText: userInputText,
      voiceProfileId: selectedVoiceId
    };

    try {
      // First, get the text response from the AI logic flow
      const logicResult = await runVoiceSalesAgentTurnOption2(flowInput);
      
      if (logicResult.errorMessage) {
        throw new Error(logicResult.errorMessage);
      }

      const textToSpeak = logicResult.conversationTurns.find(t => t.speaker === "AI")?.text;

      if (textToSpeak) {
          // Then, generate audio for that text using the client-side OpenTTS function
          const audioResult = await synthesizeSpeechWithOpenTTS({ textToSpeak, voiceProfileId: selectedVoiceId });
          if(audioResult.errorMessage) throw new Error(audioResult.errorMessage);

          // Update the turn with the generated audio
          const aiTurn = logicResult.conversationTurns.find(t => t.speaker === "AI");
          if(aiTurn) aiTurn.audioDataUri = audioResult.audioDataUri;
          
          setConversation(prev => [...prev, ...logicResult.conversationTurns]);
          if(audioResult.audioDataUri) await playAiAudio(audioResult.audioDataUri);

      } else {
          setConversation(prev => [...prev, ...logicResult.conversationTurns]);
      }
      
      if (logicResult.generatedPitch) setCurrentPitch(logicResult.generatedPitch);
      if (logicResult.callScore) {
        setFinalScore(logicResult.callScore);
        setIsCallEnded(true);
        setCurrentCallStatus("Call Ended & Scored");
      }
      if (logicResult.nextExpectedAction === "CALL_SCORED" || logicResult.nextExpectedAction === "END_CALL_NO_SCORE") {
        setIsCallEnded(true);
        setCurrentCallStatus("Call Ended");
      }
    } catch (e: any) {
        setError(e.message || "An unexpected error occurred in the sales agent flow.");
        setCurrentCallStatus("Client Error");
    } finally {
      setIsLoading(false);
    }
  }, [selectedProduct, selectedSalesPlan, selectedEtPlanConfig, offerDetails, selectedCohort, agentName, userName, conversation, currentPitch, knowledgeBaseFiles, toast, isCallEnded, getProductByName, selectedVoiceId, playAiAudio]);
  
  const handleUserInputSubmit = (text: string) => {
    if (!text.trim() || isLoading || isAiSpeaking) return;
    const userTurn: ConversationTurn = { id: `user-opt2-${Date.now()}`, speaker: 'User', text, timestamp: new Date().toISOString() };
    setConversation(prev => [...prev, userTurn]);
    processAgentTurn("PROCESS_USER_RESPONSE", text);
  };
  
  const { whisperInstance, transcript, isRecording } = useWhisper({
    onTranscribe: (text) => {
        handleUserInterruption();
    },
    onTranscriptionComplete: (completedTranscript) => {
      if (completedTranscript.trim().length > 2 && !isLoading) {
        handleUserInputSubmit(completedTranscript);
      }
    },
    autoStart: isConversationStarted && !isLoading && !isAiSpeaking,
    autoStop: true,
    stopTimeout: 1200,
  });

  const handleStartConversation = () => {
    if (!userName.trim() || !selectedProduct || !selectedCohort) {
        toast({ variant: "destructive", title: "Missing Info", description: "Please select a Product, Customer Cohort, and enter the Customer's Name." });
        return;
    }
    setConversation([]); setCurrentPitch(null); setFinalScore(null); setIsCallEnded(false); setIsConversationStarted(true);
    processAgentTurn("START_CONVERSATION");
  };

  const handleEndCall = () => {
    if (audioPlayerRef.current) audioPlayerRef.current.pause();
    if (whisperInstance && isRecording) {
        whisperInstance.stopRecording?.();
    }
    if (isLoading) return;
    processAgentTurn("END_CALL_AND_SCORE");
  };

  const handleReset = () => {
    setIsConversationStarted(false); setConversation([]); setCurrentPitch(null); setFinalScore(null); setIsCallEnded(false); setError(null); setCurrentCallStatus("Idle");
  };
  
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Voice Sales Agent (Option 2 - OpenTTS)" />
      <audio ref={audioPlayerRef} onEnded={handleAiAudioEnded} className="hidden" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Wifi className="mr-2 h-6 w-6 text-primary"/> Configure Call (Self-Hosted TTS)</CardTitle>
            <CardDescription>
              This sales agent uses a self-hosted engine like OpenTTS, expected to be running on your local machine.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Accordion type="single" collapsible defaultValue={isConversationStarted ? "" : "item-config"} className="w-full">
                <AccordionItem value="item-config">
                    <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90 [&[data-state=open]>&svg]:rotate-180">
                        <div className="flex items-center"><Settings className="mr-2 h-4 w-4 text-accent"/>Call Configuration</div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-3 space-y-3">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-1"><Label htmlFor="product-select-sales-opt2">Product <span className="text-destructive">*</span></Label><Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={isConversationStarted}><SelectTrigger id="product-select-sales-opt2"><SelectValue placeholder="Select a Product" /></SelectTrigger><SelectContent>{availableProducts.map((p) => (<SelectItem key={p.name} value={p.name}>{p.displayName}</SelectItem>))}</SelectContent></Select></div>
                           <div className="space-y-1"><Label htmlFor="cohort-select-opt2">Customer Cohort <span className="text-destructive">*</span></Label><Select value={selectedCohort} onValueChange={(val) => setSelectedCohort(val as CustomerCohort)} disabled={isConversationStarted}><SelectTrigger id="cohort-select-opt2"><SelectValue placeholder="Select Cohort" /></SelectTrigger><SelectContent>{VOICE_AGENT_CUSTOMER_COHORTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1"><Label htmlFor="agent-name-opt2">Agent Name (for AI dialogue)</Label><Input id="agent-name-opt2" placeholder="e.g., Alex (AI Agent)" value={agentName} onChange={e => setAgentName(e.target.value)} disabled={isConversationStarted} /></div>
                            <div className="space-y-1"><Label htmlFor="user-name-opt2">Customer Name <span className="text-destructive">*</span></Label><Input id="user-name-opt2" placeholder="e.g., Priya Sharma" value={userName} onChange={e => setUserName(e.target.value)} disabled={isConversationStarted} /></div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {selectedProduct === "ET" && (<div className="space-y-1"><Label htmlFor="et-plan-config-select-opt2">ET Plan Configuration (Optional)</Label><Select value={selectedEtPlanConfig} onValueChange={(val) => setSelectedEtPlanConfig(val as ETPlanConfiguration)} disabled={isConversationStarted}><SelectTrigger id="et-plan-config-select-opt2"><SelectValue placeholder="Select ET Plan Configuration" /></SelectTrigger><SelectContent>{ET_PLAN_CONFIGURATIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>)}
                            <div className="space-y-1"><Label htmlFor="plan-select-opt2">Sales Plan (Optional)</Label><Select value={selectedSalesPlan} onValueChange={(val) => setSelectedSalesPlan(val as SalesPlan)} disabled={isConversationStarted}><SelectTrigger id="plan-select-opt2"><SelectValue placeholder="Select Sales Plan" /></SelectTrigger><SelectContent>{SALES_PLANS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                             <div className="space-y-1"><Label htmlFor="offer-details-opt2">Offer Details (Optional)</Label><Input id="offer-details-opt2" placeholder="e.g., 20% off, free gift" value={offerDetails} onChange={e => setOfferDetails(e.target.value)} disabled={isConversationStarted} /></div>
                        </div>
                         <div className="mt-4 pt-4 border-t">
                             <Label>AI Voice Profile (from OpenTTS)</Label>
                             <div className="mt-2 flex items-center gap-2">
                                <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId} disabled={isConversationStarted || isSamplePlaying}>
                                    <SelectTrigger className="flex-grow"><SelectValue placeholder="Select a preset voice" /></SelectTrigger>
                                    <SelectContent>
                                        {OPENTTS_VOICES.map(voice => (<SelectItem key={voice.id} value={voice.id}>{voice.name}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                                <Button variant="outline" size="icon" onClick={handlePlaySample} disabled={isConversationStarted || isSamplePlaying} title="Play sample">
                                    {isSamplePlaying ? <Loader2 className="h-4 w-4 animate-spin"/> : <Volume2 className="h-4 w-4"/>}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Select a voice supported by your local OpenTTS instance.</p>
                         </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
            
            {!isConversationStarted && (
                 <Button onClick={handleStartConversation} disabled={isLoading || !selectedProduct || !selectedCohort || !userName.trim() } className="w-full mt-4">
                    <PhoneCall className="mr-2 h-4 w-4"/> Start Online Call
                </Button>
            )}
          </CardContent>
        </Card>

        {isConversationStarted && (
          <Card className="w-full max-w-4xl mx-auto mt-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center"><SquareTerminal className="mr-2 h-5 w-5 text-primary"/> Conversation Log (OpenTTS)</div>
                 <Badge variant={isAiSpeaking ? "outline" : "default"} className={cn("text-xs transition-colors", isAiSpeaking ? "bg-amber-100 text-amber-800" : isRecording ? "bg-red-100 text-red-700" : "bg-green-100 text-green-800")}>
                    {isRecording ? <Radio className="mr-1.5 h-3.5 w-3.5 text-red-600 animate-pulse"/> : isAiSpeaking ? <Bot className="mr-1.5 h-3.5 w-3.5"/> : <Mic className="mr-1.5 h-3.5 w-3.5"/>}
                    {isRecording ? "Listening..." : isAiSpeaking ? "AI Speaking..." : currentCallStatus}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] w-full border rounded-md p-3 bg-muted/20 mb-3">
                {conversation.map((turn) => <ConversationTurnComponent key={turn.id} turn={turn} onPlayAudio={(uri) => playAiAudio(uri)} />)}
                 {isRecording && transcript.text && (
                  <p className="text-sm text-muted-foreground italic px-3 py-1">" {transcript.text} "</p>
                )}
                {isLoading && conversation.length > 0 && <LoadingSpinner size={16} className="mx-auto my-2" />}
                <div ref={conversationEndRef} />
              </ScrollArea>
              
               {error && (
                <Alert variant="destructive" className="mb-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Audio Generation Error</AlertTitle>
                  <AlertDescription className="space-y-1">
                    <p>{error}</p>
                    <p className="text-xs font-medium">This usually means the local OpenTTS server is not running or is not accessible. Please ensure it is active at `http://localhost:5500` and try again.</p>
                    <a href="https://github.com/synesthesiam/opentts" target="_blank" rel="noopener noreferrer" className="text-xs text-destructive-foreground underline flex items-center gap-1 hover:text-white">
                        <ExternalLink size={12} /> OpenTTS Setup Instructions
                    </a>
                  </AlertDescription>
                </Alert>
              )}
               <UserInputArea onSubmit={handleUserInputSubmit} disabled={isLoading || isAiSpeaking || isCallEnded}/>
            </CardContent>
            <CardFooter className="flex justify-between items-center">
                 <Button onClick={handleReset} variant="outline" size="sm"><Redo className="mr-2 h-4 w-4"/> New Call</Button>
                <Button onClick={handleEndCall} variant="destructive" size="sm" disabled={isLoading || isCallEnded}><PhoneOff className="mr-2 h-4 w-4"/> End Interaction & Get Score</Button>
            </CardFooter>
          </Card>
        )}

        {isCallEnded && finalScore && (
          <div className="w-full max-w-4xl mx-auto mt-4">
             <CallScoringResultsCard results={finalScore} fileName={`Interaction (Opt 2): ${selectedProduct} with ${userName || "Customer"}`} isHistoricalView={true} />
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
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type an optional text response here..." disabled={disabled} autoComplete="off"/>
      <Button type="submit" disabled={disabled || !text.trim()}><Send className="h-4 w-4"/></Button>
    </form>
  )
}
