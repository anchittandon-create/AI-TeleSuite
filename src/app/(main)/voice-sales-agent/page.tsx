
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
import { useUserProfile } from '@/hooks/useUserProfile';
import { useWhisper } from '@/hooks/use-whisper';
import { useProductContext } from '@/hooks/useProductContext';

import { Product, ConversationTurn, ScoreCallOutput, VoiceSalesAgentActivityDetails, KnowledgeFile } from '@/types';
import { runVoiceSalesAgent } from '@/ai/flows/voice-sales-agent-flow';
import { synthesizeSpeech } from '@/ai/flows/speech-synthesis-flow';
import { scoreCall, ScoreCallInput } from '@/ai/flows/call-scoring';

import { PhoneCall, Send, AlertTriangle, Bot, SquareTerminal, User as UserIcon, Info, Radio, Mic, Wifi, PhoneOff, Redo, Settings } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from '@/lib/utils';


const PRESET_VOICES = [
    { id: "Algenib", name: "Raj - Calm Indian Male" },
    { id: "Achernar", name: "Ananya - Friendly Indian Female" },
];

type VoiceSelectionType = 'default';

export default function VoiceSalesAgentPage() {
  const { currentProfile: appAgentProfile } = useUserProfile(); 
  const [agentName, setAgentName] = useState<string>(appAgentProfile); 
  const [userName, setUserName] = useState<string>("Customer"); 
  
  const { availableProducts } = useProductContext();
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();

  // Voice Selection State
  const [voiceSelectionType, setVoiceSelectionType] = useState<VoiceSelectionType>('default');
  const [selectedDefaultVoice, setSelectedDefaultVoice] = useState<string>(PRESET_VOICES[0].id);
  
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalScore, setFinalScore] = useState<ScoreCallOutput | null>(null);
  const [isConversationStarted, setIsConversationStarted] = useState(false);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [currentCallStatus, setCurrentCallStatus] = useState<string>("Idle");
  
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);

  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const conversationEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => { conversationEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [conversation]);
  useEffect(() => { setAgentName(appAgentProfile); }, [appAgentProfile]);
  
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
    if (!audioDataUri || !audioDataUri.startsWith("data:audio") || audioDataUri.length < 1000) {
        toast({ variant: "destructive", title: "Audio Generation Error", description: "The AI's voice could not be generated. Please check server logs." });
        setIsAiSpeaking(false);
        if (!isCallEnded) setCurrentCallStatus("Ready to listen");
        return;
    }
    
    if (audioPlayerRef.current) {
        try {
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
            toast({ variant: "destructive", title: "Playback System Error" });
            setIsAiSpeaking(false);
        }
    }
  }, [toast, isCallEnded]);

  const processAgentTurn = useCallback(async (userInputText: string) => {
    if (!selectedProduct) {
      toast({ variant: "destructive", title: "Missing Product", description: "Please select a Product." });
      return;
    }
    setIsLoading(true);
    setError(null);
    setCurrentCallStatus("AI thinking...");

    const userTurn: ConversationTurn = {
        id: `user-${Date.now()}`,
        speaker: 'User',
        text: userInputText,
        timestamp: new Date().toISOString()
    };
    setConversation(prev => [...prev, userTurn]);

    try {
      // 1. Get AI's text response
      const agentResponse = await runVoiceSalesAgent({
        userMessage: userInputText,
        product: selectedProduct,
        agentName: agentName,
      });

      const responseText = agentResponse.responseText;
      if (!responseText) {
        throw new Error("AI failed to generate a response text.");
      }

      // 2. Synthesize speech for the response
      const speech = await synthesizeSpeech({
        textToSpeak: responseText,
        voiceProfileId: selectedDefaultVoice
      });

      const aiTurn: ConversationTurn = {
        id: `ai-${Date.now()}`,
        speaker: 'AI',
        text: responseText,
        timestamp: new Date().toISOString(),
        audioDataUri: speech.audioDataUri
      };
      setConversation(prev => [...prev, aiTurn]);
      
      if (speech.errorMessage) {
         toast({ variant: "destructive", title: "TTS Error", description: speech.errorMessage });
      } else {
        playAiAudio(speech.audioDataUri);
      }

    } catch (e: any) {
      setError(e.message || "An unexpected error occurred.");
      toast({ variant: "destructive", title: "Interaction Error", description: e.message, duration: 7000 });
      setCurrentCallStatus("Error");
    } finally {
      setIsLoading(false);
    }
  }, [selectedProduct, agentName, logActivity, toast, playAiAudio, selectedDefaultVoice]);
  
  const handleStartConversation = () => {
    if (!userName.trim() || !selectedProduct) {
        toast({ variant: "destructive", title: "Missing Info", description: "Please select a Product and enter the Customer's Name." });
        return;
    }
    setConversation([]);
    setFinalScore(null);
    setIsCallEnded(false);
    setIsConversationStarted(true);
    // Initial greeting
    const initialGreeting = `Hello, this is ${agentName} from The Economic Times. Am I speaking with ${userName}?`;
    const aiTurn: ConversationTurn = {
        id: `ai-${Date.now()}`, speaker: 'AI', text: initialGreeting, timestamp: new Date().toISOString()
    };
    setConversation([aiTurn]);
    
    synthesizeSpeech({textToSpeak: initialGreeting, voiceProfileId: selectedDefaultVoice}).then(speech => {
        setConversation(prev => prev.map(t => t.id === aiTurn.id ? {...t, audioDataUri: speech.audioDataUri} : t));
        playAiAudio(speech.audioDataUri);
    });
  };

  const handleEndCall = async () => {
    if (audioPlayerRef.current) audioPlayerRef.current.pause();
    if (whisperInstance && isRecording) whisperInstance.stopRecording();
    if (isLoading) return;
    
    setIsLoading(true);
    setCurrentCallStatus("Ending call & scoring...");
    
    const fullTranscriptText = conversation.map(turn => `${turn.speaker}: ${turn.text}`).join('\n\n');
    const scoreInput: ScoreCallInput = {
      audioDataUri: `data:text/plain;base64,${Buffer.from(fullTranscriptText).toString('base64')}`,
      product: selectedProduct,
      agentName: agentName || "AI Agent"
    };
    
    try {
        const scoreOutput = await scoreCall(scoreInput); 
        scoreOutput.transcript = fullTranscriptText; 
        scoreOutput.transcriptAccuracy = "N/A (from text transcript)"; 
        setFinalScore(scoreOutput);
        
        const closingMessage = "Thank you for your time. This interaction has now concluded.";
        const speech = await synthesizeSpeech({textToSpeak: closingMessage, voiceProfileId: selectedDefaultVoice});
        const aiTurn: ConversationTurn = {
            id: `ai-${Date.now()}`, speaker: 'AI', text: closingMessage, timestamp: new Date().toISOString(), audioDataUri: speech.audioDataUri
        };
        setConversation(prev => [...prev, aiTurn]);
        playAiAudio(speech.audioDataUri);
        
        toast({ title: "Call Ended & Scored", description: "The sales call has concluded and been scored." });
        
        const activityDetails: VoiceSalesAgentActivityDetails = {
            input: { product: selectedProduct!, customerCohort: 'N/A', agentName, userName }, // Cohort is not used in this simplified flow
            finalScore: { overallScore: scoreOutput.overallScore, callCategorisation: scoreOutput.callCategorisation, summary: scoreOutput.summary },
            fullTranscriptText,
        };
        logActivity({ module: "Voice Sales Agent", product: selectedProduct, details: activityDetails });

    } catch (e: any) {
        setError(e.message || "An unexpected error occurred during scoring.");
        toast({ variant: "destructive", title: "Scoring Error", description: e.message });
    } finally {
        setIsLoading(false);
        setIsCallEnded(true);
        setCurrentCallStatus("Call Ended & Scored");
    }
  };

  const handleReset = () => {
    setIsConversationStarted(false); 
    setConversation([]); 
    setFinalScore(null); 
    setIsCallEnded(false);
    setError(null);
    setCurrentCallStatus("Idle");
  };

  const { whisperInstance, transcript, isRecording } = useWhisper({
    onTranscribe: handleUserInterruption,
    onTranscriptionComplete: (completedTranscript) => {
      if (completedTranscript.trim().length > 2 && !isLoading) {
        processAgentTurn(completedTranscript);
      }
    },
    autoStart: isConversationStarted && !isLoading && !isAiSpeaking,
    autoStop: true,
    stopTimeout: 1200, 
  });


  return (
    <div className="flex flex-col h-full">
      <PageHeader title={`AI Voice Sales Agent`} />
      <audio ref={audioPlayerRef} onEnded={handleAiAudioEnded} className="hidden" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Wifi className="mr-2 h-6 w-6 text-primary"/> Configure & Initiate Sales Call</CardTitle>
            <CardDescription>Set up agent and customer context. When you start the call, the AI will initiate the conversation.</CardDescription>
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
                                    <SelectTrigger id="product-select-sales"><SelectValue placeholder="Select a Product" /></SelectTrigger>
                                    <SelectContent>{availableProducts.map((p) => (<SelectItem key={p.name} value={p.name}>{p.displayName}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-1"><Label htmlFor="user-name">Customer Name <span className="text-destructive">*</span></Label><Input id="user-name" placeholder="e.g., Priya Sharma" value={userName} onChange={e => setUserName(e.target.value)} disabled={isConversationStarted} /></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1"><Label htmlFor="agent-name">Agent Name (for AI dialogue)</Label><Input id="agent-name" placeholder="e.g., Alex (AI Agent)" value={agentName} onChange={e => setAgentName(e.target.value)} disabled={isConversationStarted} /></div>
                            <div className="space-y-1">
                                <Label>AI Voice Profile <span className="text-destructive">*</span></Label>
                                <Select value={selectedDefaultVoice} onValueChange={setSelectedDefaultVoice} disabled={isConversationStarted}>
                                    <SelectTrigger><SelectValue placeholder="Select a preset voice" /></SelectTrigger>
                                    <SelectContent>{PRESET_VOICES.map(voice => (<SelectItem key={voice.id} value={voice.id}>{voice.name}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
            {!isConversationStarted && ( <Button onClick={handleStartConversation} disabled={isLoading || !selectedProduct || !userName.trim()} className="w-full mt-4"><PhoneCall className="mr-2 h-4 w-4"/> Start Call with {userName || "Customer"}</Button>)}
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
              <CardDescription>Interaction with {userName || "Customer"}. Product: {selectedProduct}.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] w-full border rounded-md p-3 bg-muted/20 mb-3">
                {conversation.map((turn) => <ConversationTurnComponent key={turn.id} turn={turn} onPlayAudio={playAiAudio}/>)}
                 {isRecording && transcript.text && (<p className="text-sm text-muted-foreground italic px-3 py-1">" {transcript.text} "</p>)}
                {isLoading && conversation.length > 0 && <LoadingSpinner size={16} className="mx-auto my-2" />}
                <div ref={conversationEndRef} />
              </ScrollArea>
              <div className="text-xs text-muted-foreground mb-2">Optional: Type a response instead of speaking.</div>
              <UserInputArea onSubmit={processAgentTurn} disabled={isLoading || isAiSpeaking || isCallEnded} />
              {error && (<Alert variant="destructive" className="mt-3"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}
            </CardContent>
            <CardFooter className="flex justify-between items-center">
                 <Button onClick={handleReset} variant="outline" size="sm"><Redo className="mr-2 h-4 w-4"/> New Call</Button>
                <Button onClick={handleEndCall} variant="destructive" size="sm" disabled={isLoading || isCallEnded}><PhoneOff className="mr-2 h-4 w-4"/> End Interaction & Get Score</Button>
            </CardFooter>
          </Card>
        )}

        {isCallEnded && finalScore && (
          <div className="w-full max-w-4xl mx-auto mt-4">
             <CallScoringResultsCard results={finalScore} fileName={`Interaction: ${selectedProduct} with ${userName || "Customer"}`} isHistoricalView={true} />
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
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your response here..." disabled={disabled} autoComplete="off" />
      <Button type="submit" disabled={disabled || !text.trim()}><Send className="h-4 w-4"/></Button>
    </form>
  )
}
