
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

import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { useUserProfile } from '@/hooks/useUserProfile';

import { PRODUCTS, Product, VoiceProfile, ConversationTurn, VoiceSupportAgentActivityDetails, KnowledgeFile } from '@/types';
import { runVoiceSupportAgentQuery } from '@/ai/flows/voice-support-agent-flow';
import type { VoiceSupportAgentFlowInput, VoiceSupportAgentFlowOutput } from '@/ai/flows/voice-support-agent-flow';
import { fileToDataUrl } from '@/lib/file-utils';
import { cn } from '@/lib/utils';

import { Headphones, Send, AlertTriangle, Bot, ChevronDown, User as UserIcon, Building, Info, SquareTerminal, Radio, Mic, Wifi, Circle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


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


export default function VoiceSupportAgentPage() {
  const { currentProfile: appAgentProfile } = useUserProfile(); 
  const [agentName, setAgentName] = useState<string>(appAgentProfile); 
  const [userName, setUserName] = useState<string>(""); 

  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(null);
  
  const [conversationLog, setConversationLog] = useState<ConversationTurn[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  }, [conversationLog]);
  
  useEffect(() => {
    setAgentName(appAgentProfile); 
  }, [appAgentProfile]);
  
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
  
  const handleAskQuery = async (queryAudioDataUri: string) => {
    if (!selectedProduct) {
      toast({ variant: "destructive", title: "Missing Info", description: "Please select a Product." });
      return;
    }
    setIsLoading(true);
    setError(null);
    setCurrentAiAction("AI fetching response...");
    
    const kbContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, selectedProduct);
    if (kbContext.startsWith("No specific knowledge base")) {
        toast({ variant: "default", title: "Limited KB", description: `Knowledge Base for ${selectedProduct} is sparse. Answers may be general.`, duration: 5000});
    }

    // Since we are using voice, we will send the audio data URI to the flow
    // which will then transcribe it.
    const flowInput: VoiceSupportAgentFlowInput = {
      product: selectedProduct,
      agentName: agentName,
      userName: userName,
      userQuery: '', // This will be determined by transcription in the flow
      userQueryAudioDataUri: queryAudioDataUri, // Send audio data
      voiceProfileId: voiceProfile?.id,
      knowledgeBaseContext: kbContext,
    };

    try {
      const result = await runVoiceSupportAgentQuery(flowInput);
      
      if (result.errorMessage) {
        setError(result.errorMessage);
        toast({ variant: "destructive", title: "Flow Error", description: result.errorMessage, duration: 7000 });
      }

      // The flow will now return the transcribed user query text.
      // Update the user turn with the transcribed text.
      const lastTurn = conversationLog[conversationLog.length - 1];
      if(lastTurn && lastTurn.speaker === 'User') {
          lastTurn.text = result.userQueryTranscription || '(Transcription Failed)';
          setConversationLog([...conversationLog]); // Force re-render
      }

      if (result.aiResponseText) {
        const aiTurn: ConversationTurn = {
            id: `ai-${Date.now()}`, speaker: 'AI', text: result.aiResponseText,
            timestamp: new Date().toISOString(), audioDataUri: result.aiSpeech?.audioDataUri, 
        };
        setConversationLog(prev => [...prev, aiTurn]);
        if(result.aiSpeech?.audioDataUri) playAiAudio(result.aiSpeech.audioDataUri);
      }
      
      const activityDetails: VoiceSupportAgentActivityDetails = {
        flowInput, flowOutput: result,
        fullTranscriptText: [...conversationLog].map(t => `${t.speaker}: ${t.text}`).join('\n'),
        simulatedInteractionRecordingRef: "N/A - Web Interaction", error: result.errorMessage
      };
      logActivity({ module: "Voice Support Agent", product: selectedProduct, details: activityDetails });

    } catch (e: any) {
      setError(e.message || "An unexpected error occurred.");
      toast({ variant: "destructive", title: "Query Error", description: e.message, duration: 7000 });
    } finally {
      setIsLoading(false);
      setCurrentAiAction(null);
    }
  };

  const handleStopListeningAndProcess = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        const audioDataUri = await fileToDataUrl(audioBlob);

        const userTurn: ConversationTurn = {
          id: `user-${Date.now()}`, speaker: 'User', text: '(Voice input processing...)', timestamp: new Date().toISOString(), audioDataUri,
        };
        setConversationLog(prev => [...prev, userTurn]);
        
        await handleAskQuery(audioDataUri);
      };
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  }, [handleAskQuery]);


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

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Voice Support Agent" />
      <audio ref={audioPlayerRef} onEnded={handleAiAudioEnded} className="hidden" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        
        <Card className="w-full max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Headphones className="mr-2 h-6 w-6 text-primary"/> AI Customer Support Configuration</CardTitle>
            <CardDescription>
                Set up agent and customer context, product, and voice profile. Then ask your questions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <Accordion type="single" collapsible defaultValue="item-config" className="w-full">
                <AccordionItem value="item-config">
                    <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                        <ChevronDown className="mr-2 h-4 w-4 text-accent group-data-[state=open]:rotate-180 transition-transform"/>
                        Context Configuration
                    </AccordionTrigger>
                    <AccordionContent className="pt-3 space-y-3">
                        {/* ... Configuration fields ... */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1"><Label htmlFor="support-agent-name">Agent Name (for AI dialogue)</Label><Input id="support-agent-name" placeholder="e.g., SupportBot (AI Agent)" value={agentName} onChange={e => setAgentName(e.target.value)} /></div>
                            <div className="space-y-1"><Label htmlFor="support-user-name">Customer Name (Optional)</Label><Input id="support-user-name" placeholder="e.g., Rohan Mehra" value={userName} onChange={e => setUserName(e.target.value)} /></div>
                        </div>
                        <div className="space-y-1"><Label htmlFor="support-product-select">Product <span className="text-destructive">*</span></Label><Select value={selectedProduct} onValueChange={(val) => setSelectedProduct(val as Product)}><SelectTrigger id="support-product-select"><SelectValue placeholder="Select Product" /></SelectTrigger><SelectContent>{PRODUCTS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                    </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="item-voice">
                     <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                        <ChevronDown className="mr-2 h-4 w-4 text-accent group-data-[state=open]:rotate-180 transition-transform"/>
                        AI Voice Profile
                    </AccordionTrigger>
                    <AccordionContent className="pt-3">
                        <VoiceSampleUploader onVoiceProfileCreated={(profile) => setVoiceProfile(profile)} isLoading={isLoading} />
                        {voiceProfile && (<Alert className="mt-3 bg-blue-50 border-blue-200"><Bot className="h-4 w-4 text-blue-600" /><AlertTitle className="text-blue-700">Active Voice Profile</AlertTitle><AlertDescription className="text-blue-600 text-xs">Using: {voiceProfile.name}. A standard TTS voice will be used.<Button variant="link" size="xs" className="ml-2 h-auto p-0 text-blue-700" onClick={() => setVoiceProfile(null)}>Change</Button></AlertDescription></Alert>)}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        <Card className="w-full max-w-3xl mx-auto mt-4">
            <CardHeader>
                <CardTitle className="text-lg flex items-center"> 
                    <SquareTerminal className="mr-2 h-5 w-5 text-primary"/> Ask a Question / Log Interaction
                </CardTitle>
                 <CardDescription>
                    Hold the button to speak your query. The AI will listen, transcribe, and respond.
                    {currentAiAction && <span className="ml-2 text-xs text-muted-foreground italic">({currentAiAction})</span>}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center items-center h-28">
                 <Button
                    onMouseDown={handleStartListening}
                    onMouseUp={handleStopListeningAndProcess}
                    onTouchStart={handleStartListening}
                    onTouchEnd={handleStopListeningAndProcess}
                    disabled={isAiSpeaking || isLoading || !selectedProduct}
                    className={cn(
                      "h-24 w-24 rounded-full transition-all duration-200 flex flex-col items-center justify-center",
                      isListening ? "bg-red-500 hover:bg-red-600 scale-110" : "bg-primary hover:bg-primary/90",
                      (isAiSpeaking || isLoading || !selectedProduct) && "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    <Mic size={40} />
                    <span className="text-sm mt-1">{isListening ? "Listening..." : "Ask"}</span>
                  </Button>
            </CardContent>
             {conversationLog.length > 0 && (
                <CardFooter className="flex flex-col items-start p-0">
                    <div className="w-full px-6 pt-3"><h3 className="text-md font-semibold mb-2">Conversation Log:</h3></div>
                    <ScrollArea className="h-[300px] w-full border-t rounded-b-md p-3 bg-muted/10">
                        {conversationLog.map((turn) => (<ConversationTurnComponent key={turn.id} turn={turn} />))}
                        {isLoading && conversationLog.length > 0 && <LoadingSpinner size={16} className="mx-auto my-2" />}
                        <div ref={conversationEndRef} />
                    </ScrollArea>
                     <div className="w-full px-6 py-3 border-t">
                        <Button onClick={() => setConversationLog([])} variant="outline" size="sm">Reset Conversation</Button>
                    </div>
                </CardFooter>
            )}
        </Card>
        
        {error && !isLoading && (
          <Alert variant="destructive" className="w-full max-w-3xl mx-auto mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </main>
    </div>
  );
}
