
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

import { Product, ConversationTurn, VoiceSupportAgentActivityDetails, KnowledgeFile, VoiceSupportAgentFlowInput } from '@/types';
import { runVoiceSupportAgentQuery } from '@/ai/flows/voice-support-agent-flow';
import { cn } from '@/lib/utils';

import { Headphones, Send, AlertTriangle, Bot, SquareTerminal, User as UserIcon, Info, Radio, Mic, Wifi, Redo, Settings, Volume2, Loader2, PlayCircle } from 'lucide-react';
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

export default function VoiceSupportAgentPage() {
  const [agentName, setAgentName] = useState<string>(""); 
  const [userName, setUserName] = useState<string>(""); 

  const { availableProducts } = useProductContext();
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  
  const [conversationLog, setConversationLog] = useState<ConversationTurn[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentCallStatus, setCurrentCallStatus] = useState<string>("Idle");
  
  const [isInteractionStarted, setIsInteractionStarted] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");

  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const conversationEndRef = useRef<null | HTMLDivElement>(null);
  
   useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationLog]);

  const { isSupported: isTtsSupported, isSpeaking: isAiSpeaking, speak, cancel: cancelTts, curatedVoices, isLoading: areVoicesLoading } = useSpeechSynthesis({
    onStart: () => setCurrentCallStatus("AI Speaking..."),
    onEnd: () => { if(isInteractionStarted) setCurrentCallStatus("Listening..."); },
  });
  const [selectedVoiceName, setSelectedVoiceName] = useState<string | undefined>(undefined);
  
  useEffect(() => {
    if (curatedVoices.length > 0 && !selectedVoiceName) {
      const defaultVoice = curatedVoices.find(v => v.isDefault);
      setSelectedVoiceName(defaultVoice ? defaultVoice.name : curatedVoices[0].name);
    }
  }, [curatedVoices, selectedVoiceName]);
  
  const selectedVoiceObject = curatedVoices.find(v => v.name === selectedVoiceName)?.voice;
  
  const handleUserInterruption = useCallback(() => {
    if (isAiSpeaking) {
      cancelTts();
    }
  }, [isAiSpeaking, cancelTts]);

  const runSupportQuery = useCallback(async (queryText: string) => {
    if (!selectedProduct) {
      toast({ variant: "destructive", title: "Missing Info", description: "Please select a Product." });
      return;
    }
    if (!isTtsSupported) {
       toast({ variant: "destructive", title: "TTS Not Supported", description: "Your browser does not support Speech Synthesis. Please use a different browser." });
      return;
    }
    setIsLoading(true);
    setError(null);
    setCurrentCallStatus("AI fetching response...");
    
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
    };

    try {
      const result = await runVoiceSupportAgentQuery(flowInput);
      
      const userTurn: ConversationTurn = {
        id: `user-${Date.now()}`, speaker: 'User', text: queryText, timestamp: new Date().toISOString()
      };

      const newTurns: ConversationTurn[] = [userTurn];

      if (result.errorMessage) {
        throw new Error(result.errorMessage);
      }
      
      if (result.aiResponseText) {
          const aiTurn: ConversationTurn = {
              id: `ai-${Date.now()}`, speaker: 'AI', text: result.aiResponseText,
              timestamp: new Date().toISOString(),
          };
          newTurns.push(aiTurn);
          speak({text: result.aiResponseText, voice: selectedVoiceObject});
      } else {
        setIsLoading(false);
        setCurrentCallStatus("Listening...");
      }

      setConversationLog(prev => [...prev, ...newTurns]);
      
      const activityDetails: VoiceSupportAgentActivityDetails = {
        flowInput: flowInput, 
        flowOutput: result,
        fullTranscriptText: [...conversationLog, ...newTurns].map(t => `${t.speaker}: ${t.text}`).join('\n'),
        error: result.errorMessage
      };
      logActivity({ module: "Voice Support Agent", product: selectedProduct, details: activityDetails });

    } catch (e: any) {
      const detailedError = e.message || "An unexpected error occurred.";
      setError(detailedError);
      setCurrentCallStatus("Error");
    } finally {
      setIsLoading(false);
    }
  }, [selectedProduct, agentName, userName, knowledgeBaseFiles, toast, speak, selectedVoiceObject, conversationLog, logActivity, isTtsSupported]);

  const handleAskQuery = useCallback(async (queryText: string) => {
    await runSupportQuery(queryText);
  }, [runSupportQuery]);
  
  const { startRecording, stopRecording, isRecording, transcript } = useWhisper({
    onTranscribe: (text:string) => {
      handleUserInterruption();
      setInterimTranscript(text);
    },
    onTranscriptionComplete: (text) => {
      if(!text.trim()) return;
      setInterimTranscript("");
      handleAskQuery(text);
    },
  });

  useEffect(() => {
    if (isInteractionStarted && !isLoading && !isAiSpeaking && !isRecording) {
      startRecording();
    } else if (isRecording && (isLoading || isAiSpeaking)) {
      stopRecording();
    }
  }, [isInteractionStarted, isLoading, isAiSpeaking, isRecording, startRecording, stopRecording]);


  const handleStartInteraction = () => {
    if (!selectedProduct) {
      toast({ variant: "destructive", title: "Product Required", description: "Please select a product to begin the interaction." });
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
  
  const handleUserInputSubmit = (text: string) => {
    if (!text.trim() || isLoading || isAiSpeaking) return;
    setInterimTranscript("");
    handleAskQuery(text);
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
             <Accordion type="single" collapsible defaultValue={isInteractionStarted ? "" : "item-config"} className="w-full">
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
                            <div className="space-y-1"><Label htmlFor="support-agent-name">Agent Name (for AI dialogue)</Label><Input id="support-agent-name" placeholder="e.g., SupportBot (AI Agent)" value={agentName} onChange={e => setAgentName(e.target.value)} disabled={isInteractionStarted}/></div>
                            <div className="space-y-1"><Label htmlFor="support-user-name">Customer Name (Optional)</Label><Input id="support-user-name" placeholder="e.g., Rohan Mehra" value={userName} onChange={e => setUserName(e.target.value)} disabled={isInteractionStarted} /></div>
                        </div>
                         <div className="mt-4 pt-4 border-t">
                             <Label>AI Voice Profile <span className="text-destructive">*</span></Label>
                              <div className="mt-2">
                                 <div className="flex items-center gap-2">
                                    <Select value={selectedVoiceName} onValueChange={setSelectedVoiceName} disabled={isInteractionStarted || areVoicesLoading}>
                                        <SelectTrigger className="flex-grow"><SelectValue placeholder={areVoicesLoading ? "Loading voices..." : "Select a voice"} /></SelectTrigger>
                                        <SelectContent>{curatedVoices.map(v => <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Button variant="outline" size="icon" onClick={() => speak({text: "Hello, this is a sample of my voice.", voice: selectedVoiceObject})} disabled={!selectedVoiceObject || isAiSpeaking} title="Play sample">
                                        <Volume2 className="h-4 w-4"/>
                                    </Button>
                                </div>
                             </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
             {!isInteractionStarted && (
                <Button onClick={handleStartInteraction} disabled={isLoading || !selectedProduct} className="w-full mt-4">
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
                        {conversationLog.map((turn) => (<ConversationTurnComponent key={turn.id} turn={turn} />))}
                        {isRecording && (interimTranscript || transcript.text) && (
                          <p className="text-sm text-muted-foreground italic px-3 py-1">" {interimTranscript || transcript.text} "</p>
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
                        onSubmit={(text) => handleUserInputSubmit(text)}
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
