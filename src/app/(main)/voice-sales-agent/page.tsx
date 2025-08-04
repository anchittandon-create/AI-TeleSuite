
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
import { Badge } from "@/components/ui/badge";

import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { useWhisper } from '@/hooks/useWhisper';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { useProductContext } from '@/hooks/useProductContext';

import { 
    SALES_PLANS, ET_PLAN_CONFIGURATIONS,
    Product, SalesPlan, CustomerCohort,
    ConversationTurn, GeneratePitchOutput, ETPlanConfiguration,
    ScoreCallOutput, KnowledgeFile,
    VoiceSalesAgentFlowInput,
    VoiceSalesAgentActivityDetails,
} from '@/types';
import { runVoiceSalesAgentTurn } from '@/ai/flows/voice-sales-agent-flow';

import { PhoneCall, Send, AlertTriangle, Bot, User as UserIcon, Info, Radio, Mic, Wifi, PhoneOff, Redo, Settings, Volume2, Pause, PlayCircle, SquareTerminal } from 'lucide-react';
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


export default function VoiceSalesAgentPage() {
  const [isInteractionStarted, setIsInteractionStarted] = useState(false);
  const [agentName, setAgentName] = useState<string>("");
  const [userName, setUserName] = useState<string>(""); 
  
  const { availableProducts, getProductByName } = useProductContext();
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>("ET");

  const [selectedSalesPlan, setSelectedSalesPlan] = useState<SalesPlan | undefined>();
  const [selectedEtPlanConfig, setSelectedEtPlanConfig] = useState<ETPlanConfiguration | undefined>();
  const [offerDetails, setOfferDetails] = useState<string>("");
  const [selectedCohort, setSelectedCohort] = useState<CustomerCohort | undefined>("Business Owners");
  
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPitch, setCurrentPitch] = useState<GeneratePitchOutput | null>(null);
  const [finalScore, setFinalScore] = useState<ScoreCallOutput | null>(null);
  const [isInteractionEnded, setIsInteractionEnded] = useState(false);
  const [currentCallStatus, setCurrentCallStatus] = useState<string>("Idle");

  const { toast } = useToast();
  const { logActivity, updateActivity } = useActivityLogger();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const conversationEndRef = useRef<null | HTMLDivElement>(null);
  const currentActivityId = useRef<string | null>(null);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);
  
  useEffect(() => {
    if (selectedProduct !== "ET") setSelectedEtPlanConfig(undefined);
  }, [selectedProduct]);

  // Speech Synthesis Hook
  const { isSupported: isTtsSupported, isSpeaking: isAiSpeaking, speak, cancel: cancelTts, curatedVoices, isLoading: areVoicesLoading } = useSpeechSynthesis({
    onStart: () => setCurrentCallStatus("AI Speaking..."),
    onEnd: () => { if(isInteractionStarted && !isInteractionEnded) setCurrentCallStatus("Listening..."); },
  });
  const [selectedVoiceName, setSelectedVoiceName] = useState<string | undefined>(undefined);
  
  useEffect(() => {
    if (curatedVoices.length > 0 && !selectedVoiceName) {
      const defaultVoice = curatedVoices.find(v => v.isDefault);
      setSelectedVoiceName(defaultVoice ? defaultVoice.name : curatedVoices[0].name);
    }
  }, [curatedVoices, selectedVoiceName]);
  
  const selectedVoiceObject = curatedVoices.find(v => v.name === selectedVoiceName)?.voice;

  const processAgentTurn = useCallback(async (
    action: VoiceSalesAgentFlowInput['action'],
    userInputText?: string,
  ) => {
    const productInfo = getProductByName(selectedProduct || "");
    if (!selectedProduct || !selectedCohort || !userName.trim() || !agentName.trim() || !productInfo) {
      toast({ variant: "destructive", title: "Missing Info", description: "Please select a Product, Customer Cohort, and enter both Agent and Customer names." });
      return;
    }
    if (!isTtsSupported) {
       toast({ variant: "destructive", title: "TTS Not Supported", description: "Your browser does not support Speech Synthesis. Please use a different browser." });
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setCurrentCallStatus( action === "START_CONVERSATION" ? "Initiating call..." : "AI thinking...");

    const kbContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, selectedProduct as Product);
    
    try {
      const flowInput: VoiceSalesAgentFlowInput = {
        product: selectedProduct as Product,
        productDisplayName: productInfo.displayName,
        brandName: productInfo.brandName,
        salesPlan: selectedSalesPlan, etPlanConfiguration: selectedProduct === "ET" ? selectedEtPlanConfig : undefined,
        offer: offerDetails, customerCohort: selectedCohort, agentName: agentName, userName: userName,
        knowledgeBaseContext: kbContext, conversationHistory: conversation,
        currentPitchState: currentPitch, action: action,
        currentUserInputText: userInputText,
      };
      const flowResult = await runVoiceSalesAgentTurn(flowInput);
      
      const speechToSpeak = flowResult.currentAiResponseText;
      
      if (flowResult.errorMessage) throw new Error(flowResult.errorMessage);
      
      setConversation(flowResult.conversationTurns);
      if (flowResult.generatedPitch) setCurrentPitch(flowResult.generatedPitch);
      
      if (speechToSpeak) {
        speak({ text: speechToSpeak, voice: selectedVoiceObject });
      } else {
         if (!isInteractionEnded) setCurrentCallStatus("Listening...");
      }
      
    } catch (e: any) {
      setError(e.message || "An unexpected error occurred in the sales agent flow.");
      setCurrentCallStatus("Client Error");
    } finally {
      setIsLoading(false);
    }
  }, [selectedProduct, getProductByName, selectedSalesPlan, selectedEtPlanConfig, offerDetails, selectedCohort, agentName, userName, conversation, currentPitch, knowledgeBaseFiles, isTtsSupported, speak, selectedVoiceObject, toast, isInteractionEnded]);

  const handleUserInputSubmit = (text: string) => {
    if (!text.trim() || isLoading || isAiSpeaking || isInteractionEnded) return;
    const userTurn: ConversationTurn = { id: `user-${Date.now()}`, speaker: 'User', text: text, timestamp: new Date().toISOString() };
    setConversation(prev => [...prev, userTurn]);
    processAgentTurn("PROCESS_USER_RESPONSE", text);
  }
  
  // Speech Recognition Hook
   const handleUserInterruption = useCallback(() => {
    if (isAiSpeaking) {
      cancelTts();
    }
  }, [isAiSpeaking, cancelTts]);
  
  const { startRecording, stopRecording, isRecording, transcript } = useWhisper({
      onTranscribe: (text:string) => {
        handleUserInterruption();
      },
      onTranscriptionComplete: (text) => {
          if (!text.trim() || isLoading || isAiSpeaking || isInteractionEnded) return;
          const userTurn: ConversationTurn = { id: `user-${Date.now()}`, speaker: 'User', text: text, timestamp: new Date().toISOString() };
          setConversation(prev => [...prev, userTurn]);
          processAgentTurn("PROCESS_USER_RESPONSE", text);
      },
  });

  // Master useEffect for controlling recording state
  useEffect(() => {
      const shouldBeListening = isInteractionStarted && !isLoading && !isAiSpeaking && !isInteractionEnded;
      if (shouldBeListening && !isRecording) {
          startRecording();
      } else if (!shouldBeListening && isRecording) {
          stopRecording();
      }
  }, [isInteractionStarted, isLoading, isAiSpeaking, isInteractionEnded, isRecording, startRecording, stopRecording]);

  const handleStartConversation = useCallback(() => {
    if (!userName.trim() || !agentName.trim() || !selectedProduct || !selectedCohort) {
        toast({ variant: "destructive", title: "Missing Info", description: "Please select a Product, Customer Cohort, and enter both Agent and Customer names." });
        return;
    }
    setConversation([]); setCurrentPitch(null); setFinalScore(null); setIsInteractionEnded(false); setIsInteractionStarted(true);
    
    const activityDetails: Partial<VoiceSalesAgentActivityDetails> = {
      input: { product: selectedProduct, customerCohort: selectedCohort, agentName: agentName, userName: userName, voiceName: selectedVoiceObject?.name },
      status: 'In Progress'
    };
    const activityId = logActivity({ module: "AI Voice Sales Agent", product: selectedProduct, details: activityDetails });
    currentActivityId.current = activityId;

    processAgentTurn("START_CONVERSATION");
  }, [userName, agentName, selectedProduct, selectedCohort, selectedVoiceObject, logActivity, toast, processAgentTurn]);


  const handleEndInteraction = useCallback(() => {
    if (isLoading || isInteractionEnded) return;
    
    cancelTts();
    stopRecording();
    setIsInteractionEnded(true);
    setCurrentCallStatus("Interaction Ended");

    const fullTranscript = conversation.map(turn => `${turn.speaker}: ${turn.text}`).join('\n');
    
    if(currentActivityId.current) {
        updateActivity(currentActivityId.current, { status: 'Completed', fullTranscriptText: fullTranscript });
    }
  }, [isLoading, isInteractionEnded, cancelTts, stopRecording, conversation, updateActivity]);


  const handleReset = useCallback(() => {
    setIsInteractionStarted(false); setConversation([]); setCurrentPitch(null); setFinalScore(null); setIsInteractionEnded(false);
    setError(null); setCurrentCallStatus("Idle"); currentActivityId.current = null;
    cancelTts();
    stopRecording();
  }, [cancelTts, stopRecording]);
  
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Voice Sales Agent" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Wifi className="mr-2 h-6 w-6 text-primary"/> Configure AI Voice Call</CardTitle>
            <CardDescription>
                This agent uses your browser's built-in voices and your microphone for a local, client-side interaction.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                                    <Select value={selectedVoiceName} onValueChange={setSelectedVoiceName} disabled={isInteractionStarted || areVoicesLoading}>
                                        <SelectTrigger className="flex-grow"><SelectValue placeholder={areVoicesLoading ? "Loading voices..." : "Select a voice"} /></SelectTrigger>
                                        <SelectContent>{curatedVoices.map(v => <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Button variant="outline" size="icon" onClick={() => speak({text: "Hello, this is a sample of my voice.", voice: selectedVoiceObject})} disabled={!selectedVoiceObject || isAiSpeaking} title="Play sample">
                                        <Volume2 className="h-4 w-4"/>
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Select the AI agent's voice (provided by your browser).</p>
                             </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-1">
                                <Label htmlFor="product-select">Product <span className="text-destructive">*</span></Label>
                                <Select value={selectedProduct} onValueChange={(value) => setSelectedProduct(value as Product)} disabled={isInteractionStarted}>
                                    <SelectTrigger id="product-select"><SelectValue placeholder="Select a Product" /></SelectTrigger>
                                    <SelectContent>{availableProducts.map((p) => (<SelectItem key={p.name} value={p.name}>{p.displayName}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="cohort-select">Customer Cohort <span className="text-destructive">*</span></Label>
                                <Select value={selectedCohort} onValueChange={(value) => setSelectedCohort(value as CustomerCohort)} disabled={isInteractionStarted}>
                                    <SelectTrigger id="cohort-select"><SelectValue placeholder="Select Cohort" /></SelectTrigger>
                                    <SelectContent>{VOICE_AGENT_CUSTOMER_COHORTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1"><Label htmlFor="agent-name">Agent Name <span className="text-destructive">*</span></Label><Input id="agent-name" placeholder="e.g., Samantha" value={agentName} onChange={e => setAgentName(e.target.value)} disabled={isInteractionStarted} /></div>
                            <div className="space-y-1"><Label htmlFor="user-name">Customer Name <span className="text-destructive">*</span></Label><Input id="user-name" placeholder="e.g., Rohan" value={userName} onChange={e => setUserName(e.target.value)} disabled={isInteractionStarted} /></div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {selectedProduct === "ET" && (<div className="space-y-1">
                                <Label htmlFor="et-plan-config-select">ET Plan Configuration (Optional)</Label>
                                <Select value={selectedEtPlanConfig} onValueChange={(value) => setSelectedEtPlanConfig(value as ETPlanConfiguration)} disabled={isInteractionStarted}>
                                    <SelectTrigger id="et-plan-config-select"><SelectValue placeholder="Select ET Plan" /></SelectTrigger>
                                    <SelectContent>{ET_PLAN_CONFIGURATIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>)}
                            <div className="space-y-1">
                                <Label htmlFor="plan-select">Sales Plan (Optional)</Label>
                                <Select value={selectedSalesPlan} onValueChange={(value) => setSelectedSalesPlan(value as SalesPlan)} disabled={isInteractionStarted}>
                                    <SelectTrigger id="plan-select"><SelectValue placeholder="Select Sales Plan" /></SelectTrigger>
                                    <SelectContent>{SALES_PLANS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-1"><Label htmlFor="offer-details">Offer Details (Optional)</Label><Input id="offer-details" placeholder="e.g., 20% off" value={offerDetails} onChange={e => setOfferDetails(e.target.value)} disabled={isInteractionStarted} /></div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
            
            {!isInteractionStarted && (
                 <Button onClick={handleStartConversation} disabled={isLoading || !selectedProduct || !selectedCohort || !userName.trim() || !agentName.trim()} className="w-full mt-4">
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
                <Badge variant={isAiSpeaking ? "outline" : "default"} className={cn("text-xs transition-colors", isAiSpeaking ? "bg-amber-100 text-amber-800" : isRecording ? "bg-red-100 text-red-700" : isInteractionEnded ? "bg-gray-200 text-gray-600" : "bg-green-100 text-green-800")}>
                    {isRecording ? <Radio className="mr-1.5 h-3.5 w-3.5 text-red-600 animate-pulse"/> : isAiSpeaking ? <Bot className="mr-1.5 h-3.5 w-3.5"/> : isInteractionEnded ? <PhoneOff className="mr-1.5 h-3.5 w-3.5"/> : <Mic className="mr-1.5 h-3.5 w-3.5"/>}
                    {isRecording ? "Listening..." : isAiSpeaking ? "AI Speaking..." : isInteractionEnded ? "Interaction Ended" : currentCallStatus}
                </Badge>
              </CardTitle>
              <CardDescription>
                Interaction with {userName || "Customer"}. Agent: {agentName || "Default AI"}. Product: {getProductByName(selectedProduct || "")?.displayName}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] w-full border rounded-md p-3 bg-muted/20 mb-3">
                {conversation.map((turn) => <ConversationTurnComponent key={turn.id} turn={turn} />)}
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
                  onSubmit={handleUserInputSubmit}
                  disabled={isLoading || isAiSpeaking || isInteractionEnded}
                />
            </CardContent>
            <CardFooter className="flex justify-between items-center">
                 <Button onClick={handleEndInteraction} variant="destructive" size="sm" disabled={isLoading || isInteractionEnded}>
                   <PhoneOff className="mr-2 h-4 w-4"/> End Interaction
                </Button>
                 <Button onClick={handleReset} variant="outline" size="sm">
                    <Redo className="mr-2 h-4 w-4"/> New Call
                </Button>
            </CardFooter>
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
