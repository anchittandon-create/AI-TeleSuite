
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
import { Textarea } from '@/components/ui/textarea';

import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { useWhisper } from '@/hooks/useWhisper';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { useProductContext } from '@/hooks/useProductContext';

import { 
    Product, CustomerCohort,
    ConversationTurn, GeneratePitchOutput,
    KnowledgeFile,
    BrowserVoiceAgentActivityDetails,
} from '@/types';

import { runBrowserVoiceAgentTurn, BrowserVoiceAgentFlowInput } from '@/ai/flows/browser-voice-agent-flow';

import { PhoneCall, Send, AlertTriangle, Bot, User as UserIcon, Info, Mic, Wifi, PhoneOff, Redo, Settings, Volume2, Loader2, SquareTerminal, Star } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const VOICE_AGENT_CUSTOMER_COHORTS: CustomerCohort[] = [
  "Business Owners", "Financial Analysts", "Active Investors", "Corporate Executives", "Young Professionals", "Students",
  "Payment Dropoff", "Paywall Dropoff", "Plan Page Dropoff", "Assisted Buying", "Expired Users",
  "New Prospect Outreach", "Premium Upsell Candidates",
];

type CallState = "IDLE" | "CONFIGURING" | "LISTENING" | "PROCESSING" | "AI_SPEAKING" | "ENDED" | "ERROR";

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

export default function BrowserVoiceAgentPage() {
  const [callState, setCallState] = useState<CallState>("CONFIGURING");

  const [agentName, setAgentName] = useState<string>("");
  const [userName, setUserName] = useState<string>(""); 
  
  const { availableProducts, getProductByName } = useProductContext();
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>("ET");
  const [selectedCohort, setSelectedCohort] = useState<CustomerCohort | undefined>("Business Owners");
  
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [currentPitchState, setCurrentPitchState] = useState<GeneratePitchOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { logActivity, updateActivity } = useActivityLogger();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const conversationEndRef = useRef<null | HTMLDivElement>(null);
  const currentActivityId = useRef<string | null>(null);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);
  
  const { isSupported: isTtsSupported, isSpeaking: isAiSpeaking, speak, cancel: cancelTts, curatedVoices, isLoading: areVoicesLoading } = useSpeechSynthesis({
    onStart: () => setCallState("AI_SPEAKING"),
    onEnd: (isSample) => {
        if (!isSample && callState !== "ENDED") {
          setCallState("LISTENING");
        }
    },
  });

  const [selectedVoiceName, setSelectedVoiceName] = useState<string | undefined>(undefined);
  
  useEffect(() => {
    if (curatedVoices.length > 0 && !selectedVoiceName) {
      const defaultVoice = curatedVoices.find(v => v.isDefault);
      setSelectedVoiceName(defaultVoice ? defaultVoice.name : curatedVoices[0].name);
    }
  }, [curatedVoices, selectedVoiceName]);
  
  const selectedVoiceObject = curatedVoices.find(v => v.name === selectedVoiceName)?.voice;
  const isCallInProgress = callState !== 'CONFIGURING' && callState !== 'IDLE' && callState !== 'ENDED';

  const processAgentTurn = useCallback(async (
    action: BrowserVoiceAgentFlowInput['action'],
    userInputText?: string,
    currentConversation?: ConversationTurn[]
  ) => {
    const productInfo = getProductByName(selectedProduct || "");
    if (!selectedProduct || !selectedCohort || !userName.trim() || !agentName.trim() || !productInfo) {
      toast({ variant: "destructive", title: "Missing Info", description: "Please select a Product, Customer Cohort, and enter both Agent and Customer names." });
      setCallState("CONFIGURING");
      return;
    }
    if (!isTtsSupported) {
       toast({ variant: "destructive", title: "TTS Not Supported", description: "Your browser does not support Speech Synthesis. Please use a different browser." });
       setCallState("ERROR");
      return;
    }
    
    setError(null);
    setCallState("PROCESSING");

    const kbContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, selectedProduct as Product);
    const conversationForFlow = currentConversation || conversation;
    
    try {
      const flowInput: BrowserVoiceAgentFlowInput = {
        product: selectedProduct as Product,
        customerCohort: selectedCohort, 
        agentName: agentName, userName: userName,
        knowledgeBaseContext: kbContext, 
        conversationHistory: conversationForFlow,
        currentPitchState: currentPitchState,
        currentUserInputText: userInputText,
        action: action,
      };
      
      const flowResult = await runBrowserVoiceAgentTurn(flowInput);
      
      const speechToSpeak = flowResult.aiResponseText;

      // Add AI's turn to the conversation log
      const aiTurn: ConversationTurn = { id: `ai-${Date.now()}`, speaker: 'AI', text: speechToSpeak, timestamp: new Date().toISOString() };
      setConversation(prev => [...prev, aiTurn]);
      
      if (flowResult.generatedPitch) {
        setCurrentPitchState(flowResult.generatedPitch);
      }
      
      if (flowResult.errorMessage) throw new Error(flowResult.errorMessage);
      
      if (flowResult.nextExpectedAction === 'INTERACTION_ENDED') {
        speak({ text: speechToSpeak, voice: selectedVoiceObject });
        handleEndInteraction(true, [...conversationForFlow, aiTurn]);
      } else if (speechToSpeak) {
        speak({ text: speechToSpeak, voice: selectedVoiceObject });
      } else {
        setCallState("LISTENING");
      }
      
    } catch (e: any) {
      const errorMessage = e.message || "An unexpected error occurred in the browser voice agent flow.";
      setError(errorMessage);
      setCallState("ERROR");
      const errorTurn: ConversationTurn = { id: `error-${Date.now()}`, speaker: 'AI', text: errorMessage, timestamp: new Date().toISOString() };
      setConversation(prev => [...prev, errorTurn]);
    }
  }, [
      selectedProduct, getProductByName, selectedCohort, agentName, userName, conversation, currentPitchState,
      knowledgeBaseFiles, isTtsSupported, speak, selectedVoiceObject, toast
  ]);
  
  const handleTranscriptionComplete = useCallback((text: string) => {
    if (!text.trim() || callState !== "LISTENING") return;
    const userTurn: ConversationTurn = { id: `user-${Date.now()}`, speaker: 'User', text: text, timestamp: new Date().toISOString() };
    const updatedConversation = [...conversation, userTurn];
    setConversation(updatedConversation); // Show user's turn immediately
    processAgentTurn("PROCESS_USER_RESPONSE", text, updatedConversation);
  }, [callState, conversation, processAgentTurn]);


  const { startRecording, stopRecording, isRecording, transcript } = useWhisper({
      onTranscriptionComplete: handleTranscriptionComplete,
      stopTimeout: 150,
  });

  useEffect(() => {
      const shouldBeListening = callState === "LISTENING";
      if (shouldBeListening && !isRecording) {
          startRecording();
      } else if (!shouldBeListening && isRecording) {
          stopRecording();
      }
  }, [callState, isRecording, startRecording, stopRecording]);

  const handleStartConversation = useCallback(() => {
    if (!userName.trim() || !agentName.trim()) {
        toast({ variant: "destructive", title: "Missing Info", description: "Agent Name and Customer Name are required." });
        return;
    }
     if (!selectedProduct || !selectedCohort) {
        toast({ variant: "destructive", title: "Missing Info", description: "Please select a Product and Customer Cohort." });
        return;
    }
    setConversation([]);
    
    const activityDetails: Partial<BrowserVoiceAgentActivityDetails> = {
      input: { product: selectedProduct, customerCohort: selectedCohort, agentName: agentName, userName: userName, voiceName: selectedVoiceObject?.name },
      status: 'In Progress'
    };
    const activityId = logActivity({ module: "Browser Voice Agent", product: selectedProduct, details: activityDetails });
    currentActivityId.current = activityId;

    processAgentTurn("START_CONVERSATION", undefined, []);
  }, [userName, agentName, selectedProduct, selectedCohort, selectedVoiceObject, logActivity, toast, processAgentTurn]);

  const handleEndInteraction = useCallback((endedByAI = false, finalConversationState: ConversationTurn[]) => {
    if (callState === "ENDED") return;
    
    setCallState("ENDED");
    if (isAiSpeaking) cancelTts();
    if (isRecording) stopRecording();

    const finalTranscriptText = finalConversationState.map(turn => `${turn.speaker}: ${turn.text}`).join('\n');
    
    if (currentActivityId.current) {
        updateActivity(currentActivityId.current, { status: 'Completed', fullTranscriptText: finalTranscriptText, fullConversation: finalConversationState });
        toast({ title: 'Interaction Ended', description: 'The call has been concluded and logged.' });
    } else {
        toast({ variant: "destructive", title: 'Logging Error', description: 'Could not find the activity to log the completed call.' });
    }

  }, [callState, isAiSpeaking, isRecording, cancelTts, stopRecording, updateActivity, toast]);


  const handleReset = useCallback(() => {
    if (currentActivityId.current && conversation.length > 0) {
        handleEndInteraction(false, conversation); 
    }
    setCallState("CONFIGURING");
    setConversation([]);
    setCurrentPitchState(null);
    setError(null); 
    currentActivityId.current = null;
    if (isAiSpeaking) cancelTts();
    if (isRecording) stopRecording();
  }, [cancelTts, stopRecording, isAiSpeaking, isRecording, conversation, handleEndInteraction]);
  
  const getCallStatusBadge = () => {
    switch (callState) {
        case "LISTENING":
            return <Badge variant="default" className="text-xs bg-green-100 text-green-800"><Mic className="mr-1.5 h-3.5 w-3.5"/>Listening...</Badge>;
        case "AI_SPEAKING":
            return <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800"><Bot className="mr-1.5 h-3.5 w-3.5"/>AI Speaking...</Badge>;
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

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Browser Voice Agent (Client-Side TTS)" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Wifi className="mr-2 h-6 w-6 text-primary"/> Configure Browser Voice Call</CardTitle>
            <CardDescription>
                This agent uses your browser's built-in voices and your microphone for a local, client-side interaction.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible defaultValue={callState === 'CONFIGURING' ? "item-config" : ""} className="w-full">
                <AccordionItem value="item-config">
                    <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90 [&[data-state=open]>&svg]:rotate-180">
                        <div className="flex items-center"><Settings className="mr-2 h-4 w-4 text-accent"/>Call Configuration</div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-3 space-y-3">
                         <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                 <Label>AI Voice Profile (Agent)</Label>
                                  <div className="mt-2 flex items-center gap-2">
                                    <Select value={selectedVoiceName} onValueChange={setSelectedVoiceName} disabled={isCallInProgress || areVoicesLoading}>
                                        <SelectTrigger className="flex-grow"><SelectValue placeholder={areVoicesLoading ? "Loading voices..." : "Select a voice"} /></SelectTrigger>
                                        <SelectContent>{curatedVoices.map(v => <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Button variant="outline" size="icon" onClick={() => speak({text: "Hello, this is a sample of my voice.", voice: selectedVoiceObject, isSample: true})} disabled={!selectedVoiceObject || isAiSpeaking} title="Play sample">
                                        <Volume2 className="h-4 w-4"/>
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Select the AI agent's voice (provided by your browser).</p>
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
                                <Select value={selectedCohort} onValueChange={(value) => setSelectedCohort(value as CustomerCohort)} disabled={isCallInProgress}>
                                    <SelectTrigger id="cohort-select"><SelectValue placeholder="Select Cohort" /></SelectTrigger>
                                    <SelectContent>{VOICE_AGENT_CUSTOMER_COHORTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1"><Label htmlFor="agent-name">Agent Name <span className="text-destructive">*</span></Label><Input id="agent-name" placeholder="e.g., Alex" value={agentName} onChange={e => setAgentName(e.target.value)} disabled={isCallInProgress} /></div>
                            <div className="space-y-1"><Label htmlFor="user-name">Customer Name <span className="text-destructive">*</span></Label><Input id="user-name" placeholder="e.g., Priya" value={userName} onChange={e => setUserName(e.target.value)} disabled={isCallInProgress} /></div>
                        </div>
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
                Interaction with {userName || "Customer"}. Agent: {agentName || "Default AI"}. Product: {getProductByName(selectedProduct || "")?.displayName}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] w-full border rounded-md p-3 bg-muted/20 mb-3">
                {conversation.map((turn) => <ConversationTurnComponent key={turn.id} turn={turn} />)}
                {isRecording && transcript.text && (
                  <p className="text-sm text-muted-foreground italic px-3 py-1">" {transcript.text} "</p>
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
                  onSubmit={handleTranscriptionComplete}
                  disabled={callState !== "LISTENING"}
                />
            </CardContent>
            <CardFooter className="flex justify-between items-center">
                 <Button onClick={() => handleEndInteraction(false, conversation)} variant="destructive" size="sm" disabled={callState === "ENDED"}>
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

    
