
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
    ScoreCallOutput, VoiceSalesAgentActivityDetails, KnowledgeFile
} from '@/types';
import { runVoiceSalesAgentTurn } from '@/ai/flows/voice-sales-agent-flow';
import type { VoiceSalesAgentFlowInput, VoiceSalesAgentFlowOutput } from '@/ai/flows/voice-sales-agent-flow';


import { PhoneCall, Send, AlertTriangle, Bot, SquareTerminal, User as UserIcon, Info, Radio, Mic, Wifi, PhoneOff, Redo, Settings, UploadCloud, Dot } from 'lucide-react';
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
    const itemContent = `Item: ${file.name}\nType: ${file.isTextEntry ? 'Text Entry' : file.type}\nContent Summary/Reference:\n${contentToInclude}\n---\n`;
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

const PRESET_VOICES = [
    { id: "Algenib", name: "Raj - Calm Indian Male" },
    { id: "Achernar", name: "Ananya - Friendly Indian Female" },
];

type VoiceSelectionType = 'default' | 'upload' | 'record';


export default function VoiceSalesAgentPage() {
  const { currentProfile: appAgentProfile } = useUserProfile(); 
  const [agentName, setAgentName] = useState<string>(appAgentProfile); 
  const [userName, setUserName] = useState<string>(""); 
  
  const { availableProducts, getProductByName } = useProductContext();
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();

  const [selectedSalesPlan, setSelectedSalesPlan] = useState<SalesPlan | undefined>();
  const [selectedEtPlanConfig, setSelectedEtPlanConfig] = useState<ETPlanConfiguration | undefined>();
  const [offerDetails, setOfferDetails] = useState<string>("");
  const [selectedCohort, setSelectedCohort] = useState<CustomerCohort | undefined>();
  
  // Voice Selection State
  const [voiceSelectionType, setVoiceSelectionType] = useState<VoiceSelectionType>('default');
  const [selectedDefaultVoice, setSelectedDefaultVoice] = useState<string>(PRESET_VOICES[0].id);
  const [uploadedVoiceFile, setUploadedVoiceFile] = useState<File | null>(null);
  const [isRecordingVoiceSample, setIsRecordingVoiceSample] = useState(false);
  const [recordedVoiceSampleName, setRecordedVoiceSampleName] = useState<string | null>(null);

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
    if (!isCallEnded) {
       setCurrentCallStatus("Ready to listen");
    }
  };
  
  const handleUserInterruption = useCallback(() => {
    if (audioPlayerRef.current && !audioPlayerRef.current.paused) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      setIsAiSpeaking(false);
      setCurrentCallStatus("Listening...");
    }
  }, []);

  const playAiAudio = useCallback((audioDataUri: string | undefined) => {
    console.log("playAiAudio received URI (first 100 chars):", audioDataUri?.substring(0, 100));

    if (!audioDataUri || !audioDataUri.startsWith("data:audio") || audioDataUri.length < 1000) {
        console.warn("⚠️ Invalid audioDataUri received from TTS. Skipping playback.", {
            hasUri: !!audioDataUri,
            startsWithDataAudio: audioDataUri?.startsWith("data:audio"),
            isLongEnough: audioDataUri ? audioDataUri.length >= 1000 : false,
            uriContent: audioDataUri?.substring(0, 200)
        });
        toast({ variant: "destructive", title: "Audio Generation Error", description: "The AI's voice could not be generated. Please check server logs." });
        setIsAiSpeaking(false);
        if (!isCallEnded) setCurrentCallStatus("Ready to listen");
        return;
    }
    
    if (audioPlayerRef.current) {
        try {
            console.log("✅ Valid audio URI received, attempting to play now...");
            setIsAiSpeaking(true);
            setCurrentCallStatus("AI Speaking...");
            audioPlayerRef.current.src = audioDataUri;
            audioPlayerRef.current.play().catch(e => {
                console.error("Audio playback error:", e);
                toast({ variant: "destructive", title: "Audio Playback Error", description: "Could not play the AI's audio."});
                setIsAiSpeaking(false);
            });
        } catch(e) {
            console.error("Critical error in playAiAudio:", e);
            toast({ variant: "destructive", title: "Playback System Error", description: "An unexpected error occurred while trying to play audio." });
            setIsAiSpeaking(false);
        }
    }
  }, [toast, isCallEnded]);

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
    let statusMessage = "Processing...";
    if (action === "START_CONVERSATION") statusMessage = "Initiating call...";
    else if (action === "PROCESS_USER_RESPONSE") statusMessage = "AI thinking...";
    else if (action === "GET_REBUTTAL") statusMessage = "AI preparing rebuttal...";
    else if (action === "END_CALL_AND_SCORE") statusMessage = "Ending call & scoring...";
    setCurrentCallStatus(statusMessage);


    const kbContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, selectedProduct as Product);
    let voiceIdToUse = selectedDefaultVoice;
    if (voiceSelectionType === 'upload') voiceIdToUse = `uploaded:${uploadedVoiceFile?.name}`;
    else if (voiceSelectionType === 'record') voiceIdToUse = `recorded:${recordedVoiceSampleName}`;

    const flowInput: VoiceSalesAgentFlowInput = {
      product: selectedProduct as Product,
      productDisplayName: productInfo.displayName,
      salesPlan: selectedSalesPlan, etPlanConfiguration: selectedProduct === "ET" ? selectedEtPlanConfig : undefined,
      offer: offerDetails, customerCohort: selectedCohort, agentName: agentName, userName: userName,
      knowledgeBaseContext: kbContext, conversationHistory: conversation,
      currentUserInputText: userInputText,
      currentPitchState: currentPitch, action: action,
      voiceProfileId: voiceIdToUse
    };

    try {
      const result = await runVoiceSalesAgentTurn(flowInput);
      
      if (result.errorMessage) {
        setError(result.errorMessage);
        toast({ variant: "destructive", title: "Flow Error", description: result.errorMessage, duration: 7000 });
      }

      setConversation(prev => [...prev, ...result.conversationTurns.filter(rt => !prev.find(pt => pt.id === rt.id))]);
      
      if (result.generatedPitch && action === "START_CONVERSATION") setCurrentPitch(result.generatedPitch as GeneratePitchOutput);
      if (result.callScore) {
        setFinalScore(result.callScore as ScoreCallOutput);
        setIsCallEnded(true);
        setCurrentCallStatus("Call Ended & Scored");
        toast({ title: "Call Ended & Scored", description: "The sales call has concluded and been scored." });
      }
      if (result.nextExpectedAction === "CALL_SCORED" || result.nextExpectedAction === "END_CALL_NO_SCORE") {
        setIsCallEnded(true);
        setCurrentCallStatus("Call Ended");
      } else {
        setIsCallEnded(false); 
      }
      
       if (result.currentAiSpeech) {
            playAiAudio(result.currentAiSpeech.audioDataUri);
       } else {
            setIsAiSpeaking(false);
            if (!isCallEnded) setCurrentCallStatus("Ready to listen");
       }
      
      const activityDetails: VoiceSalesAgentActivityDetails = {
        input: {
            product: flowInput.product as Product,
            customerCohort: flowInput.customerCohort as CustomerCohort,
            agentName: flowInput.agentName,
            userName: flowInput.userName,
        },
        finalScore: result.callScore ? { 
            overallScore: result.callScore.overallScore, 
            callCategorisation: result.callScore.callCategorisation,
            summary: result.callScore.summary,
         } : undefined,
        fullTranscriptText: [...conversation, ...result.conversationTurns].map(t => `${t.speaker}: ${t.text}`).join('\n'),
        error: result.errorMessage
      };
      logActivity({ module: "Voice Sales Agent", product: selectedProduct, details: activityDetails });

    } catch (e: any) {
      setError(e.message || "An unexpected error occurred.");
      toast({ variant: "destructive", title: "Interaction Error", description: e.message, duration: 7000 });
      setCurrentCallStatus("Error");
    } finally {
      setIsLoading(false);
    }
  }, [selectedProduct, selectedSalesPlan, selectedEtPlanConfig, offerDetails, selectedCohort, agentName, userName, conversation, currentPitch, knowledgeBaseFiles, logActivity, toast, playAiAudio, isCallEnded, getProductByName, voiceSelectionType, selectedDefaultVoice, uploadedVoiceFile, recordedVoiceSampleName]);
  
  const handleUserInputSubmit = (text: string) => {
    if (!text.trim() || isLoading || isAiSpeaking) return;
    const userTurn: ConversationTurn = {
      id: `user-${Date.now()}`,
      speaker: 'User',
      text: text,
      timestamp: new Date().toISOString()
    };
    setConversation(prev => [...prev, userTurn]);
    processAgentTurn("PROCESS_USER_RESPONSE", text);
  };
  
    const { whisperInstance, transcript, isRecording } = useWhisper({
    onTranscribe: handleUserInterruption,
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
    // Stop any AI speech and recording before ending the call
    if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        setIsAiSpeaking(false);
    }
    if (whisperInstance && isRecording) {
        whisperInstance.stopRecording();
    }
    if (isLoading) return; // Prevent multiple clicks
    processAgentTurn("END_CALL_AND_SCORE");
  };

  const handleReset = () => {
    setIsConversationStarted(false); 
    setConversation([]); 
    setCurrentPitch(null); 
    setFinalScore(null); 
    setIsCallEnded(false);
    setError(null);
    setCurrentCallStatus("Idle");
  };
  
  const handleRecordVoice = () => {
    setIsRecordingVoiceSample(true);
    toast({ title: "Recording Voice Sample...", description: "Recording for 10 seconds to capture voice."});
    setTimeout(() => {
        setIsRecordingVoiceSample(false);
        const sampleName = `recordedVoiceSample-${appAgentProfile}-${Date.now()}.wav`;
        setRecordedVoiceSampleName(sampleName);
        toast({ title: "Voice Sample Saved", description: `Sample saved as ${sampleName}`});
    }, 10000); // Simulate 10 second recording
  };


  return (
    <div className="flex flex-col h-full">
      <PageHeader title={`AI Voice Sales Agent`} />
      <audio ref={audioPlayerRef} onEnded={handleAiAudioEnded} className="hidden" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Wifi className="mr-2 h-6 w-6 text-primary"/> Configure & Initiate Online Sales Call</CardTitle>
            <CardDescription>
              Set up agent, customer, and call context. When you start the call, the AI will initiate the conversation.
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
                           <div className="space-y-1">
                                <Label htmlFor="product-select-sales">Product <span className="text-destructive">*</span></Label>
                                <Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={isConversationStarted}>
                                    <SelectTrigger id="product-select-sales">
                                        <SelectValue placeholder="Select a Product" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableProducts.map((p) => (
                                            <SelectItem key={p.name} value={p.name}>{p.displayName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1"><Label htmlFor="cohort-select">Customer Cohort <span className="text-destructive">*</span></Label><Select value={selectedCohort} onValueChange={(val) => setSelectedCohort(val as CustomerCohort)} disabled={isConversationStarted}><SelectTrigger id="cohort-select"><SelectValue placeholder="Select Cohort" /></SelectTrigger><SelectContent>{VOICE_AGENT_CUSTOMER_COHORTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1"><Label htmlFor="agent-name">Agent Name (for AI dialogue)</Label><Input id="agent-name" placeholder="e.g., Alex (AI Agent)" value={agentName} onChange={e => setAgentName(e.target.value)} disabled={isConversationStarted} /></div>
                            <div className="space-y-1"><Label htmlFor="user-name">Customer Name <span className="text-destructive">*</span></Label><Input id="user-name" placeholder="e.g., Priya Sharma" value={userName} onChange={e => setUserName(e.target.value)} disabled={isConversationStarted} /></div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {selectedProduct === "ET" && (<div className="space-y-1"><Label htmlFor="et-plan-config-select">ET Plan Configuration (Optional)</Label><Select value={selectedEtPlanConfig} onValueChange={(val) => setSelectedEtPlanConfig(val as ETPlanConfiguration)} disabled={isConversationStarted}><SelectTrigger id="et-plan-config-select"><SelectValue placeholder="Select ET Plan Configuration" /></SelectTrigger><SelectContent>{ET_PLAN_CONFIGURATIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>)}
                            <div className="space-y-1"><Label htmlFor="plan-select">Sales Plan (Optional)</Label><Select value={selectedSalesPlan} onValueChange={(val) => setSelectedSalesPlan(val as SalesPlan)} disabled={isConversationStarted}><SelectTrigger id="plan-select"><SelectValue placeholder="Select Sales Plan" /></SelectTrigger><SelectContent>{SALES_PLANS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                             <div className="space-y-1"><Label htmlFor="offer-details">Offer Details (Optional)</Label><Input id="offer-details" placeholder="e.g., 20% off, free gift" value={offerDetails} onChange={e => setOfferDetails(e.target.value)} disabled={isConversationStarted} /></div>
                        </div>
                         <div className="mt-4 pt-4 border-t">
                             <Label>AI Voice Profile <span className="text-destructive">*</span></Label>
                             <RadioGroup value={voiceSelectionType} onValueChange={(v) => setVoiceSelectionType(v as VoiceSelectionType)} className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                                <div className="flex items-center space-x-2"><RadioGroupItem value="default" id="voice-default" /><Label htmlFor="voice-default">Select Default Voice</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="upload" id="voice-upload" disabled/><Label htmlFor="voice-upload" className="text-muted-foreground">Upload Voice Sample (N/A)</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="record" id="voice-record" disabled/><Label htmlFor="voice-record" className="text-muted-foreground">Record Voice Sample (N/A)</Label></div>
                             </RadioGroup>
                              <div className="mt-2 pl-2">
                                 {voiceSelectionType === 'default' && (
                                    <Select value={selectedDefaultVoice} onValueChange={setSelectedDefaultVoice} disabled={isConversationStarted}>
                                        <SelectTrigger><SelectValue placeholder="Select a preset voice" /></SelectTrigger>
                                        <SelectContent>{PRESET_VOICES.map(voice => (<SelectItem key={voice.id} value={voice.id}>{voice.name}</SelectItem>))}</SelectContent>
                                    </Select>
                                 )}
                              </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
            
            {!isConversationStarted && (
                 <Button onClick={handleStartConversation} disabled={isLoading || !selectedProduct || !selectedCohort || !userName.trim()} className="w-full mt-4">
                    <PhoneCall className="mr-2 h-4 w-4"/> Start Online Call with {userName || "Customer"}
                </Button>
            )}
          </CardContent>
        </Card>

        {isConversationStarted && (
          <Card className="w-full max-w-4xl mx-auto mt-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center"><SquareTerminal className="mr-2 h-5 w-5 text-primary"/> Conversation Log</div>
                 <Badge variant={isAiSpeaking ? "outline" : "default"} className={cn("text-xs transition-colors", isAiSpeaking ? "bg-amber-100 text-amber-800" : isRecording ? "bg-red-100 text-red-700" : "bg-green-100 text-green-800")}>
                    {isRecording ? <Radio className="mr-1.5 h-3.5 w-3.5 text-red-600 animate-pulse"/> : isAiSpeaking ? <Bot className="mr-1.5 h-3.5 w-3.5"/> : <Mic className="mr-1.5 h-3.5 w-3.5"/>}
                    {isRecording ? "Listening..." : isAiSpeaking ? "AI Speaking..." : currentCallStatus}
                </Badge>
              </CardTitle>
              <CardDescription>
                Interaction with {userName || "Customer"}. AI Agent: {agentName || "Default AI"}. Product: {selectedProduct}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] w-full border rounded-md p-3 bg-muted/20 mb-3">
                {conversation.map((turn) => <ConversationTurnComponent key={turn.id} turn={turn} onPlayAudio={playAiAudio}/>)}
                 {isRecording && transcript.text && (
                  <p className="text-sm text-muted-foreground italic px-3 py-1">" {transcript.text} "</p>
                )}
                {isLoading && conversation.length > 0 && <LoadingSpinner size={16} className="mx-auto my-2" />}
                <div ref={conversationEndRef} />
              </ScrollArea>
              
               <div className="text-xs text-muted-foreground mb-2">Optional: Type a response instead of speaking.</div>
               <UserInputArea
                  onSubmit={handleUserInputSubmit}
                  disabled={isLoading || isAiSpeaking || isCallEnded}
                />
              
              {error && (
                <Alert variant="destructive" className="mt-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

            </CardContent>
            <CardFooter className="flex justify-between items-center">
                 <Button onClick={handleReset} variant="outline" size="sm">
                    <Redo className="mr-2 h-4 w-4"/> New Call
                </Button>
                <Button onClick={handleEndCall} variant="destructive" size="sm" disabled={isLoading || isCallEnded}>
                   <PhoneOff className="mr-2 h-4 w-4"/> End Interaction &amp; Get Score
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
