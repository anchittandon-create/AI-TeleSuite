
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

import { PRODUCTS, Product, VoiceProfile, ConversationTurn, VoiceSupportAgentFlowInput, VoiceSupportAgentFlowOutput, VoiceSupportAgentActivityDetails, KnowledgeFile } from '@/types';
import { runVoiceSupportAgentQuery } from '@/ai/flows/voice-support-agent-flow';

import { Headphones, Send, AlertTriangle, Bot, ChevronDown, AlertCircleIcon, User as UserIcon, Building, Info, SquareTerminal } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


// Helper to prepare Knowledge Base context
const prepareKnowledgeBaseContext = (
  knowledgeBaseFiles: KnowledgeFile[],
  product: Product
): string => {
  const productSpecificFiles = knowledgeBaseFiles.filter(f => f.product === product);
  if (productSpecificFiles.length === 0) return "No specific knowledge base content found for this product.";
  const MAX_CONTEXT_LENGTH = 15000; // Adjusted based on typical model limits
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
  const [countryCode, setCountryCode] = useState<string>("+91"); 
  const [userMobileNumber, setUserMobileNumber] = useState<string>(""); 

  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(null);
  
  const [userQuery, setUserQuery] = useState("");
  const [conversationLog, setConversationLog] = useState<ConversationTurn[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAiAction, setCurrentAiAction] = useState<string | null>(null);

  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  // const audioPlayerRef = useRef<HTMLAudioElement | null>(null); // Not used for AI speech
  const conversationEndRef = useRef<null | HTMLDivElement>(null);

   useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationLog]);
  
  useEffect(() => {
    setAgentName(appAgentProfile); 
  }, [appAgentProfile]);


  const handlePlaySimulatedAudio = (audioDataUri: string) => {
    // This function is now a NO-OP as actual audio playback for AI is not implemented.
    // The placeholder text is displayed directly in ConversationTurnComponent.
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
    setCurrentAiAction("Fetching response...");

    const kbContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, selectedProduct);
    if (kbContext.startsWith("No specific knowledge base")) {
        toast({ variant: "default", title: "Limited KB", description: `Knowledge Base for ${selectedProduct} is sparse. Answers may be general.`, duration: 5000});
    }

    const flowInput: VoiceSupportAgentFlowInput = {
      product: selectedProduct,
      agentName: agentName,
      userName: userName,
      countryCode: countryCode,
      userMobileNumber: userMobileNumber,
      userQuery: userQuery,
      voiceProfileId: voiceProfile?.id,
      knowledgeBaseContext: kbContext,
    };

    const userTurn: ConversationTurn = {
        id: `user-${Date.now()}`,
        speaker: 'User',
        text: userQuery,
        timestamp: new Date().toISOString(),
    };
    setConversationLog(prev => [...prev, userTurn]);

    try {
      const result = await runVoiceSupportAgentQuery(flowInput);
      
      if (result.errorMessage) {
        setError(result.errorMessage);
        toast({ variant: "destructive", title: "Flow Error", description: result.errorMessage, duration: 7000 });
      } else {
        toast({ title: "Response Generated", description: "AI has responded to your query." });
      }

      if (result.aiResponseText) {
        const aiTurn: ConversationTurn = {
            id: `ai-${Date.now()}`,
            speaker: 'AI',
            text: result.aiResponseText,
            timestamp: new Date().toISOString(),
            audioDataUri: result.aiSpeech?.audioDataUri, // This will be the placeholder string
        };
        setConversationLog(prev => [...prev, aiTurn]);
        // No actual audio playback for AI's speech here.
      }
      
      const activityDetails: VoiceSupportAgentActivityDetails = {
        flowInput: flowInput,
        flowOutput: result,
        fullTranscriptText: [...conversationLog, userTurn, ...(result.aiResponseText ? [{id: `ai-${Date.now()}-log`, speaker: 'AI' as 'AI', text: result.aiResponseText, timestamp: new Date().toISOString()}] : [])].map(t => `${t.speaker}: ${t.text}`).join('\n'),
        simulatedInteractionRecordingRef: "N/A - Simulated Web Interaction",
        error: result.errorMessage
      };
      logActivity({ module: "Voice Support Agent", product: selectedProduct, details: activityDetails });
      setUserQuery(""); 

    } catch (e: any) {
      setError(e.message || "An unexpected error occurred.");
      toast({ variant: "destructive", title: "Query Error", description: e.message, duration: 7000 });
    } finally {
      setIsLoading(false);
      setCurrentAiAction(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Voice Support Agent" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {/* <audio ref={audioPlayerRef} className="hidden" /> */}
        
        <Card className="w-full max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Headphones className="mr-2 h-6 w-6 text-primary"/> AI Customer Support Configuration</CardTitle>
            <CardDescription>
                Set up agent and customer context, product, and (simulated) voice profile. Then ask your questions.
                Voice cloning is simulated; standard TTS quality or text placeholders will be used for AI responses.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <Accordion type="single" collapsible defaultValue="item-config" className="w-full">
                <AccordionItem value="item-config">
                    <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                        <ChevronDown className="mr-2 h-4 w-4 text-accent group-data-[state=open]:rotate-180 transition-transform"/>
                        Context Configuration (Agent, Customer, Product)
                    </AccordionTrigger>
                    <AccordionContent className="pt-3 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="support-agent-name">Agent Name (for AI dialogue)</Label>
                                <Input id="support-agent-name" placeholder="e.g., SupportBot (AI Agent)" value={agentName} onChange={e => setAgentName(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="support-user-name">Customer Name (Optional)</Label>
                                <Input id="support-user-name" placeholder="e.g., Rohan Mehra" value={userName} onChange={e => setUserName(e.target.value)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div className="space-y-1">
                                <Label htmlFor="support-country-code">Country Code (Contextual)</Label>
                                 <Select value={countryCode} onValueChange={setCountryCode}>
                                    <SelectTrigger id="support-country-code"><SelectValue placeholder="Code" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="+91">+91 (India)</SelectItem>
                                        <SelectItem value="+1">+1 (US/Canada)</SelectItem>
                                        <SelectItem value="+44">+44 (UK)</SelectItem>
                                        <SelectItem value="+61">+61 (Australia)</SelectItem>
                                        <SelectItem value="+65">+65 (Singapore)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1 col-span-2">
                                <Label htmlFor="support-user-mobile">Customer Mobile (Contextual)</Label>
                                <Input id="support-user-mobile" type="tel" placeholder="Enter customer's mobile" value={userMobileNumber} onChange={e => setUserMobileNumber(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="support-product-select">Product <span className="text-destructive">*</span></Label>
                            <Select value={selectedProduct} onValueChange={(val) => setSelectedProduct(val as Product)}>
                            <SelectTrigger id="support-product-select"><SelectValue placeholder="Select Product" /></SelectTrigger>
                            <SelectContent>{PRODUCTS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="item-voice">
                     <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                        <ChevronDown className="mr-2 h-4 w-4 text-accent group-data-[state=open]:rotate-180 transition-transform"/>
                        AI Voice Profile (Simulated)
                    </AccordionTrigger>
                    <AccordionContent className="pt-3">
                        <VoiceSampleUploader 
                            onVoiceProfileCreated={(profile) => {
                                setVoiceProfile(profile);
                                toast({ title: "Voice Profile Set (Simulated)", description: `Using "${profile.name}" for AI responses. Actual voice output will be standard TTS.`});
                            }} 
                            isLoading={isLoading}
                        />
                        {voiceProfile && (
                        <Alert className="mt-3 bg-blue-50 border-blue-200">
                             <Bot className="h-4 w-4 text-blue-600" />
                            <AlertTitle className="text-blue-700">Active Voice Profile (Simulated)</AlertTitle>
                            <AlertDescription className="text-blue-600 text-xs">
                            Using: {voiceProfile.name} (Sample: {voiceProfile.sampleFileName || 'recorded sample'}). Actual voice will be standard TTS.
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
                <CardTitle className="text-lg flex items-center"> <SquareTerminal className="mr-2 h-5 w-5 text-primary"/> Ask a Question / Log Interaction</CardTitle>
                 <CardDescription>
                    Type the customer's query. The AI will respond using the Knowledge Base and simulated voice.
                    {currentAiAction && <span className="ml-2 text-xs text-muted-foreground italic">({currentAiAction})</span>}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <Label htmlFor="user-query-textarea">Customer's Query:</Label>
                <Textarea
                id="user-query-textarea"
                placeholder="Type your question here (e.g., 'When is my plan expiring?', 'What's included in ETPrime?')"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                rows={3}
                disabled={isLoading || !selectedProduct}
                />
                <Button onClick={handleAskQuery} disabled={isLoading || !selectedProduct || !userQuery.trim()} className="w-full">
                {isLoading && conversationLog.length > 0 ? <LoadingSpinner size={16} className="mr-2"/> : <Send className="mr-2 h-4 w-4"/>}
                {isLoading && conversationLog.length > 0 ? "Getting Answer..." : "Ask AI Support Agent"}
                </Button>
                {!selectedProduct && (
                     <p className="text-xs text-muted-foreground text-center">Please select a product above to enable asking questions.</p>
                )}
            </CardContent>
             {conversationLog.length > 0 && (
                <CardFooter className="flex flex-col items-start p-0">
                    <div className="w-full px-6 pt-3">
                         <h3 className="text-md font-semibold mb-2">Conversation Log:</h3>
                    </div>
                    <ScrollArea className="h-[300px] w-full border-t rounded-b-md p-3 bg-muted/10">
                        {conversationLog.map((turn) => (
                            <ConversationTurnComponent key={turn.id} turn={turn} onPlayAudio={handlePlaySimulatedAudio} />
                        ))}
                        {isLoading && conversationLog.length > 0 && <LoadingSpinner size={16} className="mx-auto my-2" />}
                        <div ref={conversationEndRef} />
                    </ScrollArea>
                </CardFooter>
            )}
        </Card>
        
        {isLoading && conversationLog.length === 0 && ( 
            <div className="text-center py-4">
                <LoadingSpinner />
                <p className="text-sm text-muted-foreground mt-2">Getting response...</p>
            </div>
        )}

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
