
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
import { useWhisper } from '@/hooks/useWhisper';
import { useProductContext } from '@/hooks/useProductContext';
import { useSpeechSynthesis, Voice } from '@/hooks/useSpeechSynthesis'; // Import the new hook

import { 
    SALES_PLANS, CUSTOMER_COHORTS as ALL_CUSTOMER_COHORTS, ET_PLAN_CONFIGURATIONS,
    Product, SalesPlan, CustomerCohort,
    ConversationTurn, 
    GeneratePitchOutput, ETPlanConfiguration,
    ScoreCallOutput, KnowledgeFile,
    VoiceSalesAgentFlowInput, VoiceSalesAgentFlowOutput,
    VoiceSalesAgentActivityDetails
} from '@/types';
import { runVoiceSalesAgentOption2Turn } from '@/ai/flows/voice-sales-agent-option2-flow';

import { PhoneCall, Send, AlertTriangle, Bot, SquareTerminal, User as UserIcon, Info, Radio, Mic, Wifi, PhoneOff, Redo, Settings, Volume2, Pause, Loader2, Sparkles, ExternalLink } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';


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

const VOICE_AGENT_CUSTOMER_COHORTS: CustomerCohort[] = [
  "Business Owners", "Financial Analysts", "Active Investors", "Corporate Executives", "Young Professionals", "Students",
  "Payment Dropoff", "Paywall Dropoff", "Plan Page Dropoff", "Assisted Buying", "Expired Users",
  "New Prospect Outreach", "Premium Upsell Candidates",
];

const SAMPLE_TEXT = "Hello, this is a sample of the selected voice that you can listen to.";


export default function VoiceSalesAgentOption2Page() {
  const [isInteractionStarted, setIsInteractionStarted] = useState(false);
  const { currentProfile: appAgentProfile } = useUserProfile(); 
  const [agentName, setAgentName] = useState<string>(appAgentProfile); 
  const [userName, setUserName] = useState<string>(""); 
  
  const { availableProducts, getProductByName } = useProductContext();
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();

  const [selectedSalesPlan, setSelectedSalesPlan] = useState<SalesPlan | undefined>();
  const [selectedEtPlanConfig, setSelectedEtPlanConfig] = useState<ETPlanConfiguration | undefined>();
  const [offerDetails, setOfferDetails] = useState<string>("");
  const [selectedCohort, setSelectedCohort] = useState<CustomerCohort | undefined>();
  
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | undefined>();
  
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPitch, setCurrentPitch] = useState<GeneratePitchOutput | null>(null);
  const [finalScore, setFinalScore] = useState<ScoreCallOutput | null>(null);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [currentCallStatus, setCurrentCallStatus] = useState<string>("Idle");

  const {
    voices,
    speak,
    cancel,
    isSpeaking,
    isSupported: isSpeechSynthSupported
  } = useSpeechSynthesis({
      onEnd: () => {
        if (isInteractionStarted) setCurrentCallStatus("Listening...");
      }
  });

  
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const conversationEndRef = useRef<null | HTMLDivElement>(null);

  // Filter voices to match the required criteria
  const filteredVoices = voices.filter(voice => {
    const lang = voice.lang.toLowerCase();
    const name = voice.name.toLowerCase();
    // English (India)
    if (lang.startsWith('en-in')) return true;
    // English (US)
    if (lang.startsWith('en-us')) return true;
    // Hindi (India)
    if (lang.startsWith('hi-in')) return true;
    
    // Fallbacks for some browsers that don't use standard language codes
    if (name.includes('hindi') || name.includes('english (india)') || name.includes('english (united states)')) return true;

    return false;
  });

  useEffect(() => {
    if (filteredVoices.length > 0 && !selectedVoiceURI) {
      const defaultVoice = filteredVoices.find(v => v.default) || filteredVoices[0];
      setSelectedVoiceURI(defaultVoice.voiceURI);
    }
  }, [filteredVoices, selectedVoiceURI]);
  
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);
  
  useEffect(() => { setAgentName(appAgentProfile); }, [appAgentProfile]);
  useEffect(() => { if (selectedProduct !== "ET") setSelectedEtPlanConfig(undefined); }, [selectedProduct]);
  
  const handleUserInterruption = useCallback(() => {
    cancel(); // Stop speech synthesis if user starts speaking
  }, [cancel]);

  
  const handlePlaySample = () => {
    if (isSpeaking) {
      cancel();
    } else if (selectedVoiceURI) {
      speak({ text: SAMPLE_TEXT, voiceURI: selectedVoiceURI });
    } else {
      toast({ variant: 'destructive', title: 'No Voice Selected', description: 'Please select a voice to play a sample.' });
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
    
    try {
        const flowResult: VoiceSalesAgentFlowOutput = await runVoiceSalesAgentOption2Turn({
            product: selectedProduct as Product,
            productDisplayName: productInfo.displayName,
            salesPlan: selectedSalesPlan, etPlanConfiguration: selectedProduct === "ET" ? selectedEtPlanConfig : undefined,
            offer: offerDetails, customerCohort: selectedCohort, agentName: agentName, userName: userName,
            knowledgeBaseContext: kbContext, conversationHistory: conversation,
            currentPitchState: currentPitch, action: action,
            currentUserInputText: userInputText,
            voiceProfileId: selectedVoiceURI // Use voice URI here
        });
      
      const textToSpeak = flowResult.currentAiSpeech?.text;
      
      if (flowResult.errorMessage) throw new Error(flowResult.errorMessage);
      
      // Stop listening before speaking
      stop();

      if(textToSpeak){
          speak({ text: textToSpeak, voiceURI: selectedVoiceURI });
          const newTurn: ConversationTurn = { 
              id: `ai-${Date.now()}`, 
              speaker: 'AI', 
              text: textToSpeak,
              timestamp: new Date().toISOString(),
              // We don't have a data URI with this method
          };
          setConversation(prev => [...prev, newTurn]);
      }
      
      if (flowResult.generatedPitch) setCurrentPitch(flowResult.generatedPitch);
      
      if (flowResult.callScore) {
        setFinalScore(flowResult.callScore);
        setIsCallEnded(true);
        setCurrentCallStatus("Call Ended & Scored");
      }
      if (flowResult.nextExpectedAction === "CALL_SCORED" || flowResult.nextExpectedAction === "END_CALL_NO_SCORE") {
        setIsCallEnded(true);
        setCurrentCallStatus("Call Ended");
      }
      
      if (textToSpeak) {
        setCurrentCallStatus("AI Speaking...");
      } else {
        setCurrentCallStatus("Listening...");
      }
      
      logActivity({ module: "Voice Sales Agent (Custom)", product: selectedProduct, details: { /* ... logging details */ } as VoiceSalesAgentActivityDetails });

    } catch (e: any) {
        setError(e.message || "An unexpected error occurred in the sales agent flow.");
        setCurrentCallStatus("Client Error");
    } finally {
      setIsLoading(false);
    }
  }, [selectedProduct, selectedSalesPlan, selectedEtPlanConfig, offerDetails, selectedCohort, agentName, userName, conversation, currentPitch, knowledgeBaseFiles, logActivity, toast, getProductByName, selectedVoiceURI, speak]);
  
  const handleUserInputSubmit = (text: string) => {
    if (!text.trim() || isLoading || isSpeaking) return;
    const userTurn: ConversationTurn = { id: `user-${Date.now()}`, speaker: 'User', text: text, timestamp: new Date().toISOString() };
    setConversation(prev => [...prev, userTurn]);
    processAgentTurn("PROCESS_USER_RESPONSE", text);
  };
  
  const { stop, isRecording, transcript } = useWhisper({
    onTranscribe: handleUserInterruption,
    onTranscriptionComplete: (completedTranscript) => {
      if (completedTranscript.trim().length > 2 && !isLoading) {
        handleUserInputSubmit(completedTranscript);
      }
    },
    autoStart: isInteractionStarted && !isLoading && !isSpeaking,
    autoStop: true,
  });

  const handleStartConversation = () => {
    if (!userName.trim() || !selectedProduct || !selectedCohort) {
        toast({ variant: "destructive", title: "Missing Info", description: "Please select a Product, Customer Cohort, and enter the Customer's Name." });
        return;
    }
    setConversation([]); setCurrentPitch(null); setFinalScore(null); setIsCallEnded(false); setIsInteractionStarted(true);
    processAgentTurn("START_CONVERSATION");
  };

  const handleEndCall = () => {
    cancel(); // Stop any active speech
    if (isRecording) stop();
    if (isLoading) return;
    processAgentTurn("END_CALL_AND_SCORE");
  };

  const handleReset = () => {
    setIsInteractionStarted(false); setConversation([]); setCurrentPitch(null); setFinalScore(null); setIsCallEnded(false);
    setError(null); setCurrentCallStatus("Idle");
  };
  
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Voice Sales Agent (Browser TTS)" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Sparkles className="mr-2 h-6 w-6 text-primary"/> Configure Browser Voice Call</CardTitle>
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
                         <div className="mt-4 pt-4 border-t">
                             <Label>Browser Voice Profile</Label>
                             <div className="mt-2 flex items-center gap-2">
                                <Select value={selectedVoiceURI} onValueChange={setSelectedVoiceURI} disabled={isInteractionStarted || isSpeaking}>
                                    <SelectTrigger className="flex-grow"><SelectValue placeholder="Select a voice from your browser" /></SelectTrigger>
                                    <SelectContent>
                                        {filteredVoices.map(voice => (<SelectItem key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</SelectItem>))}
                                    </SelectContent>
                                </Select>
                                <Button variant="outline" size="icon" onClick={handlePlaySample} disabled={isInteractionStarted || isSpeaking} title="Play sample">
                                  {isSpeaking ? <Pause className="h-4 w-4"/> : <Volume2 className="h-4 w-4"/>}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Select a voice provided by your browser/OS. Quality may vary.</p>
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
                 <Badge variant={isSpeaking ? "outline" : "default"} className={cn("text-xs transition-colors", isSpeaking ? "bg-amber-100 text-amber-800" : isRecording ? "bg-red-100 text-red-700" : "bg-green-100 text-green-800")}>
                    {isRecording ? <Radio className="mr-1.5 h-3.5 w-3.5 text-red-600 animate-pulse"/> : isSpeaking ? <Bot className="mr-1.5 h-3.5 w-3.5"/> : <Mic className="mr-1.5 h-3.5 w-3.5"/>}
                    {isRecording ? "Listening..." : isSpeaking ? "AI Speaking..." : currentCallStatus}
                </Badge>
              </CardTitle>
              <CardDescription>
                Interaction with {userName || "Customer"}. AI Agent: {agentName || "Default AI"}. Product: {selectedProduct}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] w-full border rounded-md p-3 bg-muted/20 mb-3">
                {conversation.map((turn) => <ConversationTurnComponent key={turn.id} turn={turn} />)}
                 {isRecording && transcript.text && (
                  <p className="text-sm text-muted-foreground italic px-3 py-1">" {transcript.text} "</p>
                )}
                {isLoading && conversation.length > 0 && <LoadingSpinner size={16} className="mx-auto my-2" />}
                <div ref={conversationEndRef} />
              </ScrollArea>
              
               {error && (
                <Alert variant="destructive" className="mb-3">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                        <p>{error}</p>
                    </AlertDescription>
                </Alert>
              )}
               <div className="text-xs text-muted-foreground mb-2">Optional: Type a response instead of speaking.</div>
               <UserInputArea
                  onSubmit={handleUserInputSubmit}
                  disabled={isLoading || isSpeaking || isCallEnded}
                />
            </CardContent>
            <CardFooter className="flex justify-between items-center">
                 <Button onClick={handleReset} variant="outline" size="sm">
                    <Redo className="mr-2 h-4 w-4"/> New Call
                </Button>
                <Button onClick={handleEndCall} variant="destructive" size="sm" disabled={isLoading || isCallEnded}>
                   <PhoneOff className="mr-2 h-4 w-4"/> End Interaction & Get Score
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
