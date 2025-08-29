
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
import { Textarea } from '@/components/ui/textarea';

import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { useWhisper } from '@/hooks/use-whisper';
import { useProductContext } from '@/hooks/useProductContext';
import { GOOGLE_PRESET_VOICES, SAMPLE_TEXT } from '@/hooks/use-voice-samples'; 
import { synthesizeSpeechOnClient } from '@/lib/tts-client';


import { Product, ConversationTurn, VoiceSupportAgentActivityDetails, KnowledgeFile, VoiceSupportAgentFlowInput, ScoreCallOutput } from '@/types';
import { runVoiceSupportAgentQuery } from '@/ai/flows/voice-support-agent-flow';
import { scoreCall } from '@/ai/flows/call-scoring';

import { Headphones, Send, AlertTriangle, Bot, SquareTerminal, User as UserIcon, Info, Mic, Wifi, Redo, Settings, Volume2, Loader2, PhoneOff, Star, Separator, Download, Copy, FileAudio, PauseCircle, PlayCircle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';
import { exportPlainTextFile, downloadDataUriFile } from '@/lib/export';

// Helper to prepare Knowledge Base context
const prepareKnowledgeBaseContext = (
  knowledgeBaseFiles: KnowledgeFile[] | undefined,
  product: Product
): string => {
  if (!knowledgeBaseFiles || !Array.isArray(knowledgeBaseFiles)) {
    return "Knowledge Base not yet loaded or is empty.";
  }
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

type SupportCallState = "IDLE" | "CONFIGURING" | "LISTENING" | "PROCESSING" | "AI_SPEAKING" | "ENDED" | "ERROR";

export default function VoiceSupportAgentPage() {
  const [callState, setCallState] = useState<SupportCallState>("CONFIGURING");
  const [currentTranscription, setCurrentTranscription] = useState("");
  const [agentName, setAgentName] = useState<string>(""); 
  const [userName, setUserName] = useState<string>(""); 

  const { availableProducts } = useProductContext();
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  
  const [conversationLog, setConversationLog] = useState<ConversationTurn[]>([]);
  const currentActivityId = useRef<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  
  const [finalCallArtifacts, setFinalCallArtifacts] = useState<{ transcript: string, audioUri?: string, score?: ScoreCallOutput } | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isScoringPostCall, setIsScoringPostCall] = useState(false);
  const [isVoicePreviewPlaying, setIsVoicePreviewPlaying] = useState(false);

  const { toast } = useToast();
  const { logActivity, updateActivity } = useActivityLogger();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const conversationEndRef = useRef<null | HTMLDivElement>(null);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(GOOGLE_PRESET_VOICES[0].id);
  const isInteractionStarted = callState !== 'CONFIGURING' && callState !== 'IDLE' && callState !== 'ENDED';

   useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationLog]);
  
  const playAudio = useCallback((audioDataUri: string, turnId: string) => {
    if (audioPlayerRef.current) {
        setCurrentlyPlayingId(turnId);
        setCallState("AI_SPEAKING");
        audioPlayerRef.current.src = audioDataUri;
        audioPlayerRef.current.play().catch(e => {
            console.error("Audio playback error:", e);
            setCallState("LISTENING");
        });
    }
  }, []);

  const cancelAudio = useCallback(() => {
    if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = "";
    }
    setCurrentlyPlayingId(null);
    setCurrentWordIndex(-1);
    if(callState === "AI_SPEAKING") {
        setCallState("LISTENING");
    }
  }, [callState]);
  
  const synthesizeAndPlay = useCallback(async (text: string, turnId: string) => {
    try {
        const textToSynthesize = text.replace(/\bET\b/g, 'E T');
        const synthesisResult = await synthesizeSpeechOnClient({ text: textToSynthesize, voice: selectedVoiceId });
        setConversationLog(prev => prev.map(turn => turn.id === turnId ? { ...turn, audioDataUri: synthesisResult.audioDataUri } : turn));
        playAudio(synthesisResult.audioDataUri, turnId);
    } catch(e: any) {
        toast({variant: 'destructive', title: 'TTS Error', description: e.message});
        setCallState('LISTENING');
    }
  }, [playAudio, selectedVoiceId, toast]);

  const runSupportQuery = useCallback(async (queryText: string, currentConversation: ConversationTurn[]) => {
    if (!selectedProduct || !agentName.trim()) {
      toast({ variant: "destructive", title: "Missing Info", description: "Please select a Product and enter an Agent Name." });
      setCallState("CONFIGURING");
      return;
    }
    
    setCallState("PROCESSING");
    setError(null);
    
    const kbContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, selectedProduct as Product);
    if (kbContext.startsWith("No specific knowledge base")) {
        toast({ variant: "default", title: "Limited KB", description: `Knowledge Base for ${selectedProduct} is sparse. Answers may be general.`, duration: 5000});
    }

    const flowInput: VoiceSupportAgentFlowInput = {
      product: selectedProduct as Product,
      agentName: agentName,
      userName: userName,
      userQuery: queryText,
      knowledgeBaseContext: kbContext,
      conversationHistory: currentConversation,
    };

    try {
      const result = await runVoiceSupportAgentQuery(flowInput);
      if (result.errorMessage) throw new Error(result.errorMessage);

      const aiTurn: ConversationTurn = { id: `ai-${Date.now()}`, speaker: 'AI', text: result.aiResponseText || "(No response generated)", timestamp: new Date().toISOString()};
      const updatedConversation = [...currentConversation, aiTurn];
      setConversationLog(updatedConversation);
      
      if (result.aiResponseText) {
          await synthesizeAndPlay(result.aiResponseText, aiTurn.id);
      } else {
          setCallState("LISTENING");
      }
      
      const activityDetails: Partial<VoiceSupportAgentActivityDetails> = {
        flowInput: flowInput, 
        flowOutput: result,
        fullTranscriptText: updatedConversation.map(t => `${t.speaker}: ${t.text}`).join('\n'),
        fullConversation: updatedConversation,
        error: result.errorMessage
      };

      if (currentActivityId.current) {
        updateActivity(currentActivityId.current, activityDetails);
      } else {
        const activityId = logActivity({ module: "AI Voice Support Agent", product: selectedProduct, details: activityDetails });
        currentActivityId.current = activityId;
      }
    } catch (e: any) {
      const detailedError = e.message || "An unexpected error occurred.";
      setError(detailedError);
      setCallState("ERROR");
      const errorTurn: ConversationTurn = { id: `error-${Date.now()}`, speaker: 'AI', text: detailedError, timestamp: new Date().toISOString() };
      setConversationLog(prev => [...prev, errorTurn]);
    }
  }, [selectedProduct, agentName, userName, knowledgeBaseFiles, logActivity, updateActivity, toast, synthesizeAndPlay]);

  const { startRecording, stopRecording, isRecording } = useWhisper({
    onTranscriptionComplete: (text: string) => {
        setCurrentTranscription("");
        if (!text.trim() || callState === 'PROCESSING' || callState === 'CONFIGURING' || callState === 'ENDED') return;
        const userTurn: ConversationTurn = { id: `user-${Date.now()}`, speaker: 'User', text: text, timestamp: new Date().toISOString() };
        const updatedConversation = [...conversationLog, userTurn];
        setConversationLog(updatedConversation);
        runSupportQuery(text, updatedConversation);
    },
    onTranscribe: (text: string) => {
        setCurrentTranscription(text);
        cancelAudio();
    },
    stopTimeout: 1,
  });

  const handleEndInteraction = useCallback(() => {
    if (callState === "ENDED") return;
    
    stopRecording();
    const finalConversation = [...conversationLog];
    setCallState("ENDED");

    if (!currentActivityId.current && finalConversation.length > 0) {
        const activityId = logActivity({
          module: "AI Voice Support Agent",
          product: selectedProduct,
          details: { status: 'Completed', fullTranscriptText: finalConversation.map(turn => `${turn.speaker}: ${turn.text}`).join('\n'), fullConversation: finalConversation }
        });
        currentActivityId.current = activityId;
    } else if (currentActivityId.current) {
        updateActivity(currentActivityId.current, { status: 'Completed', fullTranscriptText: finalConversation.map(turn => `${turn.speaker}: ${turn.text}`).join('\n'), fullConversation: finalConversation });
    }
    
    const finalTranscriptText = finalConversation.map(turn => `${turn.speaker}: ${turn.text}`).join('\n');
    setFinalCallArtifacts({ transcript: finalTranscriptText });
    
  }, [callState, conversationLog, updateActivity, toast, selectedProduct, logActivity, stopRecording]);
  
  useEffect(() => {
    const audioEl = audioPlayerRef.current;
    if (audioEl) {
        const onEnd = () => {
          setCurrentlyPlayingId(null);
          setCurrentWordIndex(-1);
          if (callState === "AI_SPEAKING") {
            setCallState('LISTENING');
          }
        };
         const onTimeUpdate = () => {
            if (audioEl && !audioEl.paused && currentlyPlayingId) {
                const turn = conversationLog.find(t => t.id === currentlyPlayingId);
                if (turn) {
                    const words = turn.text.split(/(\s+)/);
                    const durationPerWord = audioEl.duration / (words.length || 1);
                    const newWordIndex = Math.floor(audioEl.currentTime / durationPerWord);
                    setCurrentWordIndex(newWordIndex);
                }
            }
        };
        audioEl.addEventListener('ended', onEnd);
        audioEl.addEventListener('timeupdate', onTimeUpdate);
        audioEl.addEventListener('pause', onEnd);
        return () => {
            if(audioEl) {
                audioEl.removeEventListener('ended', onEnd);
                audioEl.removeEventListener('timeupdate', onTimeUpdate);
                audioEl.removeEventListener('pause', onEnd);
            }
        };
    }
  }, [callState, conversationLog, currentlyPlayingId]);

  useEffect(() => {
    if (callState === 'LISTENING' && !isRecording) {
        startRecording();
    } else if (callState !== 'LISTENING' && isRecording) {
        stopRecording();
    }
  }, [callState, isRecording, startRecording, stopRecording]);

  const handlePreviewVoice = useCallback(async () => {
    setIsVoicePreviewPlaying(true);
    try {
        const result = await synthesizeSpeechOnClient({ text: SAMPLE_TEXT, voice: selectedVoiceId });
        const tempAudio = new Audio(result.audioDataUri);
        tempAudio.play();
        tempAudio.onended = () => setIsVoicePreviewPlaying(false);
        tempAudio.onerror = (e) => {
            console.error("Audio preview playback error:", e);
            toast({variant: 'destructive', title: 'Audio Playback Error', description: 'Could not play the generated voice sample.'});
            setIsVoicePreviewPlaying(false);
        }
    } catch(e: any) {
        toast({variant: 'destructive', title: 'TTS Error', description: e.message});
        setIsVoicePreviewPlaying(false);
    }
  }, [selectedVoiceId, toast]);

  const handleStartInteraction = () => {
    if (!selectedProduct || !agentName.trim()) {
      toast({ variant: "destructive", title: "Missing Info", description: "Please select a Product and enter an Agent Name." });
      return;
    }
    const welcomeText = `Hello ${userName || 'there'}, this is ${agentName}. How can I help you today regarding ${availableProducts.find(p=>p.name===selectedProduct)?.displayName || selectedProduct}?`;
    const welcomeTurn: ConversationTurn = { id: `ai-${Date.now()}`, speaker: 'AI', text: welcomeText, timestamp: new Date().toISOString()};
    setConversationLog([welcomeTurn]);
    setCallState("PROCESSING");
    
    synthesizeAndPlay(welcomeText, welcomeTurn.id);
  }

  const handleReset = () => {
    if (currentActivityId.current && callState !== 'CONFIGURING') {
      updateActivity(currentActivityId.current, { status: 'Completed (Reset)', fullTranscriptText: conversationLog.map(t => `${t.speaker}: ${t.text}`).join('\n'), fullConversation: conversationLog });
      toast({ title: 'Interaction Logged', description: 'The previous session was logged before resetting.' });
    }
    setCallState("CONFIGURING");
    currentActivityId.current = null;
    setConversationLog([]);
    setError(null);
    setFinalCallArtifacts(null);
    setCurrentTranscription("");
    setIsGeneratingAudio(false);
    setIsScoringPostCall(false);
    if (callState === 'AI_SPEAKING') cancelAudio();
  };
  
    const handleScorePostCall = async () => {
    if (!finalCallArtifacts || !finalCallArtifacts.transcript || !selectedProduct) {
        toast({variant: 'destructive', title: "Error", description: "No final transcript or product context available to score."});
        return;
    }
    setIsScoringPostCall(true);
    try {
        const productData = availableProducts.find(p => p.name === selectedProduct);
        const productContext = productData ? prepareKnowledgeBaseContext(knowledgeBaseFiles, selectedProduct as Product) : "No product context available.";
        
        const scoreOutput = await scoreCall({
            product: selectedProduct as Product,
            agentName: agentName,
            transcriptOverride: finalCallArtifacts.transcript,
            productContext: productContext
        });

        setFinalCallArtifacts(prev => prev ? { ...prev, score: scoreOutput } : null);
        if (currentActivityId.current) {
            updateActivity(currentActivityId.current, { finalScore: scoreOutput });
        }
        toast({ title: "Scoring Complete!", description: "The interaction has been scored successfully."});
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Scoring Failed", description: e.message });
    } finally {
        setIsScoringPostCall(false);
    }
  };


  const getCallStatusBadge = () => {
    switch (callState) {
        case "LISTENING":
            return <Badge variant="default" className="text-xs bg-green-100 text-green-800"><Mic className="mr-1.5 h-3.5 w-3.5"/>Listening...</Badge>;
        case "AI_SPEAKING":
            return <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800"><Bot className="mr-1.5 h-3.5 w-3.5"/>AI Speaking (interruptible)</Badge>;
        case "PROCESSING":
            return <Badge variant="secondary" className="text-xs"><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/>Processing...</Badge>;
        case "ENDED":
            return <Badge variant="secondary" className="text-xs bg-gray-200 text-gray-600"><PhoneOff className="mr-1.5 h-3.5 w-3.5"/>Ended</Badge>;
        case "ERROR":
            return <Badge variant="destructive" className="text-xs"><AlertTriangle className="mr-1.5 h-3.5 w-3.5"/>Error</Badge>;
        case "CONFIGURING":
             return <Badge variant="outline" className="text-xs">Idle</Badge>;
        default:
            return <Badge variant="outline" className="text-xs">Idle</Badge>;
    }
  }

  return (
    <div className="flex flex-col h-full">
      <audio ref={audioPlayerRef} className="hidden" />
      <PageHeader title="AI Voice Support Agent" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        
        <Card className="w-full max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Headphones className="mr-2 h-6 w-6 text-primary"/> AI Customer Support Configuration</CardTitle>
            <CardDescription>
                Set up agent and customer context, product, and voice profile. Then start the interaction.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <Accordion type="single" collapsible defaultValue={callState === 'CONFIGURING' ? "item-config" : ""} className="w-full">
                <AccordionItem value="item-config">
                    <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90 [&[data-state=open]>&svg]:rotate-180">
                         <div className="flex items-center"><Settings className="mr-2 h-4 w-4 text-accent"/>Context Configuration</div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-3 space-y-4">
                        <div className="space-y-1">
                             <Label>AI Voice Profile <span className="text-destructive">*</span></Label>
                              <div className="mt-2">
                                 <div className="flex items-center gap-2">
                                    <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId} disabled={isInteractionStarted}>
                                        <SelectTrigger className="flex-grow"><SelectValue placeholder={"Loading voices..."} /></SelectTrigger>
                                        <SelectContent>{GOOGLE_PRESET_VOICES.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Button variant="outline" size="sm" onClick={handlePreviewVoice} disabled={isVoicePreviewPlaying || isInteractionStarted}>
                                       {isVoicePreviewPlaying ? <PauseCircle className="h-4 w-4"/> : <PlayCircle className="h-4 w-4"/>}
                                    </Button>
                                </div>
                             </div>
                        </div>
                       <div className="space-y-1">
                          <Label htmlFor="product-select-support">Product <span className="text-destructive">*</span></Label>
                           <Select value={selectedProduct} onValueChange={(value) => setSelectedProduct(value as Product)} disabled={isInteractionStarted}>
                              <SelectTrigger id="product-select-support">
                                  <SelectValue placeholder="Select a Product" />
                              </SelectTrigger>
                              <SelectContent>
                                  {availableProducts.map((p) => (
                                      <SelectItem key={p.name} value={p.name}>{p.displayName}</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1"><Label htmlFor="support-agent-name">Agent Name <span className="text-destructive">*</span></Label><Input id="support-agent-name" placeholder="e.g., SupportBot (AI)" value={agentName} onChange={e => setAgentName(e.target.value)} disabled={isInteractionStarted}/></div>
                            <div className="space-y-1"><Label htmlFor="support-user-name">Customer Name (Optional)</Label><Input id="support-user-name" placeholder="e.g., Priya Sharma" value={userName} onChange={e => setUserName(e.target.value)} disabled={isInteractionStarted} /></div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
             {callState === 'CONFIGURING' && (
                <Button onClick={handleStartInteraction} disabled={callState !== 'CONFIGURING' || !selectedProduct || !agentName.trim()} className="w-full mt-4">
                    <Wifi className="mr-2 h-4 w-4"/> Start Interaction
                </Button>
            )}
          </CardContent>
        </Card>

        {isInteractionStarted && (
            <Card className="w-full max-w-3xl mx-auto mt-4">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between"> 
                         <div className="flex items-center"><SquareTerminal className="mr-2 h-5 w-5 text-primary"/> Ask a Question / Log Interaction</div>
                         {getCallStatusBadge()}
                    </CardTitle>
                     <CardDescription>
                        Type your question below and hit send, or just start speaking. The AI will respond based on its Knowledge Base for product '{selectedProduct}'.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[300px] w-full border rounded-md p-3 bg-muted/10 mb-3">
                        {conversationLog.map((turn) => (<ConversationTurnComponent key={turn.id} turn={turn} onPlayAudio={playAudio} currentlyPlayingId={currentlyPlayingId} wordIndex={turn.id === currentlyPlayingId ? currentWordIndex : -1} />))}
                        {isRecording && (
                            <div className="flex items-start gap-2 my-3 justify-end">
                                <div className="flex flex-col gap-1 items-end">
                                    <Card className="max-w-full w-fit p-3 rounded-xl shadow-sm bg-accent text-accent-foreground rounded-br-none">
                                        <CardContent className="p-0 text-sm">
                                            <p className="italic text-accent-foreground/80">User: {currentTranscription || " Listening..."}</p>
                                        </CardContent>
                                    </Card>
                                </div>
                                <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="bg-accent text-accent-foreground"><UserIcon size={18}/></AvatarFallback></Avatar>
                            </div>
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
                        onSubmit={(text) => {
                          const userTurn: ConversationTurn = { id: `user-${Date.now()}`, speaker: 'User', text: text, timestamp: new Date().toISOString() };
                          const updatedConversation = [...conversationLog, userTurn];
                          setConversationLog(updatedConversation);
                          setCurrentTranscription("");
                          runSupportQuery(text, updatedConversation);
                        }}
                        disabled={callState !== 'LISTENING'}
                    />
                </CardContent>
                 <CardFooter className="flex justify-between items-center pt-4">
                     <Button onClick={handleEndInteraction} variant="destructive" size="sm" disabled={callState === "ENDED"}>
                       <PhoneOff className="mr-2 h-4 w-4"/> End Interaction
                    </Button>
                    <Button onClick={handleReset} variant="outline" size="sm">
                        <Redo className="mr-2 h-4 w-4"/> New Interaction
                    </Button>
                </CardFooter>
            </Card>
        )}

         {finalCallArtifacts && callState === 'ENDED' && (
            <Card className="w-full max-w-4xl mx-auto mt-4">
                <CardHeader>
                    <CardTitle>Interaction Review & Scoring</CardTitle>
                    <CardDescription>Review the completed interaction transcript and score it.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="final-transcript-support">Full Transcript</Label>
                        <Textarea id="final-transcript-support" value={finalCallArtifacts.transcript} readOnly className="h-40 text-xs bg-muted/50 mt-1"/>
                    </div>
                    <Separator/>
                    {finalCallArtifacts.score ? (
                        <Alert variant="default" className="bg-green-50 border-green-200">
                            <AlertTitle className="text-green-800">Interaction Scored!</AlertTitle>
                            <AlertDescription className="text-green-700">
                                Overall Score: {finalCallArtifacts.score.overallScore.toFixed(1)}/5 ({finalCallArtifacts.score.callCategorisation}). View details in the Call Scoring Dashboard.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div>
                             <h4 className="text-md font-semibold">Score this Interaction</h4>
                             <p className="text-sm text-muted-foreground mb-2">Run AI analysis on the final transcript.</p>
                             <Button onClick={handleScorePostCall} disabled={isScoringPostCall || isGeneratingAudio || !finalCallArtifacts.transcript}>
                                {isScoringPostCall ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Star className="mr-2 h-4 w-4"/>}
                                {isScoringPostCall ? "Scoring..." : "Run AI Scoring"}
                            </Button>
                        </div>
                    )}
                </CardContent>
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
        placeholder="Type your question here..."
        disabled={disabled}
        autoComplete="off"
      />
      <Button type="submit" disabled={disabled || !text.trim()}>
        <Send className="h-4 w-4"/>
      </Button>
    </form>
  )
}
