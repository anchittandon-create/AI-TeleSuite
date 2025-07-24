
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { VoiceSampleUploader } from '@/components/features/voice-agents/voice-sample-uploader';
import { ConversationTurn as ConversationTurnComponent } from '@/components/features/voice-agents/conversation-turn';
import { CallScoringResultsCard } from '@/components/features/call-scoring/call-scoring-results-card';

import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { useUserProfile } from '@/hooks/useUserProfile';


import { 
    PRODUCTS, SALES_PLANS, CUSTOMER_COHORTS as ALL_CUSTOMER_COHORTS, ET_PLAN_CONFIGURATIONS,
    Product, SalesPlan, CustomerCohort, VoiceProfile, ConversationTurn, 
    GeneratePitchOutput, ETPlanConfiguration,
    ScoreCallOutput, VoiceSalesAgentActivityDetails, KnowledgeFile 
} from '@/types';
import { runVoiceSalesAgentTurn } from '@/ai/flows/voice-sales-agent-flow';
import type { VoiceSalesAgentFlowInput, VoiceSalesAgentFlowOutput } from '@/ai/flows/voice-sales-agent-flow';


import { PhoneCall, Send, AlertTriangle, Bot, ChevronDown, Redo, Zap, SquareTerminal, Smartphone, User as UserIcon, Building, Info, Radio, Mic, Wifi, Square, Circle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from '@/lib/utils';
import { fileToDataUrl } from '@/lib/file-utils';


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


export default function VoiceSalesAgentPage() {
  const { currentProfile: appAgentProfile } = useUserProfile(); 
  const [agentName, setAgentName] = useState<string>(appAgentProfile); 
  const [userName, setUserName] = useState<string>(""); 
  
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const [selectedSalesPlan, setSelectedSalesPlan] = useState<SalesPlan | undefined>();
  const [selectedEtPlanConfig, setSelectedEtPlanConfig] = useState<ETPlanConfiguration | undefined>();
  const [offerDetails, setOfferDetails] = useState<string>("");
  const [selectedCohort, setSelectedCohort] = useState<CustomerCohort | undefined>();
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(null);
  
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [userInputText, setUserInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPitch, setCurrentPitch] = useState<GeneratePitchOutput | null>(null);
  const [finalScore, setFinalScore] = useState<ScoreCallOutput | null>(null);
  const [isConversationStarted, setIsConversationStarted] = useState(false);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [currentAiAction, setCurrentAiAction] = useState<string | null>(null); 
  
  const [isListening, setIsListening] = useState(false); 
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const conversationEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);
  
  useEffect(() => { setAgentName(appAgentProfile); }, [appAgentProfile]);
  useEffect(() => { if (selectedProduct !== "ET") setSelectedEtPlanConfig(undefined); }, [selectedProduct]);

  const playAiAudio = useCallback((audioDataUri: string) => {
    if (audioPlayerRef.current) {
        if (audioDataUri.startsWith("data:audio")) {
            setIsAiSpeaking(true);
            setCurrentAiAction("AI Speaking...");
            audioPlayerRef.current.src = audioDataUri;
            audioPlayerRef.current.play().catch(e => console.error("Audio play error:", e));
        } else {
             toast({ variant: "destructive", title: "TTS Error", description: "Could not play AI speech. Placeholder URI received."});
        }
    }
  }, [toast]);
  
  const handleAiAudioEnded = () => {
    setIsAiSpeaking(false);
    setCurrentAiAction(null);
  };


  const processAgentTurn = useCallback(async (
    action: VoiceSalesAgentFlowInput['action'],
    userInput?: { text?: string; audioDataUri?: string; }
  ) => {
    if (!selectedProduct || !selectedCohort || !userName) {
      toast({ variant: "destructive", title: "Missing Info", description: "Please select Product, Customer Cohort, and enter the Customer's Name." });
      return;
    }
    setIsLoading(true);
    setError(null);
    let aiActionDescription = "Processing...";
    if (action === "START_CONVERSATION") aiActionDescription = "Initiating call...";
    else if (action === "PROCESS_USER_RESPONSE") aiActionDescription = "AI thinking...";
    else if (action === "GET_REBUTTAL") aiActionDescription = "AI preparing rebuttal...";
    else if (action === "END_CALL_AND_SCORE") aiActionDescription = "Ending call & scoring...";
    setCurrentAiAction(aiActionDescription);


    const kbContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, selectedProduct);

    const flowInput: VoiceSalesAgentFlowInput = {
      product: selectedProduct, salesPlan: selectedSalesPlan, etPlanConfiguration: selectedProduct === "ET" ? selectedEtPlanConfig : undefined,
      offer: offerDetails, customerCohort: selectedCohort, agentName: agentName, userName: userName,
      voiceProfileId: voiceProfile?.id, knowledgeBaseContext: kbContext, conversationHistory: conversation,
      currentUserInputText: userInput?.text, currentUserInputAudioDataUri: userInput?.audioDataUri,
      currentPitchState: currentPitch, action: action,
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
        toast({ title: "Call Ended & Scored", description: "The sales call has concluded and been scored." });
      }
      if (result.nextExpectedAction === "CALL_SCORED" || result.nextExpectedAction === "END_CALL_NO_SCORE") setIsCallEnded(true);
      else setIsCallEnded(false); 

      if (result.currentAiSpeech?.audioDataUri) playAiAudio(result.currentAiSpeech.audioDataUri);
      else setIsAiSpeaking(false);
      
       const activityDetails: VoiceSalesAgentActivityDetails = {
         flowInput: {
            product: selectedProduct, customerCohort: selectedCohort, action: action, agentName: agentName, userName: userName,
            salesPlan: selectedSalesPlan, offer: offerDetails, etPlanConfiguration: selectedProduct === "ET" ? selectedEtPlanConfig : undefined,
            voiceProfileId: voiceProfile?.id,
        },
         flowOutput: result, finalScore: result.callScore as ScoreCallOutput | undefined,
         fullTranscriptText: result.conversationTurns.map(t => `${t.speaker}: ${t.text}`).join('\n'),
         simulatedCallRecordingRef: "N/A - Web Interaction", error: result.errorMessage
       };
      logActivity({ module: "Voice Sales Agent", product: selectedProduct, details: activityDetails });

    } catch (e: any) {
      setError(e.message || "An unexpected error occurred.");
      toast({ variant: "destructive", title: "Interaction Error", description: e.message, duration: 7000 });
    } finally {
      setIsLoading(false);
      if (action !== "PROCESS_USER_RESPONSE") setCurrentAiAction(null);
    }
  }, [selectedProduct, selectedSalesPlan, selectedEtPlanConfig, offerDetails, selectedCohort, agentName, userName, voiceProfile, conversation, currentPitch, knowledgeBaseFiles, logActivity, toast, playAiAudio]);

  const handleStartConversation = () => {
    if (!userName.trim()) {
        toast({ variant: "destructive", title: "Missing User Name", description: "Please enter the customer's name." });
        return;
    }
    setConversation([]); setCurrentPitch(null); setFinalScore(null); setIsCallEnded(false); setIsConversationStarted(true);
    processAgentTurn("START_CONVERSATION");
  };

  const handleStopListeningAndProcess = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: audioChunksRef.current[0]?.type || 'audio/webm' });
        audioChunksRef.current = [];
        const audioDataUri = await fileToDataUrl(audioBlob);

        const userTurn: ConversationTurn = {
          id: `user-${Date.now()}`, speaker: 'User', text: '(Voice Input)', timestamp: new Date().toISOString(), audioDataUri,
        };
        setConversation(prev => [...prev, userTurn]);
        await processAgentTurn("PROCESS_USER_RESPONSE", { audioDataUri });
      };
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  }, [processAgentTurn]);

  const handleStartListening = async () => {
    if (isListening || isAiSpeaking) return;
    setIsListening(true);
    setCurrentAiAction("Listening...");
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => audioChunksRef.current.push(event.data);
      recorder.start();
    } catch (err) {
      console.error("Mic access error:", err);
      toast({ variant: "destructive", title: "Microphone Error", description: "Could not access microphone. Please check permissions." });
      setIsListening(false);
      setCurrentAiAction(null);
    }
  };

  const handleEndCall = () => { processAgentTurn("END_CALL_AND_SCORE"); };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Voice Sales Agent" />
      <audio ref={audioPlayerRef} onEnded={handleAiAudioEnded} className="hidden" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Wifi className="mr-2 h-6 w-6 text-primary"/> Configure & Initiate Online Sales Call</CardTitle>
            <CardDescription>
              Set up agent, customer, product, offer, and voice profile. The AI will initiate the interaction and respond based on your inputs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Accordion type="single" collapsible defaultValue="item-config" className="w-full">
                <AccordionItem value="item-config">
                    <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                        <ChevronDown className="mr-2 h-4 w-4 text-accent group-data-[state=open]:rotate-180 transition-transform"/>
                        Call Configuration
                    </AccordionTrigger>
                    <AccordionContent className="pt-3 space-y-3">
                        {/* ... Configuration fields ... */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1"><Label htmlFor="agent-name">Agent Name (for AI dialogue)</Label><Input id="agent-name" placeholder="e.g., Alex (AI Agent)" value={agentName} onChange={e => setAgentName(e.target.value)} disabled={isConversationStarted} /></div>
                            <div className="space-y-1"><Label htmlFor="user-name">Customer Name <span className="text-destructive">*</span></Label><Input id="user-name" placeholder="e.g., Priya Sharma" value={userName} onChange={e => setUserName(e.target.value)} disabled={isConversationStarted} /></div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1"><Label htmlFor="product-select">Product <span className="text-destructive">*</span></Label><Select value={selectedProduct} onValueChange={(val) => setSelectedProduct(val as Product)} disabled={isConversationStarted}><SelectTrigger id="product-select"><SelectValue placeholder="Select Product" /></SelectTrigger><SelectContent>{PRODUCTS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                            <div className="space-y-1"><Label htmlFor="cohort-select">Customer Cohort <span className="text-destructive">*</span></Label><Select value={selectedCohort} onValueChange={(val) => setSelectedCohort(val as CustomerCohort)} disabled={isConversationStarted}><SelectTrigger id="cohort-select"><SelectValue placeholder="Select Cohort" /></SelectTrigger><SelectContent>{VOICE_AGENT_CUSTOMER_COHORTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                        </div>
                        {selectedProduct === "ET" && (<div className="space-y-1"><Label htmlFor="et-plan-config-select">ET Plan Configuration (Optional)</Label><Select value={selectedEtPlanConfig} onValueChange={(val) => setSelectedEtPlanConfig(val as ETPlanConfiguration)} disabled={isConversationStarted}><SelectTrigger id="et-plan-config-select"><SelectValue placeholder="Select ET Plan Configuration" /></SelectTrigger><SelectContent>{ET_PLAN_CONFIGURATIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>)}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1"><Label htmlFor="plan-select">Sales Plan (Optional)</Label><Select value={selectedSalesPlan} onValueChange={(val) => setSelectedSalesPlan(val as SalesPlan)} disabled={isConversationStarted}><SelectTrigger id="plan-select"><SelectValue placeholder="Select Sales Plan" /></SelectTrigger><SelectContent>{SALES_PLANS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                             <div className="space-y-1"><Label htmlFor="offer-details">Offer Details (Optional)</Label><Input id="offer-details" placeholder="e.g., 20% off, free gift" value={offerDetails} onChange={e => setOfferDetails(e.target.value)} disabled={isConversationStarted} /></div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-voice">
                     <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                        <ChevronDown className="mr-2 h-4 w-4 text-accent group-data-[state=open]:rotate-180 transition-transform"/>
                        AI Voice Profile
                    </AccordionTrigger>
                    <AccordionContent className="pt-3">
                        <VoiceSampleUploader onVoiceProfileCreated={(profile) => setVoiceProfile(profile)} isLoading={isLoading || isConversationStarted} />
                        {voiceProfile && (<Alert className="mt-3 bg-blue-50 border-blue-200"><Bot className="h-4 w-4 text-blue-600" /><AlertTitle className="text-blue-700">Active Voice Profile</AlertTitle><AlertDescription className="text-blue-600 text-xs">ID: {voiceProfile.name}. A standard TTS voice will be used.<Button variant="link" size="xs" className="ml-2 h-auto p-0 text-blue-700" onClick={() => setVoiceProfile(null)} disabled={isConversationStarted}>Change</Button></AlertDescription></Alert>)}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
            
            {!isConversationStarted && (
                 <Button onClick={handleStartConversation} disabled={isLoading || !selectedProduct || !selectedCohort || !userName.trim()} className="w-full mt-4">
                    <Wifi className="mr-2 h-4 w-4"/> Start Online Call with {userName || "Customer"}
                </Button>
            )}
          </CardContent>
        </Card>

        {isConversationStarted && (
          <Card className="w-full max-w-4xl mx-auto mt-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <SquareTerminal className="mr-2 h-5 w-5 text-primary"/> Conversation Log
              </CardTitle>
              <CardDescription>
                Interaction with {userName || "Customer"}. AI Agent: {agentName || "Default AI"}. 
                {currentAiAction && <span className="ml-2 text-xs text-muted-foreground italic">({currentAiAction})</span>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] w-full border rounded-md p-3 bg-muted/20 mb-3">
                {conversation.map((turn) => <ConversationTurnComponent key={turn.id} turn={turn} />)}
                {isLoading && conversation.length > 0 && <LoadingSpinner size={16} className="mx-auto my-2" />}
                <div ref={conversationEndRef} />
              </ScrollArea>
              
              {!isCallEnded && (
                <div className="flex justify-center items-center h-24">
                  <Button
                    onMouseDown={handleStartListening}
                    onMouseUp={handleStopListeningAndProcess}
                    onTouchStart={handleStartListening}
                    onTouchEnd={handleStopListeningAndProcess}
                    disabled={isAiSpeaking || isLoading}
                    className={cn(
                      "h-20 w-20 rounded-full transition-all duration-200 flex flex-col items-center justify-center",
                      isListening ? "bg-red-500 hover:bg-red-600 scale-110" : "bg-primary hover:bg-primary/90",
                      (isAiSpeaking || isLoading) && "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    <Mic size={32} />
                    <span className="text-xs mt-1">{isListening ? "Listening..." : "Hold to Speak"}</span>
                  </Button>
                </div>
              )}
              
              {error && (
                <Alert variant="destructive" className="mt-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

            </CardContent>
            <CardFooter className="flex justify-between items-center">
                 <Button onClick={() => { setIsConversationStarted(false); setConversation([]); setCurrentPitch(null); setFinalScore(null); setIsCallEnded(false); setUserInputText(""); }} variant="outline" size="sm">
                    New Interaction / Reset
                </Button>
                {!isCallEnded && (
                    <Button onClick={handleEndCall} variant="destructive" size="sm" disabled={isLoading || isAiSpeaking}>
                        End Interaction & Get Score
                    </Button>
                )}
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
