
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ConversationTurn as ConversationTurnComponent } from '@/components/features/voice-agents/conversation-turn'; 

import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useWhisper } from '@/hooks/use-whisper';
import { useProductContext } from '@/hooks/useProductContext';
import { GOOGLE_PRESET_VOICES, BARK_PRESET_VOICES, SAMPLE_TEXT } from '@/hooks/use-voice-samples';
import { fileToDataUrl } from '@/lib/file-utils';

import { Product, ConversationTurn, VoiceSupportAgentActivityDetails, KnowledgeFile, VoiceSupportAgentFlowInput } from '@/types';
import { runVoiceSupportAgentQuery } from '@/ai/flows/voice-support-agent-flow';
import { synthesizeSpeech } from '@/ai/flows/speech-synthesis-flow';
import { cn } from '@/lib/utils';

import { Headphones, Send, AlertTriangle, Bot, SquareTerminal, User as UserIcon, Info, Radio, Mic, Wifi, Redo, Settings, Volume2, Loader2, FileUp } from 'lucide-react';
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

type VoiceProvider = 'google' | 'bark';
type VoiceSelectionType = 'default' | 'upload' | 'record';

export default function VoiceSupportAgentPage() {
  const { currentProfile: appAgentProfile } = useUserProfile(); 
  const [agentName, setAgentName] = useState<string>(appAgentProfile); 
  const [userName, setUserName] = useState<string>(""); 

  const { availableProducts } = useProductContext();
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>('google');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(GOOGLE_PRESET_VOICES[0].id);
  const [voiceSelectionType, setVoiceSelectionType] = useState<VoiceSelectionType>('default');
  const [customVoiceSample, setCustomVoiceSample] = useState<{name: string; dataUri: string} | null>(null);

  const [conversationLog, setConversationLog] = useState<ConversationTurn[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentCallStatus, setCurrentCallStatus] = useState<string>("Idle");
  
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const [isInteractionStarted, setIsInteractionStarted] = useState(false);
  const [isSamplePlaying, setIsSamplePlaying] = useState(false);


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

   useEffect(() => {
    if (voiceProvider === 'google') setSelectedVoiceId(GOOGLE_PRESET_VOICES[0].id);
    else setSelectedVoiceId(BARK_PRESET_VOICES[0].id);
  }, [voiceProvider]);
  
  const handleAiAudioEnded = () => {
    setIsAiSpeaking(false);
    setIsSamplePlaying(false);
    if (isInteractionStarted) {
      setCurrentCallStatus("Listening...");
    }
  };

  const handleUserInterruption = useCallback(() => {
    if (audioPlayerRef.current && !audioPlayerRef.current.paused) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      setIsAiSpeaking(false);
      setIsSamplePlaying(false);
      setCurrentCallStatus("Listening...");
    }
  }, []);

  const playAiAudio = useCallback(async (audioDataUri: string) => {
    if (audioDataUri && audioDataUri.startsWith("data:audio/")) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = audioDataUri;
        audioPlayerRef.current.play().catch(console.error);
        setIsAiSpeaking(true);
        setCurrentCallStatus("AI Speaking...");
      }
    } else {
        const errorMessage = `Audio Error: Audio data is missing or invalid.`;
        setError(errorMessage);
    }
  }, [isInteractionStarted]);
  
  const handlePlaySample = async () => {
    setIsSamplePlaying(true);
    try {
        const result = await synthesizeSpeech({textToSpeak: SAMPLE_TEXT, voiceProfileId: selectedVoiceId});
        if (result.audioDataUri && !result.errorMessage) {
            await playAiAudio(result.audioDataUri);
        } else {
            toast({variant: "destructive", title: "Could not play sample", description: result.errorMessage});
            setIsSamplePlaying(false);
        }
    } catch (e: any) {
        toast({variant: "destructive", title: "TTS Error", description: e.message});
        setIsSamplePlaying(false);
    }
  };

  const handleCustomVoiceFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('audio/')) {
        toast({variant: 'destructive', title: 'Invalid File', description: 'Please upload a valid audio file (e.g., MP3, WAV).'});
        return;
      }
      try {
        const dataUri = await fileToDataUrl(file);
        setCustomVoiceSample({name: file.name, dataUri: dataUri});
        toast({title: 'Voice Sample Loaded', description: `${file.name} is ready.`});
      } catch (error) {
        toast({variant: 'destructive', title: 'File Read Error', description: 'Could not process the selected audio file.'});
      }
    }
  };

  const runSupportQuery = useCallback(async (queryText: string) => {
    if (!selectedProduct) {
      toast({ variant: "destructive", title: "Missing Info", description: "Please select a Product." });
      return { };
    }
    setIsLoading(true);
    setError(null);
    setCurrentCallStatus("AI fetching response...");
    
    const kbContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, selectedProduct as Product);
    if (kbContext.startsWith("No specific knowledge base")) {
        toast({ variant: "default", title: "Limited KB", description: `Knowledge Base for ${selectedProduct} is sparse. Answers may be general.`, duration: 5000});
    }

    const voiceIdToUse = voiceSelectionType === 'upload' && customVoiceSample ? "Echo" : selectedVoiceId;

    const flowInput: VoiceSupportAgentFlowInput = {
      product: selectedProduct as Product,
      agentName: agentName,
      userName: userName,
      userQuery: queryText,
      voiceProfileId: voiceIdToUse,
      knowledgeBaseContext: kbContext,
    };

    try {
      const result = await runVoiceSupportAgentQuery(flowInput);
      
      const newTurns: ConversationTurn[] = [];

      if (result.errorMessage) {
        throw new Error(result.errorMessage);
      }

      if (result.aiResponseText) {
        const aiTurn: ConversationTurn = {
            id: `ai-${Date.now()}`, speaker: 'AI', text: result.aiResponseText,
            timestamp: new Date().toISOString(), audioDataUri: result.aiSpeech?.audioDataUri, 
        };
        newTurns.push(aiTurn);
        if(result.aiSpeech?.audioDataUri) {
          playAiAudio(result.aiSpeech.audioDataUri);
        }
        else {
          setIsAiSpeaking(false);
          setCurrentCallStatus("Listening...");
        }
      }
      setConversationLog(prev => [...prev, ...newTurns]);
      
      const activityDetails: VoiceSupportAgentActivityDetails = {
        flowInput: flowInput, 
        flowOutput: result,
        fullTranscriptText: [...conversationLog, ...newTurns].map(t => `${t.speaker}: ${t.text}`).join('\n'),
        simulatedInteractionRecordingRef: "N/A - Web Interaction", error: result.errorMessage
      };
      logActivity({ module: "Voice Support Agent", product: selectedProduct, details: activityDetails });
      return result;

    } catch (e: any) {
      const detailedError = e.message || "An unexpected error occurred.";
      setError(detailedError);
      setCurrentCallStatus("Error");
      return { errorMessage: detailedError };
    } finally {
      setIsLoading(false);
    }
  }, [selectedProduct, agentName, userName, selectedVoiceId, knowledgeBaseFiles, toast, playAiAudio, conversationLog, logActivity, voiceSelectionType, customVoiceSample]);

  const handleAskQuery = async (queryText: string) => {
    const userTurn: ConversationTurn = {
        id: `user-${Date.now()}`,
        speaker: 'User',
        text: queryText,
        timestamp: new Date().toISOString()
    };
    setConversationLog(prev => [...prev, userTurn]);
    await runSupportQuery(queryText);
  };
  
  const { whisperInstance, transcript, isRecording } = useWhisper({
    onTranscribe: handleUserInterruption,
    onTranscriptionComplete: (completedTranscript) => {
      if (completedTranscript.trim().length > 2 && !isLoading) {
        handleAskQuery(completedTranscript);
      }
    },
    autoStart: isInteractionStarted && !isLoading && !isAiSpeaking,
    autoStop: true,
    stopTimeout: 80,
  });


  const handleStartInteraction = () => {
    if (!selectedProduct) {
      toast({ variant: "destructive", title: "Product Required", description: "Please select a product to begin the interaction." });
      return;
    }
    if (voiceSelectionType === 'upload' && !customVoiceSample) {
        toast({ variant: "destructive", title: "Missing Voice Sample", description: "Please upload a custom voice sample or switch to a default voice." });
        return;
    }
    setIsInteractionStarted(true);
    setCurrentCallStatus("Listening...");
    toast({title: "Interaction Started", description: "You can now ask your questions."})
  }

  const handleReset = () => {
    setIsInteractionStarted(false);
    setConversationLog([]);
    setError(null);
    setCurrentCallStatus("Idle");
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Voice Support Agent" />
      <audio ref={audioPlayerRef} onEnded={handleAiAudioEnded} className="hidden" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        
        <Card className="w-full max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Headphones className="mr-2 h-6 w-6 text-primary"/> AI Customer Support Configuration</CardTitle>
            <CardDescription>
                Set up agent and customer context, product, and voice profile. Then start the interaction.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <Accordion type="single" collapsible defaultValue={isInteractionStarted ? "" : "item-config"} className="w-full">
                <AccordionItem value="item-config">
                    <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90 [&[data-state=open]>&svg]:rotate-180">
                         <div className="flex items-center"><Settings className="mr-2 h-4 w-4 text-accent"/>Context Configuration</div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-3 space-y-3">
                       <div className="space-y-1">
                          <Label htmlFor="product-select-support">Product <span className="text-destructive">*</span></Label>
                           <Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={isInteractionStarted}>
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
                            <div className="space-y-1"><Label htmlFor="support-agent-name">Agent Name (for AI dialogue)</Label><Input id="support-agent-name" placeholder="e.g., SupportBot (AI Agent)" value={agentName} onChange={e => setAgentName(e.target.value)} disabled={isInteractionStarted}/></div>
                            <div className="space-y-1"><Label htmlFor="support-user-name">Customer Name (Optional)</Label><Input id="support-user-name" placeholder="e.g., Rohan Mehra" value={userName} onChange={e => setUserName(e.target.value)} disabled={isInteractionStarted} /></div>
                        </div>
                         <div className="mt-4 pt-4 border-t">
                             <Label>AI Voice Profile <span className="text-destructive">*</span></Label>
                             <RadioGroup value={voiceSelectionType} onValueChange={(v) => setVoiceSelectionType(v as VoiceSelectionType)} className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                                <div className="flex items-center space-x-2"><RadioGroupItem value="default" id="voice-default-support" /><Label htmlFor="voice-default-support">Select Default Voice</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="upload" id="voice-upload-support" /><Label htmlFor="voice-upload-support">Upload Voice Sample</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="record" id="voice-record-support" /><Label htmlFor="voice-record-support">Record Voice Sample</Label></div>
                             </RadioGroup>
                              <div className="mt-2 pl-2">
                                {voiceSelectionType === 'default' && (
                                     <>
                                         <RadioGroup value={voiceProvider} onValueChange={(v) => setVoiceProvider(v as VoiceProvider)} className="flex items-center gap-4 my-2">
                                            <div className="flex items-center space-x-2"><RadioGroupItem value="google" id="voice-provider-google-support" /><Label htmlFor="voice-provider-google-support">Google (Standard)</Label></div>
                                            <div className="flex items-center space-x-2"><RadioGroupItem value="bark" id="voice-provider-bark-support" /><Label htmlFor="voice-provider-bark-support">Bark (Expressive)</Label></div>
                                         </RadioGroup>
                                         <div className="flex items-center gap-2">
                                            <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId} disabled={isInteractionStarted || isSamplePlaying}>
                                                <SelectTrigger className="flex-grow"><SelectValue placeholder="Select a preset voice" /></SelectTrigger>
                                                <SelectContent>
                                                    {(voiceProvider === 'google' ? GOOGLE_PRESET_VOICES : BARK_PRESET_VOICES).map(voice => (<SelectItem key={voice.id} value={voice.id}>{voice.name}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                            <Button variant="outline" size="icon" onClick={handlePlaySample} disabled={isInteractionStarted || isSamplePlaying} title="Play sample">
                                              {isSamplePlaying ? <Loader2 className="h-4 w-4 animate-spin"/> : <Volume2 className="h-4 w-4"/>}
                                            </Button>
                                        </div>
                                     </>
                                )}
                                {voiceSelectionType === 'upload' && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <Input id="voice-upload-input-support" type="file" accept="audio/mp3,audio/wav" disabled={isInteractionStarted} className="pt-1.5 flex-grow" onChange={handleCustomVoiceFileChange}/>
                                         {customVoiceSample && (
                                            <Button variant="outline" size="icon" onClick={() => playAiAudio(customVoiceSample.dataUri)} title={`Preview ${customVoiceSample.name}`}><Volume2 className="h-4 w-4"/></Button>
                                        )}
                                    </div>
                                )}
                                {voiceSelectionType === 'record' && (
                                     <div className="mt-2 text-muted-foreground text-xs p-2 border rounded-md">
                                        Recording functionality is not yet fully implemented in this prototype.
                                    </div>
                                )}
                             </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
             {!isInteractionStarted && (
                <Button onClick={handleStartInteraction} disabled={isLoading || !selectedProduct || (voiceSelectionType === 'upload' && !customVoiceSample)} className="w-full mt-4">
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
                         <Badge variant={isAiSpeaking ? "outline" : "default"} className={cn("text-xs transition-colors", isAiSpeaking ? "bg-amber-100 text-amber-800" : isRecording ? "bg-red-100 text-red-700" : "bg-green-100 text-green-800")}>
                             {isRecording ? <Radio className="mr-1.5 h-3.5 w-3.5 text-red-600 animate-pulse"/> : isAiSpeaking ? <Bot className="mr-1.5 h-3.5 w-3.5"/> : <Mic className="mr-1.5 h-3.5 w-3.5"/>}
                            {isRecording ? "Listening..." : isAiSpeaking ? "AI Speaking..." : currentCallStatus}
                        </Badge>
                    </CardTitle>
                     <CardDescription>
                        Type your question below and hit send, or just start speaking. The AI will respond based on its Knowledge Base for product '{selectedProduct}'.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[300px] w-full border rounded-md p-3 bg-muted/10 mb-3">
                        {conversationLog.map((turn) => (<ConversationTurnComponent key={turn.id} turn={turn} onPlayAudio={(uri) => playAiAudio(uri)} />))}
                        {isRecording && transcript.text && (
                          <p className="text-sm text-muted-foreground italic px-3 py-1">" {transcript.text} "</p>
                        )}
                        {isLoading && conversationLog.length > 0 && <LoadingSpinner size={16} className="mx-auto my-2" />}
                        <div ref={conversationEndRef} />
                    </ScrollArea>

                    {error && (
                      <Alert variant="destructive" className="mb-3">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Flow Error</AlertTitle>
                        <details>
                          <summary className="cursor-pointer text-sm hover:underline">An error occurred in the conversation flow. Click for details.</summary>
                          <AlertDescription className="text-xs whitespace-pre-wrap mt-2 bg-background/50 p-2 rounded">{error}</AlertDescription>
                        </details>
                      </Alert>
                    )}
                    
                    <div className="text-xs text-muted-foreground mb-2">Optional: Type a response instead of speaking.</div>
                    <UserInputArea
                        onSubmit={handleAskQuery}
                        disabled={isLoading || isAiSpeaking}
                    />
                </CardContent>
                 <CardFooter className="flex justify-between items-center pt-4">
                    <Button onClick={handleReset} variant="outline" size="sm" className="ml-auto">
                        <Redo className="mr-2 h-4 w-4"/> New Interaction / Reset
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
