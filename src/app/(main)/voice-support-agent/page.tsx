
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

import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { useWhisper } from '@/hooks/useWhisper';
import { useProductContext } from '@/hooks/useProductContext';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';

import { Product, ConversationTurn, VoiceSupportAgentActivityDetails, KnowledgeFile, VoiceSupportAgentFlowInput, ScoreCallOutput } from '@/types';
import { runVoiceSupportAgentQuery } from '@/ai/flows/voice-support-agent-flow';
import { generateFullCallAudio } from '@/ai/flows/generate-full-call-audio';
import { scoreCall } from '@/ai/flows/call-scoring';
import { cn } from '@/lib/utils';

import { Headphones, Send, AlertTriangle, Bot, SquareTerminal, User as UserIcon, Info, Mic, Wifi, Redo, Settings, Volume2, Loader2, PhoneOff, Star, Separator, Download, Copy, FileAudio } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';
import { exportPlainTextFile, downloadDataUriFile } from '@/lib/export';

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

type SupportCallState = "IDLE" | "CONFIGURING" | "LISTENING" | "PROCESSING" | "AI_SPEAKING" | "ENDED" | "ERROR";

export default function VoiceSupportAgentPage() {
  const [callState, setCallState] = useState<SupportCallState>("CONFIGURING");
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

  const { toast } = useToast();
  const { logActivity, updateActivity } = useActivityLogger();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const conversationEndRef = useRef<null | HTMLDivElement>(null);
  
   useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationLog]);

  const { isSupported: isTtsSupported, isSpeaking: isAiSpeaking, speak, cancel: cancelTts, curatedVoices, isLoading: areVoicesLoading } = useSpeechSynthesis({
    onStart: () => setCallState("AI_SPEAKING"),
    onEnd: (isSample) => { if(!isSample && callState !== "ENDED") setCallState("LISTENING"); },
  });
  const [selectedVoiceName, setSelectedVoiceName] = useState<string | undefined>(undefined);
  
  useEffect(() => {
    if (curatedVoices.length > 0 && !selectedVoiceName) {
      const defaultVoice = curatedVoices.find(v => v.isDefault);
      setSelectedVoiceName(defaultVoice ? defaultVoice.name : curatedVoices[0].name);
    }
  }, [curatedVoices, selectedVoiceName]);
  
  const selectedVoiceObject = curatedVoices.find(v => v.name === selectedVoiceName)?.voice;
  const isInteractionStarted = callState !== 'CONFIGURING' && callState !== 'IDLE' && callState !== 'ENDED';
  
  const runSupportQuery = useCallback(async (queryText: string, currentConversation: ConversationTurn[]) => {
    if (!selectedProduct || !agentName.trim()) {
      toast({ variant: "destructive", title: "Missing Info", description: "Please select a Product and enter an Agent Name." });
      setCallState("CONFIGURING");
      return;
    }
    if (!isTtsSupported) {
       toast({ variant: "destructive", title: "TTS Not Supported", description: "Your browser does not support Speech Synthesis. Please use a different browser." });
      setCallState("ERROR");
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

      if (result.aiResponseText) {
          const aiTurn: ConversationTurn = { id: `ai-${Date.now()}`, speaker: 'AI', text: result.aiResponseText, timestamp: new Date().toISOString() };
          setConversationLog(prev => [...prev, aiTurn]);
          speak({text: result.aiResponseText, voice: selectedVoiceObject});
      } else {
        setCallState("LISTENING");
      }
      
      const updatedConversation = [...currentConversation, ...(result.aiResponseText ? [{id: `ai-${Date.now()}`, speaker: 'AI' as const, text: result.aiResponseText, timestamp: new Date().toISOString() }] : [])];
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
  }, [selectedProduct, agentName, userName, isTtsSupported, knowledgeBaseFiles, speak, selectedVoiceObject, logActivity, updateActivity, toast]);

  const handleTranscriptionComplete = useCallback((text: string) => {
    if (!text.trim() || callState === 'PROCESSING' || callState === 'CONFIGURING' || callState === 'ENDED') return;
    
    // If AI is speaking, this is an interruption. Stop it.
    if(isAiSpeaking) cancelTts();
    
    const userTurn: ConversationTurn = { id: `user-${Date.now()}`, speaker: 'User', text: text, timestamp: new Date().toISOString() };
    const updatedConversation = [...conversationLog, userTurn];
    setConversationLog(updatedConversation);
    runSupportQuery(text, updatedConversation);
  }, [callState, conversationLog, runSupportQuery, isAiSpeaking, cancelTts]);


  const { startRecording, stopRecording, isRecording, transcript } = useWhisper({
    onTranscriptionComplete: handleTranscriptionComplete,
    onTranscribe: (text) => {
      // If we detect any speech while the AI is talking, it's a barge-in.
      if (isAiSpeaking && text.trim()) {
        cancelTts();
      }
    },
    stopTimeout: 90,
  });

  const handleEndInteraction = useCallback(() => {
    if (callState === "ENDED") return;
    
    const finalConversation = [...conversationLog];
    setCallState("ENDED");

    if (!currentActivityId.current) {
        // Log a new activity if one doesn't exist for some reason
        const activityId = logActivity({
          module: "AI Voice Support Agent",
          product: selectedProduct,
          details: { status: 'Processing Audio', fullTranscriptText: finalConversation.map(turn => `${turn.speaker}: ${turn.text}`).join('\n'), fullConversation: finalConversation }
        });
        currentActivityId.current = activityId;
    } else {
        updateActivity(currentActivityId.current, { status: 'Processing Audio', fullTranscriptText: finalConversation.map(turn => `${turn.speaker}: ${turn.text}`).join('\n'), fullConversation: finalConversation });
    }
    
    const finalTranscriptText = finalConversation.map(turn => `${turn.speaker}: ${turn.text}`).join('\n');
    setFinalCallArtifacts({ transcript: finalTranscriptText });
    setIsGeneratingAudio(true);
    toast({ title: 'Interaction Ended', description: 'Generating final transcript and audio recording...' });


    (async () => {
        try {
            const audioResult = await generateFullCallAudio({
                conversationHistory: finalConversation,
            });
            if (audioResult.audioDataUri) {
                setFinalCallArtifacts(prev => prev ? { ...prev, audioUri: audioResult.audioDataUri } : { transcript: finalTranscriptText, audioUri: audioResult.audioDataUri });
                updateActivity(currentActivityId.current!, { status: 'Completed', fullCallAudioDataUri: audioResult.audioDataUri });
            } else if (audioResult.errorMessage) {
                console.error("Audio generation failed:", audioResult.errorMessage);
                toast({variant: 'destructive', title: 'Audio Generation Failed', description: audioResult.errorMessage});
                updateActivity(currentActivityId.current!, { status: 'Completed', error: `Audio generation failed: ${audioResult.errorMessage}` });
            }
        } catch(e: any) {
             console.error("Audio generation exception:", e.message);
             toast({variant: 'destructive', title: 'Audio Generation Exception', description: e.message});
             updateActivity(currentActivityId.current!, { status: 'Completed', error: `Audio generation exception: ${e.message}` });
        } finally {
            setIsGeneratingAudio(false);
        }
    })();

  }, [callState, conversationLog, updateActivity, toast, selectedProduct, logActivity]);
  

  // Microphone control based on call state
  useEffect(() => {
    if (callState === 'CONFIGURING' || callState === 'ENDED' || callState === 'ERROR' || callState === 'IDLE') {
        stopRecording();
    } else if (!isRecording) {
        startRecording();
    }
  }, [callState, isRecording, startRecording, stopRecording]);


  const handleStartInteraction = () => {
    if (!selectedProduct || !agentName.trim()) {
      toast({ variant: "destructive", title: "Missing Info", description: "Please select a Product and enter an Agent Name." });
      return;
    }
    setCallState("LISTENING");
    toast({title: "Interaction Started", description: "You can now ask your questions."});
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
    setIsGeneratingAudio(false);
    setIsScoringPostCall(false);
    if (isAiSpeaking) cancelTts();
  };
  
    const handleScorePostCall = async () => {
    if (!finalCallArtifacts || !finalCallArtifacts.transcript || !selectedProduct) {
        toast({variant: 'destructive', title: "Error", description: "No final transcript or product context available to score."});
        return;
    }
    setIsScoringPostCall(true);
    try {
        const scoreOutput = await scoreCall({
            transcriptOverride: finalCallArtifacts.transcript,
            product: selectedProduct,
            agentName: agentName,
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
                    <AccordionContent className="pt-3 space-y-3">
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
                         <div className="mt-4 pt-4 border-t">
                             <Label>AI Voice Profile <span className="text-destructive">*</span></Label>
                              <div className="mt-2">
                                 <div className="flex items-center gap-2">
                                    <Select value={selectedVoiceName} onValueChange={setSelectedVoiceName} disabled={isInteractionStarted || areVoicesLoading}>
                                        <SelectTrigger className="flex-grow"><SelectValue placeholder={areVoicesLoading ? "Loading voices..." : "Select a voice"} /></SelectTrigger>
                                        <SelectContent>{curatedVoices.map(v => <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Button variant="outline" size="icon" onClick={() => speak({text: "Hello, this is a sample of my voice.", voice: selectedVoiceObject, isSample: true})} disabled={!selectedVoiceObject || isAiSpeaking} title="Play sample">
                                        <Volume2 className="h-4 w-4"/>
                                    </Button>
                                </div>
                             </div>
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
                        {conversationLog.map((turn) => (<ConversationTurnComponent key={turn.id} turn={turn} />))}
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
                        onSubmit={(text) => {
                          const userTurn: ConversationTurn = { id: `user-${Date.now()}`, speaker: 'User', text: text, timestamp: new Date().toISOString() };
                          const updatedConversation = [...conversationLog, userTurn];
                          setConversationLog(updatedConversation);
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
                     <div>
                        <Label>Full Recording</Label>
                        {isGeneratingAudio ? (
                            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Generating full audio recording...</div>
                        ) : finalCallArtifacts.audioUri ? (
                            <div className="mt-1 flex items-center gap-2">
                                <audio controls src={finalCallArtifacts.audioUri} className="w-full h-10"/>
                                <Button size="icon" variant="outline" onClick={() => downloadDataUriFile(finalCallArtifacts.audioUri!, 'support_interaction.wav')}><Download className="h-4 w-4"/></Button>
                            </div>
                         ) : <p className="text-sm text-muted-foreground mt-1">Audio recording generation failed or was unavailable.</p>}
                    </div>
                    <Separator/>
                    {finalCallArtifacts.score ? (
                        <Alert variant="default" className="bg-green-50 border-green-200">
                            <AlertTitle className="text-green-800">Interaction Scored!</AlertTitle>
                            <AlertDescription className="text-green-700">
                                Overall Score: {finalCallArtifacts.score.overallScore.toFixed(1)}/5 ({finalCallArtifacts.score.callCategorisation}).
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
