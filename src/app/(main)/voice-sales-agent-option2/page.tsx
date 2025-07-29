
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
import { fileToDataUrl } from '@/lib/file-utils';
import { Base64 } from 'js-base64';

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

import { PhoneCall, Send, AlertTriangle, Bot, SquareTerminal, User as UserIcon, Info, Radio, Mic, Wifi, PhoneOff, Redo, Settings, Volume2, Pause, Loader2, FileUp, Sparkles, ExternalLink } from 'lucide-react';
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

const BARK_PRESET_VOICES = [
    { id: 'en_speaker_0', name: 'English Male 1'},
    { id: 'en_speaker_1', name: 'English Male 2'},
    { id: 'en_speaker_2', name: 'English Male 3'},
    { id: 'en_speaker_3', name: 'English Female 1'},
    { id: 'en_speaker_4', name: 'English Female 2'},
    { id: 'en_speaker_5', name: 'English Female 3'},
    { id: 'hi_speaker_0', name: 'Hindi Female 1'},
    { id: 'hi_speaker_1', name: 'Hindi Female 2'},
    { id: 'hi_speaker_3', name: 'Hindi Male 1'},
    { id: 'hi_speaker_4', name: 'Hindi Male 2'},
];
const SAMPLE_TEXT = "Hello, this is a sample of the selected voice that you can listen to.";


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
  
  const [selectedLocalVoiceId, setSelectedLocalVoiceId] = useState<string>(BARK_PRESET_VOICES[0].id);

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
  
  const playAudio = useCallback((audioDataUri: string) => {
    return new Promise<void>((resolve, reject) => {
        if (audioDataUri && audioDataUri.startsWith("data:audio/")) {
            if (audioPlayerRef.current) {
                const handleEnded = () => {
                    setIsAiSpeaking(false);
                    if (!isCallEnded) setCurrentCallStatus("Listening...");
                    audioPlayerRef.current?.removeEventListener('ended', handleEnded);
                    resolve();
                };
                const handleError = (e: Event) => {
                    console.error("Audio playback error:", e);
                    const errorMessage = "Error playing audio.";
                    setError(errorMessage);
                    setIsAiSpeaking(false);
                    audioPlayerRef.current?.removeEventListener('error', handleError);
                    reject(new Error(errorMessage));
                };

                audioPlayerRef.current.addEventListener('ended', handleEnded);
                audioPlayerRef.current.addEventListener('error', handleError);

                audioPlayerRef.current.src = audioDataUri;
                audioPlayerRef.current.play().catch(e => {
                    handleError(e as Event);
                });
                setIsAiSpeaking(true);
                setCurrentCallStatus("AI Speaking...");
            } else {
                 reject(new Error("Audio player reference is not available."));
            }
        } else {
            const errorMessage = `Audio Error: Audio data is missing or invalid.`;
            setError(errorMessage);
            reject(new Error(errorMessage));
        }
    });
  }, [isCallEnded]);

  const synthesizeOpenTTSAudio = async (text: string, voice: string): Promise<string> => {
    const openTtsUrl = 'http://localhost:5500/api/tts';
    try {
        const response = await fetch(openTtsUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: text,
              voice: voice,
              ssml: false
            }),
        });
        if (!response.ok) {
            throw new Error(`Local TTS server returned an error: ${response.status} ${response.statusText}`);
        }
        const audioBuffer = await response.arrayBuffer();
        const base64Audio = Base64.fromUint8Array(new Uint8Array(audioBuffer));
        return `data:audio/wav;base64,${base64Audio}`;
    } catch (e: any) {
        console.error('OpenTTS fetch error:', e);
        // This is a critical error to show to the user.
        setError('Failed to connect to the local OpenTTS server. Please ensure the server is running on http://localhost:5500 and is configured to allow requests from this application. See the OpenTTS documentation for setup help.');
        throw e; // Re-throw to be caught by the calling function
    }
  };
  
  const handlePlaySample = async () => {
    setIsAiSpeaking(true); // Use the main speaking flag for the sample too
    setError(null);
    try {
      const audioUri = await synthesizeOpenTTSAudio(SAMPLE_TEXT, selectedLocalVoiceId);
      await playAudio(audioUri);
    } catch (e) {
      // The error is already set by synthesizeOpenTTSAudio, just need to stop loading state
      setIsAiSpeaking(false);
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
            voiceProfileId: selectedLocalVoiceId // Pass the local voice ID
        });
      
      const textToSpeak = flowResult.currentAiSpeech?.text;
      let synthesizedAudioUri: string | undefined;

      if(textToSpeak){
         try {
            synthesizedAudioUri = await synthesizeOpenTTSAudio(textToSpeak, selectedLocalVoiceId);
         } catch(e: any){
            // Error is already set by synthesizeOpenTTSAudio, no need to set it again.
         }
      }

      const newTurn: ConversationTurn = { 
          id: `ai-${Date.now()}`, 
          speaker: 'AI', 
          text: textToSpeak || "...",
          timestamp: new Date().toISOString(),
          audioDataUri: synthesizedAudioUri
      };
      setConversation(prev => [...prev, newTurn]);
      
      if (flowResult.errorMessage) throw new Error(flowResult.errorMessage);
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
      
       if (synthesizedAudioUri) {
            await playAudio(synthesizedAudioUri);
       } else {
            setIsAiSpeaking(false);
            if (!isCallEnded) setCurrentCallStatus("Listening...");
       }
      
      logActivity({ module: "Voice Sales Agent (Custom)", product: selectedProduct, details: { /* ... logging details */ } as VoiceSalesAgentActivityDetails });

    } catch (e: any) {
        if (!error) { // Only set error if not already set by TTS function
            setError(e.message || "An unexpected error occurred in the sales agent flow.");
        }
        setCurrentCallStatus("Client Error");
    } finally {
      setIsLoading(false);
    }
  }, [selectedProduct, selectedSalesPlan, selectedEtPlanConfig, offerDetails, selectedCohort, agentName, userName, conversation, currentPitch, knowledgeBaseFiles, logActivity, toast, isCallEnded, getProductByName, playAudio, selectedLocalVoiceId, error]);
  
  const handleUserInputSubmit = (text: string) => {
    if (!text.trim() || isLoading || isAiSpeaking) return;
    const userTurn: ConversationTurn = { id: `user-${Date.now()}`, speaker: 'User', text: text, timestamp: new Date().toISOString() };
    setConversation(prev => [...prev, userTurn]);
    processAgentTurn("PROCESS_USER_RESPONSE", text);
  };
  
  const { stop, isRecording, transcript } = useWhisper({
    onTranscribe: () => audioPlayerRef.current?.pause(),
    onTranscriptionComplete: (completedTranscript) => {
      if (completedTranscript.trim().length > 2 && !isLoading) {
        handleUserInputSubmit(completedTranscript);
      }
    },
    autoStart: isConversationStarted && !isLoading && !isAiSpeaking,
    autoStop: true,
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
    audioPlayerRef.current?.pause();
    if (isRecording) stop();
    if (isLoading) return;
    processAgentTurn("END_CALL_AND_SCORE");
  };

  const handleReset = () => {
    setIsConversationStarted(false); setConversation([]); setCurrentPitch(null); setFinalScore(null); setIsCallEnded(false);
    setError(null); setCurrentCallStatus("Idle");
  };
  
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Voice Sales Agent (Local TTS)" />
      <audio ref={audioPlayerRef} className="hidden" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Sparkles className="mr-2 h-6 w-6 text-primary"/> Configure Local TTS Voice Call</CardTitle>
            <CardDescription>
                This agent uses a self-hosted, open-source TTS engine (like OpenTTS) running on your local machine.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Accordion type="single" collapsible defaultValue={isConversationStarted ? "" : "item-config"} className="w-full">
                <AccordionItem value="item-config">
                    <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90 [&[data-state=open]>&svg]:rotate-180">
                        <div className="flex items-center"><Settings className="mr-2 h-4 w-4 text-accent"/>Call Configuration</div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-3 space-y-3">
                         <div className="mt-4 pt-4 border-t">
                             <Label>Local TTS Voice Profile</Label>
                             <div className="mt-2 flex items-center gap-2">
                                <Select value={selectedLocalVoiceId} onValueChange={setSelectedLocalVoiceId} disabled={isConversationStarted || isAiSpeaking}>
                                    <SelectTrigger className="flex-grow"><SelectValue placeholder="Select a local voice" /></SelectTrigger>
                                    <SelectContent>
                                        {BARK_PRESET_VOICES.map(voice => (<SelectItem key={voice.id} value={voice.id}>{voice.name}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                                <Button variant="outline" size="icon" onClick={handlePlaySample} disabled={isConversationStarted || isAiSpeaking} title="Play sample">
                                  {isAiSpeaking ? <Loader2 className="h-4 w-4 animate-spin"/> : <Volume2 className="h-4 w-4"/>}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Select a voice supported by your local TTS server. The list shows common Bark voices.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-1">
                                <Label htmlFor="product-select-sales-opt2">Product <span className="text-destructive">*</span></Label>
                                <Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={isConversationStarted}>
                                    <SelectTrigger id="product-select-sales-opt2"><SelectValue placeholder="Select a Product" /></SelectTrigger>
                                    <SelectContent>{availableProducts.map((p) => (<SelectItem key={p.name} value={p.name}>{p.displayName}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1"><Label htmlFor="cohort-select-opt2">Customer Cohort <span className="text-destructive">*</span></Label><Select value={selectedCohort} onValueChange={(val) => setSelectedCohort(val as CustomerCohort)} disabled={isConversationStarted}><SelectTrigger id="cohort-select-opt2"><SelectValue placeholder="Select Cohort" /></SelectTrigger><SelectContent>{VOICE_AGENT_CUSTOMER_COHORTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1"><Label htmlFor="agent-name-opt2">Agent Name</Label><Input id="agent-name-opt2" placeholder="e.g., Alex (AI Agent)" value={agentName} onChange={e => setAgentName(e.target.value)} disabled={isConversationStarted} /></div>
                            <div className="space-y-1"><Label htmlFor="user-name-opt2">Customer Name <span className="text-destructive">*</span></Label><Input id="user-name-opt2" placeholder="e.g., Priya Sharma" value={userName} onChange={e => setUserName(e.target.value)} disabled={isConversationStarted} /></div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {selectedProduct === "ET" && (<div className="space-y-1"><Label htmlFor="et-plan-config-select-opt2">ET Plan Configuration (Optional)</Label><Select value={selectedEtPlanConfig} onValueChange={(val) => setSelectedEtPlanConfig(val as ETPlanConfiguration)} disabled={isConversationStarted}><SelectTrigger id="et-plan-config-select-opt2"><SelectValue placeholder="Select ET Plan" /></SelectTrigger><SelectContent>{ET_PLAN_CONFIGURATIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>)}
                            <div className="space-y-1"><Label htmlFor="plan-select-opt2">Sales Plan (Optional)</Label><Select value={selectedSalesPlan} onValueChange={(val) => setSelectedSalesPlan(val as SalesPlan)} disabled={isConversationStarted}><SelectTrigger id="plan-select-opt2"><SelectValue placeholder="Select Sales Plan" /></SelectTrigger><SelectContent>{SALES_PLANS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                             <div className="space-y-1"><Label htmlFor="offer-details-opt2">Offer Details (Optional)</Label><Input id="offer-details-opt2" placeholder="e.g., 20% off" value={offerDetails} onChange={e => setOfferDetails(e.target.value)} disabled={isConversationStarted} /></div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
            
            {!isConversationStarted && (
                 <Button onClick={handleStartConversation} disabled={isLoading || !selectedProduct || !selectedCohort || !userName.trim()} className="w-full mt-4">
                    <PhoneCall className="mr-2 h-4 w-4"/> Start Local TTS Call
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
                {conversation.map((turn) => <ConversationTurnComponent key={turn.id} turn={turn} onPlayAudio={(uri) => playAudio(uri)} />)}
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
                    <AlertDescription>
                        <p>{error}</p>
                        {error.includes('localhost:5500') && 
                            <p className="mt-2 text-xs">
                                Please ensure your local TTS server (e.g., OpenTTS) is running and accessible. 
                                <a href="https://github.com/synesthesiam/opentts" target="_blank" rel="noopener noreferrer" className="font-semibold underline ml-1">
                                    Click here for setup instructions <ExternalLink className="inline h-3 w-3"/>
                                </a>
                            </p>
                        }
                    </AlertDescription>
                </Alert>
              )}
               <div className="text-xs text-muted-foreground mb-2">Optional: Type a response instead of speaking.</div>
               <UserInputArea
                  onSubmit={handleUserInputSubmit}
                  disabled={isLoading || isAiSpeaking || isCallEnded}
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
