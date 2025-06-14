
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

import { PRODUCTS, Product, VoiceProfile, ConversationTurn, VoiceSupportAgentFlowInput, VoiceSupportAgentFlowOutput, VoiceSupportAgentActivityDetails, KnowledgeFile } from '@/types';
import { runVoiceSupportAgentQuery } from '@/ai/flows/voice-support-agent-flow';

import { Headphones, Send, AlertTriangle, Info, ChevronDown, Bot, AlertCircleIcon } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


// Helper to prepare Knowledge Base context
const prepareKnowledgeBaseContext = (
  knowledgeBaseFiles: KnowledgeFile[],
  product: Product
): string => {
  const productSpecificFiles = knowledgeBaseFiles.filter(f => f.product === product);
  if (productSpecificFiles.length === 0) return "No specific knowledge base content found for this product.";
  // Limit total context length to avoid overly large prompts
  const MAX_CONTEXT_LENGTH = 15000;
  let combinedContext = `Knowledge Base Content for Product: ${product}\n---\n`;
  for (const file of productSpecificFiles) {
    const itemContent = `Item: ${file.name}\nType: ${file.isTextEntry ? 'Text' : file.type}\nContent:\n${file.isTextEntry ? file.textContent?.substring(0,2000) : '(File content not directly included, use name and type for context.)'}\n---\n`;
    if (combinedContext.length + itemContent.length > MAX_CONTEXT_LENGTH) {
        combinedContext += "... (Knowledge Base truncated due to length)\n";
        break;
    }
    combinedContext += itemContent;
  }
  return combinedContext;
};


export default function VoiceSupportAgentPage() {
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(null);
  
  const [userQuery, setUserQuery] = useState("");
  const [aiResponse, setAiResponse] = useState<VoiceSupportAgentFlowOutput | null>(null);
  const [conversationLog, setConversationLog] = useState<ConversationTurn[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const conversationEndRef = useRef<null | HTMLDivElement>(null);

   useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationLog]);

  const handlePlayAudio = (audioDataUri: string) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.src = audioDataUri;
      audioPlayerRef.current.play().catch(e => console.error("Error playing audio:", e));
    }
  };

  const handleAskQuery = async () => {
    if (!selectedProduct) {
      toast({ variant: "destructive", title: "Missing Info", description: "Please select a Product." });
      return;
    }
    if (!userQuery.trim()) {
      toast({ variant: "destructive", title: "Empty Query", description: "Please type your query." });
      return;
    }
    setIsLoading(true);
    setError(null);
    setAiResponse(null);

    const kbContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, selectedProduct);
    if (kbContext.startsWith("No specific knowledge base")) {
        toast({ variant: "default", title: "Limited KB", description: `Knowledge Base for ${selectedProduct} is sparse. Answers may be general.`, duration: 5000});
    }

    const flowInput: VoiceSupportAgentFlowInput = {
      product: selectedProduct,
      userQuery: userQuery,
      voiceProfileId: voiceProfile?.id,
      knowledgeBaseContext: kbContext,
    };

    // Add user query to conversation log
    const userTurn: ConversationTurn = {
        id: `user-${Date.now()}`,
        speaker: 'User',
        text: userQuery,
        timestamp: new Date().toISOString(),
    };
    setConversationLog(prev => [...prev, userTurn]);

    try {
      const result = await runVoiceSupportAgentQuery(flowInput);
      setAiResponse(result);
      
      if (result.errorMessage) {
        setError(result.errorMessage);
        toast({ variant: "destructive", title: "Flow Error", description: result.errorMessage });
      } else {
        toast({ title: "Response Generated", description: "AI has responded to your query." });
      }

      // Add AI response to conversation log
      if (result.aiResponseText) {
        const aiTurn: ConversationTurn = {
            id: `ai-${Date.now()}`,
            speaker: 'AI',
            text: result.aiResponseText,
            timestamp: new Date().toISOString(),
            audioDataUri: result.aiSpeech?.audioDataUri,
        };
        setConversationLog(prev => [...prev, aiTurn]);
        if (result.aiSpeech?.audioDataUri && result.aiSpeech.audioDataUri.startsWith("data:audio")) {
           handlePlayAudio(result.aiSpeech.audioDataUri);
        }
      }
      
      const activityDetails: VoiceSupportAgentActivityDetails = {
        flowInput: flowInput,
        flowOutput: result,
        error: result.errorMessage
      };
      logActivity({ module: "Voice Support Agent", product: selectedProduct, details: activityDetails });
      setUserQuery(""); // Clear input after sending

    } catch (e: any) {
      setError(e.message || "An unexpected error occurred.");
      toast({ variant: "destructive", title: "Query Error", description: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Voice Support Agent (Simulated)" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <audio ref={audioPlayerRef} className="hidden" />
        <Card className="w-full max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Headphones className="mr-2 h-6 w-6 text-primary"/> AI Customer Support</CardTitle>
            <CardDescription>Configure product, voice, and ask your questions. The AI will respond using the Knowledge Base.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <Accordion type="single" collapsible defaultValue="item-config" className="w-full">
                <AccordionItem value="item-config">
                    <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                        <ChevronDown className="mr-2 h-4 w-4 text-accent group-data-[state=open]:rotate-180 transition-transform"/>
                        Configuration (Product & Voice)
                    </AccordionTrigger>
                    <AccordionContent className="pt-3 space-y-3">
                        <div className="space-y-1">
                            <Label htmlFor="support-product-select">Product <span className="text-destructive">*</span></Label>
                            <Select value={selectedProduct} onValueChange={(val) => setSelectedProduct(val as Product)}>
                            <SelectTrigger id="support-product-select"><SelectValue placeholder="Select Product" /></SelectTrigger>
                            <SelectContent>{PRODUCTS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <VoiceSampleUploader 
                            onVoiceProfileCreated={(profile) => {
                                setVoiceProfile(profile);
                                toast({ title: "Voice Profile Set (Simulated)", description: `Using "${profile.name}" for AI responses.`});
                            }} 
                            isLoading={isLoading}
                        />
                        {voiceProfile && (
                        <Alert className="mt-3 bg-blue-50 border-blue-200">
                             <Bot className="h-4 w-4 text-blue-600" />
                            <AlertTitle className="text-blue-700">Active Voice Profile (Simulated)</AlertTitle>
                            <AlertDescription className="text-blue-600 text-xs">
                            Using: {voiceProfile.name}. Voice cloning is simulated; a standard TTS voice will be used.
                            <Button variant="link" size="xs" className="ml-2 h-auto p-0 text-blue-700" onClick={() => setVoiceProfile(null)}>Change/Remove</Button>
                            </AlertDescription>
                        </Alert>
                        )}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        <Card className="w-full max-w-3xl mx-auto mt-4">
            <CardHeader>
                <CardTitle className="text-lg">Ask a Question</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <Textarea
                placeholder="Type your question here (e.g., 'When is my plan expiring?', 'What's included in ETPrime?')"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                rows={3}
                disabled={isLoading || !selectedProduct}
                />
                <Button onClick={handleAskQuery} disabled={isLoading || !selectedProduct || !userQuery.trim()} className="w-full">
                {isLoading ? <LoadingSpinner size={16} className="mr-2"/> : <Send className="mr-2 h-4 w-4"/>}
                Ask AI Agent
                </Button>
                {!selectedProduct && (
                     <p className="text-xs text-muted-foreground text-center">Please select a product above to enable asking questions.</p>
                )}
            </CardContent>
        </Card>
        
        {isLoading && conversationLog.length === 0 && ( 
            <div className="text-center py-4">
                <LoadingSpinner />
                <p className="text-sm text-muted-foreground mt-2">Getting response...</p>
            </div>
        )}

        {conversationLog.length > 0 && (
            <Card className="w-full max-w-3xl mx-auto mt-4">
                <CardHeader>
                    <CardTitle className="text-lg">Conversation Log</CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[300px] w-full border rounded-md p-3 bg-muted/10">
                        {conversationLog.map((turn) => (
                            <ConversationTurnComponent key={turn.id} turn={turn} onPlayAudio={handlePlayAudio} />
                        ))}
                        {isLoading && <LoadingSpinner size={16} className="mx-auto my-2" />}
                        <div ref={conversationEndRef} />
                    </ScrollArea>
                </CardContent>
            </Card>
        )}


        {error && !isLoading && (
          <Alert variant="destructive" className="w-full max-w-3xl mx-auto mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {aiResponse && !isLoading && aiResponse.escalationSuggested && (
          <Alert variant="default" className="w-full max-w-3xl mx-auto mt-4">
            <Info className="h-4 w-4" />
            <AlertTitle>Escalation Suggested</AlertTitle>
            <AlertDescription>
              The AI suggests escalating to a human agent. 
              (Prototype: In a real app, this could trigger a call scheduling or live chat transfer.)
            </AlertDescription>
          </Alert>
        )}
         {aiResponse && !isLoading && aiResponse.sourcesUsed && aiResponse.sourcesUsed.length > 0 && (
            <p className="text-xs text-muted-foreground text-center mt-2">
                Sources used for response: {aiResponse.sourcesUsed.join(', ')}.
            </p>
        )}

        <Alert variant="default" className="w-full max-w-3xl mx-auto mt-6">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertTitle className="font-semibold">Voice Agent Simulation Details</AlertTitle>
            <AlertDescription className="text-xs space-y-1">
              <p>• This module simulates an AI voice support agent. User queries are text-based.</p>
              <p>• <strong>Voice Cloning is Simulated:</strong> The voice sample upload/recording helps create a conceptual "voice profile." However, the actual audio output uses a standard Text-to-Speech (TTS) voice. The AI will acknowledge the selected voice profile in its simulated speech for demonstration purposes (e.g., "[AI voice (Profile: XYZ) speaking]: ...").</p>
              <p>• AI responses are primarily derived from the Knowledge Base content for the selected product.</p>
              <p>• Queries requiring live, personal account data will be acknowledged, but the AI will provide general guidance or simulate fetching data, as it cannot access real user accounts.</p>
            </AlertDescription>
        </Alert>

      </main>
    </div>
  );
}

    