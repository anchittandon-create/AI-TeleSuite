
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { useWhisper, RecognitionState } from '@/hooks/useWhisper';
import { useProductContext } from '@/hooks/useProductContext';
import { GOOGLE_PRESET_VOICES, SAMPLE_TEXT } from '@/hooks/use-voice-samples'; 
import { synthesizeSpeechOnClient } from '@/lib/tts-client';


import { Product, ConversationTurn, VoiceSupportAgentActivityDetails, KnowledgeFile, VoiceSupportAgentFlowInput, ScoreCallOutput, ProductObject } from '@/types';
import { runVoiceSupportAgentQuery } from '@/ai/flows/voice-support-agent-flow';
import { generateFullCallAudio } from '@/ai/flows/generate-full-call-audio';

import { Headphones, Send, AlertTriangle, Bot, SquareTerminal, User as UserIcon, Info, Mic, Wifi, Redo, Settings, Volume2, Loader2, PhoneOff, Star, Download, Copy, FileAudio, PauseCircle, PlayCircle, BookOpen } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';
import { exportPlainTextFile, downloadDataUriFile } from '@/lib/export';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, parseISO } from 'date-fns';
import { Separator } from "@/components/ui/separator";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// Helper to prepare Knowledge Base context
const prepareKnowledgeBaseContext = (
  knowledgeBaseFiles: KnowledgeFile[],
  productObject: ProductObject,
  conversationHistory: ConversationTurn[]
): string => {
    const MAX_TOTAL_CONTEXT_LENGTH = 30000;
    let combinedContext = `--- START OF KNOWLEDGE BASE CONTEXT FOR PRODUCT: ${productObject.displayName} ---\n`;
    combinedContext += `Description: ${productObject.description || 'Not provided'}\n`;
    
    const productSpecificFiles = knowledgeBaseFiles.filter(f => f.product === productObject.name);

    // Simple keyword extraction from recent conversation
    const recentConvoText = conversationHistory.slice(-4).map(t => t.text).join(' ').toLowerCase();
    const keywords = new Set(recentConvoText.match(/\b(\w{4,})\b/g) || []);

    const scoreFile = (file: KnowledgeFile): number => {
        let score = 0;
        // Prioritize files relevant to support queries
        if (file.category === 'Product Description') score += 10;
        if (file.category === 'General') score += 8;
        if (file.category === 'Pricing') score += 5; // Might be relevant for billing questions
        if (file.category === 'Rebuttals') score += 4;
        
        keywords.forEach(kw => {
            if (file.name.toLowerCase().includes(kw)) score += 3;
            if (file.textContent?.toLowerCase().includes(kw)) score += 2;
        });
        return score;
    };

    const sortedFiles = productSpecificFiles
        .map(file => ({ ...file, score: scoreFile(file) }))
        .sort((a, b) => b.score - a.score);

    for (const file of sortedFiles) {
        if (file.isTextEntry && file.textContent) {
            const itemContext = `\n--- Item: ${file.name} (Category: ${file.category || 'General'})\nContent:\n${file.textContent}\n---`;
            if (combinedContext.length + itemContext.length <= MAX_TOTAL_CONTEXT_LENGTH) {
                combinedContext += itemContext;
            }
        }
    }

    if (productSpecificFiles.length === 0) {
        combinedContext += "No specific files or text entries were found for this product in the Knowledge Base.\n";
    }

    if(combinedContext.length >= MAX_TOTAL_CONTEXT_LENGTH) {
        console.warn("Knowledge base context truncated due to length limit.");
    }
    
    combinedContext += `--- END OF KNOWLEDGE BASE CONTEXT ---`;
    return combinedContext.substring(0, MAX_TOTAL_CONTEXT_LENGTH);
};

type SupportCallState = "IDLE" | "CONFIGURING" | "LISTENING" | "PROCESSING" | "AI_SPEAKING" | "ENDED" | "ERROR";

export default function VoiceSupportAgentPage() {
  const [callState, setCallState] = useState<SupportCallState>("CONFIGURING");
  const callStateRef = useRef(callState);
  useEffect(() => { callStateRef.current = callState; }, [callState]);
  
  const [currentTranscription, setCurrentTranscription] = useState("");
  const [agentName, setAgentName] = useState<string>(""); 
  const [userName, setUserName] = useState<string>(""); 

  const { availableProducts, getProductByName } = useProductContext();
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  
  const [conversationLog, setConversationLog] = useState<ConversationTurn[]>([]);
  const currentActivityId = useRef<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  
  const [finalCallArtifacts, setFinalCallArtifacts] = useState<{ transcript: string, audioUri?: string, score?: ScoreCallOutput } | null>(null);
  const [isScoringPostCall, setIsScoringPostCall] = useState(false);
  const [isVoicePreviewPlaying, setIsVoicePreviewPlaying] = useState(false);

  const { toast } = useToast();
  const { activities, logActivity, updateActivity } = useActivityLogger();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const conversationEndRef = useRef<null | HTMLDivElement>(null);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(GOOGLE_PRESET_VOICES[0].id);
  const isInteractionStarted = callState !== 'CONFIGURING' && callState !== 'IDLE' && callState !== 'ENDED';

  const productInfo = getProductByName(selectedProduct || "");
  
   useEffect(() => {
    if (conversationEndRef.current) {
        conversationEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversationLog, currentTranscription]);
  
  const cancelAudio = useCallback(() => {
    if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = "";
    }
    setCurrentlyPlayingId(null);
    setCurrentWordIndex(-1);
    if(callStateRef.current === "AI_SPEAKING") {
        setCallState("LISTENING");
    }
  }, []);
  
  const onTranscriptionCompleteRef = useRef<((text: string) => void) | null>(null);

  const handleUserSpeechInput = (text: string) => {
    if (callStateRef.current === 'AI_SPEAKING' && text.trim().length > 0) {
      cancelAudio();
    }
    setCurrentTranscription(text);
  };
  
  const { isRecording, startRecording, stopRecording } = useWhisper({
    onTranscriptionComplete: (text: string) => {
        if (onTranscriptionCompleteRef.current) {
            onTranscriptionCompleteRef.current(text);
        }
    },
    onTranscribe: handleUserSpeechInput,
    inactivityTimeout: 15000,
    silenceTimeout: 30,
  });

  const runSupportQuery = useCallback(async (queryText: string, currentConversation: ConversationTurn[]) => {
    if (!selectedProduct || !agentName.trim()) {
      toast({ variant: "destructive", title: "Missing Info", description: "Please select a Product and enter an Agent Name." });
      setCallState("CONFIGURING");
      return;
    }
    
    setCallState("PROCESSING");
    setError(null);
    
    const productObject = getProductByName(selectedProduct);
    if (!productObject) {
      toast({ variant: "destructive", title: "Error", description: "Selected product details not found." });
      setCallState("CONFIGURING");
      return;
    }
    
    const kbContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, productObject, currentConversation);
    if (kbContext.startsWith("No specific knowledge base content found")) {
        toast({ variant: "default", title: "Limited KB", description: `Knowledge Base for ${selectedProduct} is sparse. Answers may be general.`, duration: 5000});
    }

    const flowInput: VoiceSupportAgentFlowInput = {
      product: selectedProduct,
      agentName: agentName,
      userName: userName,
      userQuery: queryText,
      knowledgeBaseContext: kbContext,
      conversationHistory: currentConversation,
    };
    
    const synthesizeAndPlay = async (text: string, turnId: string) => {
        try {
            const textToSynthesize = text.replace(/\bET\b/g, 'E T');
            const synthesisResult = await synthesizeSpeechOnClient({ text: textToSynthesize, voice: selectedVoiceId });
            setConversationLog(prev => prev.map(turn => turn.id === turnId ? { ...turn, audioDataUri: synthesisResult.audioDataUri } : turn));
            if (audioPlayerRef.current) {
                setCurrentlyPlayingId(turnId);
                setCallState("AI_SPEAKING");
                audioPlayerRef.current.src = synthesisResult.audioDataUri;
                audioPlayerRef.current.play().catch(error => {
                    console.error("Audio playback error:", error);
                    setCallState("LISTENING");
                });
            }
        } catch (error: unknown) {
            toast({variant: 'destructive', title: 'TTS Error', description: getErrorMessage(error)});
            setCallState('LISTENING');
        }
    };

    try {
      const response = await fetch('/api/voice-support-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(flowInput),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
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
    } catch (error: unknown) {
      const detailedError = getErrorMessage(error) || "An unexpected error occurred.";
      setError(detailedError);
      setCallState("ERROR");
      const errorTurn: ConversationTurn = { id: `error-${Date.now()}`, speaker: 'AI', text: detailedError, timestamp: new Date().toISOString() };
      setConversationLog(prev => [...prev, errorTurn]);
    }
  }, [selectedProduct, agentName, userName, getProductByName, knowledgeBaseFiles, logActivity, updateActivity, toast, selectedVoiceId]);

  onTranscriptionCompleteRef.current = (text: string) => {
      if (callStateRef.current !== 'LISTENING' && callStateRef.current !== 'AI_SPEAKING') return;
      const userInputText = text.trim();
      setCurrentTranscription("");
      if (!userInputText) {
          runSupportQuery("", conversationLog);
          return;
      }
      const userTurn: ConversationTurn = { id: `user-${Date.now()}`, speaker: 'User', text: userInputText, timestamp: new Date().toISOString() };
      const updatedConversation = [...conversationLog, userTurn];
      setConversationLog(updatedConversation);
      runSupportQuery(userInputText, updatedConversation);
  };
  
  const handleEndInteraction = useCallback(async (status: 'Completed' | 'Completed (Page Unloaded)' = 'Completed') => {
    if (callStateRef.current === "ENDED") return;
    
    stopRecording();
    cancelAudio();
    setCallState("PROCESSING");
    
    const finalConversation = [...conversationLog];
    let fullAudioUri: string | undefined;

    try {
        const response = await fetch('/api/generate-full-call-audio', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ conversationHistory: finalConversation, agentVoiceProfile: selectedVoiceId }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const audioResult = await response.json();
        if(audioResult.audioDataUri) {
            fullAudioUri = audioResult.audioDataUri;
        } else if (audioResult.errorMessage) {
            toast({variant: 'destructive', title: "Audio Generation Failed", description: audioResult.errorMessage});
        }
    } catch (error: unknown) {
        toast({variant: 'destructive', title: "Audio Generation Error", description: getErrorMessage(error)});
    }

    setCallState("ENDED");

    const finalTranscriptText = finalConversation.map(turn => `[${format(parseISO(turn.timestamp), 'HH:mm:ss')}] ${turn.speaker}: ${turn.text}`).join('\n\n');
    setFinalCallArtifacts({ transcript: finalTranscriptText, audioUri: fullAudioUri });

    if (currentActivityId.current) {
      const existingActivity = activities.find(a => a.id === currentActivityId.current);
      if(existingActivity) {
        updateActivity(currentActivityId.current, { 
            ...existingActivity.details,
            status: status, 
            fullTranscriptText: finalTranscriptText, 
            fullConversation: finalConversation,
            fullCallAudioDataUri: fullAudioUri,
        });
      }
    }
    
  }, [conversationLog, updateActivity, toast, selectedVoiceId, stopRecording, cancelAudio, activities]);
  
  useEffect(() => {
    const audioEl = audioPlayerRef.current;
    const onEnd = () => {
      setCurrentlyPlayingId(null);
      setCurrentWordIndex(-1);
      if (callStateRef.current === "AI_SPEAKING") {
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
    if (audioEl) {
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
  }, [conversationLog, currentlyPlayingId]);

  useEffect(() => {
    if (callState === 'LISTENING' && !isRecording) {
        startRecording();
    } else if (callState !== 'LISTENING' && isRecording) {
        stopRecording();
    }
  }, [callState, isRecording, startRecording, stopRecording]);
  
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (isInteractionStarted && currentActivityId.current) {
            handleEndInteraction('Completed (Page Unloaded)');
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isInteractionStarted, handleEndInteraction]);


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
    } catch (error: unknown) {
        toast({variant: 'destructive', title: 'TTS Error', description: getErrorMessage(error)});
        setIsVoicePreviewPlaying(false);
    }
  }, [selectedVoiceId, toast]);

  const handleStartInteraction = async () => {
    if (!selectedProduct || !agentName.trim()) {
      toast({ variant: "destructive", title: "Missing Info", description: "Please select a Product and enter an Agent Name." });
      return;
    }
    const welcomeText = `Hello ${userName || 'there'}, this is ${agentName}. How can I help you today regarding ${availableProducts.find(p=>p.name===selectedProduct)?.displayName || selectedProduct}?`;
    const welcomeTurn: ConversationTurn = { id: `ai-${Date.now()}`, speaker: 'AI', text: welcomeText, timestamp: new Date().toISOString()};
    setConversationLog([welcomeTurn]);
    setCallState("PROCESSING");
    
    const activityDetails: Partial<VoiceSupportAgentActivityDetails> = {
      flowInput: { 
          product: selectedProduct, 
          agentName, 
          userName, 
          userQuery: '(Initiated Call)',
          knowledgeBaseContext: '', 
      },
      status: 'In Progress'
    };
    const activityId = logActivity({ module: "AI Voice Support Agent", product: selectedProduct, details: activityDetails });
    currentActivityId.current = activityId;
    
    try {
        const synthesisResult = await synthesizeSpeechOnClient({ text: welcomeText, voice: selectedVoiceId });
        setConversationLog(prev => prev.map(turn => turn.id === welcomeTurn.id ? { ...turn, audioDataUri: synthesisResult.audioDataUri } : turn));
        if (audioPlayerRef.current) {
            setCurrentlyPlayingId(welcomeTurn.id);
            setCallState("AI_SPEAKING");
            audioPlayerRef.current.src = synthesisResult.audioDataUri;
            audioPlayerRef.current.play().catch(error => {
                console.error("Audio playback error:", error);
                setCallState("LISTENING");
            });
        }
    } catch (error: unknown) {
        toast({variant: 'destructive', title: 'TTS Error on Welcome', description: getErrorMessage(error)});
        setCallState("LISTENING"); // Move to listening even if TTS fails
    }
  }

  const handleReset = () => {
    if (currentActivityId.current && callStateRef.current !== 'CONFIGURING') {
      const existingActivity = activities.find(a => a.id === currentActivityId.current);
      if(existingActivity) {
          updateActivity(currentActivityId.current, { 
              ...existingActivity.details,
              status: 'Completed (Reset)', 
              fullTranscriptText: conversationLog.map(t => `${t.speaker}: ${t.text}`).join('\n'), 
              fullConversation: conversationLog 
          });
      }
      toast({ title: 'Interaction Logged', description: 'The previous session was logged before resetting.' });
    }
    setCallState("CONFIGURING");
    currentActivityId.current = null;
    setConversationLog([]);
    setError(null);
    setFinalCallArtifacts(null);
    setCurrentTranscription("");
    setIsScoringPostCall(false);
    cancelAudio();
  };
  
    const handleScorePostCall = async () => {
    if (!finalCallArtifacts || !finalCallArtifacts.transcript || !selectedProduct) {
        toast({variant: 'destructive', title: "Error", description: "No final transcript or product context available to score."});
        return;
    }
    setIsScoringPostCall(true);
    try {
        const productData = availableProducts.find(p => p.name === selectedProduct);
        const productContext = productData ? prepareKnowledgeBaseContext(knowledgeBaseFiles, productData, []) : "No product context available.";
        
        const response = await fetch('/api/call-scoring', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                product: selectedProduct,
                agentName: agentName,
                transcriptOverride: finalCallArtifacts.transcript,
                productContext: productContext
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const scoreOutput = await response.json();

        setFinalCallArtifacts(prev => prev ? { ...prev, score: scoreOutput } : null);
        if (currentActivityId.current) {
          const existingActivity = activities.find(a => a.id === currentActivityId.current);
          if (existingActivity) {
            updateActivity(currentActivityId.current, { ...existingActivity.details, finalScore: scoreOutput });
          }
        }
        toast({ title: "Scoring Complete!", description: "The interaction has been scored successfully."});
    } catch (error: unknown) {
        toast({ variant: 'destructive', title: "Scoring Failed", description: getErrorMessage(error) });
    } finally {
        setIsScoringPostCall(false);
    }
  };


  const getCallStatusBadge = () => {
    switch (callState) {
        case "LISTENING":
            return <Badge variant="default" className="text-xs bg-green-100 text-green-800"><Mic className="mr-1.5 h-3.5 w-3.5"/>Listening...</Badge>;
        case "AI_SPEAKING":
            return <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800"><Bot className="mr-1.5 h-3.5 w-3.5"/>AI Speaking (Interruptible)</Badge>;
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
    <>
    <div className="flex flex-col h-full">
      <audio ref={audioPlayerRef} className="hidden" />
      <PageHeader title="AI Voice Support Agent" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        
        <Card className="w-full max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Headphones className="mr-2 h-6 w-6 text-primary"/> AI Customer Support Configuration</CardTitle>
            <CardDescription>
                Set up agent and customer context, product, and voice profile. The AI will automatically use the most relevant Knowledge Base content for its answers.
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
                           <Select value={selectedProduct} onValueChange={(value) => setSelectedProduct(value)} disabled={isInteractionStarted}>
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
                        {conversationLog.map((turn) => (<ConversationTurnComponent key={turn.id} turn={turn} currentlyPlayingId={currentlyPlayingId} wordIndex={turn.id === currentlyPlayingId ? currentWordIndex : -1} />))}
                        {callState === 'LISTENING' && (
                           <div className="flex items-start gap-2.5 my-3 justify-end user-line">
                              <div className="flex flex-col gap-1 w-full max-w-[80%] items-end">
                                 <Card className="max-w-full w-fit p-3 rounded-xl shadow-sm bg-accent/80 text-accent-foreground rounded-br-none">
                                    <CardContent className="p-0 text-sm">
                                      <p className="italic">{currentTranscription || " Listening..."}</p>
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
                        disabled={callState !== 'LISTENING' && callState !== 'AI_SPEAKING'}
                    />
                </CardContent>
                 <CardFooter className="flex justify-between items-center pt-4">
                     <Button onClick={()=> handleEndInteraction()} variant="destructive" size="sm">
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
                    {finalCallArtifacts.audioUri && (
                         <div>
                            <Label htmlFor="final-audio-support">Full Interaction Recording</Label>
                            <audio id="final-audio-support" controls src={finalCallArtifacts.audioUri} className="w-full mt-1 h-10">Your browser does not support the audio element.</audio>
                             <div className="mt-2 flex gap-2">
                                 <Button variant="outline" size="xs" onClick={() => downloadDataUriFile(finalCallArtifacts.audioUri!, `SupportInteraction_${userName || 'User'}.wav`)}><FileAudio className="mr-1 h-3"/>Download Recording</Button>
                             </div>
                        </div>
                    )}
                    <div>
                        <Label htmlFor="final-transcript-support">Full Transcript</Label>
                        <Textarea id="final-transcript-support" value={finalCallArtifacts.transcript} readOnly className="h-40 text-xs bg-muted/50 mt-1"/>
                         <div className="mt-2 flex gap-2">
                            <Button variant="outline" size="xs" onClick={() => exportPlainTextFile(`SupportInteraction_${userName || 'User'}_transcript.txt`, finalCallArtifacts.transcript)}><Download className="mr-1 h-3"/>Download .txt</Button>
                        </div>
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
                             <Button onClick={handleScorePostCall} disabled={isScoringPostCall || !finalCallArtifacts.transcript}>
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
    </>
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
