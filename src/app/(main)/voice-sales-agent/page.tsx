
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
import { CallScoringResultsCard } from '@/components/features/call-scoring/call-scoring-results-card';

import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { useUserProfile } from '@/hooks/useUserProfile';


import { 
    PRODUCTS, SALES_PLANS, CUSTOMER_COHORTS,
    Product, SalesPlan, CustomerCohort, VoiceProfile, ConversationTurn, 
    VoiceSalesAgentFlowInput, VoiceSalesAgentFlowOutput, 
    GeneratePitchOutput,
    ScoreCallOutput, VoiceSalesAgentActivityDetails, KnowledgeFile 
} from '@/types';
import { runVoiceSalesAgentTurn } from '@/ai/flows/voice-sales-agent-flow';

import { PhoneCall, Send, AlertTriangle, Bot, ChevronDown, Redo, Zap, SquareTerminal, Smartphone, AlertCircleIcon, User as UserIcon, Building, Info } from 'lucide-react';
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
    // Prioritize text entries or small text files
    let contentToInclude = `(File: ${file.name}, Type: ${file.type}. Content not directly viewed for non-text or large files; AI should use name/type as context.)`;
    if (file.isTextEntry && file.textContent) {
        contentToInclude = file.textContent.substring(0,2000) + (file.textContent.length > 2000 ? "..." : "");
    } else if (!file.isTextEntry && (file.type.startsWith('text/') || file.name.match(/\.(txt|md|csv)$/i)) && file.size < 200000) { // Smaller text files
        // This part would require async file reading if we were to implement it here.
        // For now, we'll rely on the AI's ability to infer from file name/type for non-text-entry KB items.
        // If direct content is needed, it should be a text entry in the KB.
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


export default function VoiceSalesAgentPage() {
  const { currentProfile: appAgentProfile } = useUserProfile(); 
  const [agentName, setAgentName] = useState<string>(appAgentProfile); 
  const [userName, setUserName] = useState<string>(""); 
  const [countryCode, setCountryCode] = useState<string>("+91");
  const [userMobileNumber, setUserMobileNumber] = useState<string>("");
  
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const [selectedSalesPlan, setSelectedSalesPlan] = useState<SalesPlan | undefined>();
  const [offerDetails, setOfferDetails] = useState<string>("");
  const [selectedCohort, setSelectedCohort] = useState<CustomerCohort | undefined>();
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(null);
  
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [userInputText, setUserInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPitch, setCurrentPitch] = useState<GeneratePitchOutput | null>(null);
  const [finalScore, setFinalScore] = useState<ScoreCallOutput | null>(null);
  const [isConversationStarted, setIsConversationStarted] = useState(false);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [currentAiAction, setCurrentAiAction] = useState<string | null>(null); // For UI feedback

  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null); // Only for playing user's recorded audio if that feature was fully active
  const conversationEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);
  
  useEffect(() => {
    setAgentName(appAgentProfile); 
  }, [appAgentProfile]);


  const handlePlaySimulatedAudio = (audioDataUri: string) => {
    // This function is now a NO-OP as actual audio playback for AI is not implemented.
    // The placeholder text is displayed directly in ConversationTurnComponent.
    // console.log("Simulated audio play requested for (placeholder):", audioDataUri);
  };

  const processAgentTurn = useCallback(async (
    action: VoiceSalesAgentFlowInput['action'],
    currentObjection?: string
  ) => {
    if (!selectedProduct || !selectedCohort || !userMobileNumber) {
      toast({ variant: "destructive", title: "Missing Info", description: "Please select Product, Customer Cohort, and enter User Mobile Number." });
      return;
    }
    setIsLoading(true);
    setError(null);
    setCurrentAiAction(action === "START_CONVERSATION" ? "Initiating call..." : action === "PROCESS_USER_RESPONSE" ? "Processing response..." : action === "GET_REBUTTAL" ? "Generating rebuttal..." : "Ending call...");


    const kbContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, selectedProduct);

    const flowInput: VoiceSalesAgentFlowInput = {
      product: selectedProduct,
      salesPlan: selectedSalesPlan,
      offer: offerDetails,
      customerCohort: selectedCohort,
      agentName: agentName,
      userName: userName,
      countryCode: countryCode,
      userMobileNumber: userMobileNumber,
      voiceProfileId: voiceProfile?.id,
      knowledgeBaseContext: kbContext,
      conversationHistory: conversation,
      currentUserInputText: action === "PROCESS_USER_RESPONSE" || action === "GET_REBUTTAL" ? userInputText : undefined,
      currentPitchState: currentPitch,
      action: action,
    };
     if (action === "GET_REBUTTAL" && currentObjection) {
      flowInput.currentUserInputText = currentObjection;
    }


    try {
      const result = await runVoiceSalesAgentTurn(flowInput);
      
      if (result.errorMessage) {
        setError(result.errorMessage);
        toast({ variant: "destructive", title: "Flow Error", description: result.errorMessage, duration: 7000 });
      }

      setConversation(prev => [...prev, ...result.conversationTurns.filter(rt => !prev.find(pt => pt.id === rt.id))]);
      
      if (result.generatedPitch && action === "START_CONVERSATION") {
        setCurrentPitch(result.generatedPitch as GeneratePitchOutput);
      }
      // AI Speech is handled by displaying text, no actual audio playback here for AI.
      // User's audio (if recorded and passed) would be handled by ConversationTurnComponent if it had playback for user.

      if (result.callScore) {
        setFinalScore(result.callScore as ScoreCallOutput);
        setIsCallEnded(true);
        toast({ title: "Call Ended & Scored", description: "The sales call simulation has concluded and been scored." });
      }
      if (result.nextExpectedAction === "CALL_SCORED" || result.nextExpectedAction === "END_CALL_NO_SCORE") {
        setIsCallEnded(true);
      }

      setUserInputText(""); 

       const activityDetails: VoiceSalesAgentActivityDetails = {
         flowInput: {
            product: selectedProduct, 
            customerCohort: selectedCohort, 
            action: action,
            agentName: agentName,
            userName: userName,
            countryCode: countryCode,
            userMobileNumber: userMobileNumber,
            salesPlan: selectedSalesPlan,
            offer: offerDetails,
            voiceProfileId: voiceProfile?.id,
        },
         flowOutput: result,
         finalScore: result.callScore as ScoreCallOutput | undefined,
         fullTranscriptText: result.conversationTurns.map(t => `${t.speaker}: ${t.text}`).join('\n'),
         simulatedCallRecordingRef: "N/A - Simulated Web Call",
         error: result.errorMessage
       };
      logActivity({ module: "Voice Sales Agent", product: selectedProduct, details: activityDetails });

    } catch (e: any) {
      setError(e.message || "An unexpected error occurred.");
      toast({ variant: "destructive", title: "Interaction Error", description: e.message, duration: 7000 });
    } finally {
      setIsLoading(false);
      setCurrentAiAction(null);
    }
  }, [selectedProduct, selectedSalesPlan, offerDetails, selectedCohort, userMobileNumber, agentName, userName, countryCode, voiceProfile, conversation, userInputText, currentPitch, knowledgeBaseFiles, logActivity, toast]);

  const handleStartConversation = () => {
    if (!userMobileNumber.trim()) {
        toast({ variant: "destructive", title: "Missing Mobile Number", description: "Please enter the user's mobile number to start the call." });
        return;
    }
     if (!userName.trim()) {
        toast({ variant: "destructive", title: "Missing User Name", description: "Please enter the customer's name." });
        return;
    }
    setConversation([]); // Reset for a new call
    setCurrentPitch(null);
    setFinalScore(null);
    setIsCallEnded(false);
    setIsConversationStarted(true);
    processAgentTurn("START_CONVERSATION");
  };

  const handleSendUserResponse = () => {
    if (!userInputText.trim()) {
      toast({ variant: "destructive", title: "Empty Input", description: "Please type user's response." });
      return;
    }
    // Add user's typed response to conversation log immediately for UI responsiveness
    const userTurn: ConversationTurn = {
        id: `user-${Date.now()}`,
        speaker: 'User',
        text: userInputText,
        timestamp: new Date().toISOString(),
    };
    setConversation(prev => [...prev, userTurn]);
    processAgentTurn("PROCESS_USER_RESPONSE");
  };

  const handleGetRebuttal = () => {
     if (!userInputText.trim()) {
      toast({ variant: "destructive", title: "Empty Input", description: "Enter the user's objection before getting a rebuttal." });
      return;
    }
     const userTurn: ConversationTurn = {
        id: `user-objection-${Date.now()}`,
        speaker: 'User',
        text: userInputText, // Use current input as objection
        timestamp: new Date().toISOString(),
    };
    setConversation(prev => [...prev, userTurn]);
    processAgentTurn("GET_REBUTTAL", userInputText); // Pass current input as objection
  }

  const handleEndCall = () => {
    processAgentTurn("END_CALL_AND_SCORE");
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Voice Sales Agent" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {/* Audio player is not used for AI speech output in this simulated version */}
        {/* <audio ref={audioPlayerRef} className="hidden" /> */}
        
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><PhoneCall className="mr-2 h-6 w-6 text-primary"/> Configure & Initiate Sales Call</CardTitle>
            <CardDescription>
              Set up agent, customer, product, offer, and (simulated) voice profile. The AI will initiate the call and respond based on your inputs.
              No real phone calls are made. Voice cloning is simulated; standard TTS quality or text placeholders will be used for AI responses.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Accordion type="single" collapsible defaultValue="item-config" className="w-full">
                <AccordionItem value="item-config">
                    <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                        <ChevronDown className="mr-2 h-4 w-4 text-accent group-data-[state=open]:rotate-180 transition-transform"/>
                        Call Configuration (Agent, Customer, Product, Cohort, Offer)
                    </AccordionTrigger>
                    <AccordionContent className="pt-3 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="agent-name">Agent Name (for AI dialogue)</Label>
                                <Input id="agent-name" placeholder="e.g., Alex (AI Agent)" value={agentName} onChange={e => setAgentName(e.target.value)} disabled={isConversationStarted} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="user-name">Customer Name <span className="text-destructive">*</span></Label>
                                <Input id="user-name" placeholder="e.g., Priya Sharma" value={userName} onChange={e => setUserName(e.target.value)} disabled={isConversationStarted} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="country-code">Country Code</Label>
                                <Select value={countryCode} onValueChange={setCountryCode} disabled={isConversationStarted}>
                                    <SelectTrigger id="country-code"><SelectValue placeholder="Code" /></SelectTrigger>
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
                                <Label htmlFor="user-mobile-number">Customer Mobile Number <span className="text-destructive">*</span></Label>
                                <Input id="user-mobile-number" type="tel" placeholder="Enter customer's mobile" value={userMobileNumber} onChange={e => setUserMobileNumber(e.target.value)} disabled={isConversationStarted} />
                            </div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="product-select">Product <span className="text-destructive">*</span></Label>
                                <Select value={selectedProduct} onValueChange={(val) => setSelectedProduct(val as Product)} disabled={isConversationStarted}>
                                <SelectTrigger id="product-select"><SelectValue placeholder="Select Product" /></SelectTrigger>
                                <SelectContent>{PRODUCTS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="cohort-select">Customer Cohort <span className="text-destructive">*</span></Label>
                                <Select value={selectedCohort} onValueChange={(val) => setSelectedCohort(val as CustomerCohort)} disabled={isConversationStarted}>
                                <SelectTrigger id="cohort-select"><SelectValue placeholder="Select Cohort" /></SelectTrigger>
                                <SelectContent>{CUSTOMER_COHORTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="plan-select">Sales Plan (Optional)</Label>
                                <Select value={selectedSalesPlan} onValueChange={(val) => setSelectedSalesPlan(val as SalesPlan)} disabled={isConversationStarted}>
                                <SelectTrigger id="plan-select"><SelectValue placeholder="Select Sales Plan" /></SelectTrigger>
                                <SelectContent>{SALES_PLANS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-1">
                                <Label htmlFor="offer-details">Offer Details (Optional)</Label>
                                <Input id="offer-details" placeholder="e.g., 20% off, free gift" value={offerDetails} onChange={e => setOfferDetails(e.target.value)} disabled={isConversationStarted} />
                            </div>
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
                            isLoading={isLoading || isConversationStarted}
                        />
                        {voiceProfile && (
                        <Alert className="mt-3 bg-blue-50 border-blue-200">
                            <Bot className="h-4 w-4 text-blue-600" />
                            <AlertTitle className="text-blue-700">Active Voice Profile (Simulated)</AlertTitle>
                            <AlertDescription className="text-blue-600 text-xs">
                            Using: {voiceProfile.name} (Sample: {voiceProfile.sampleFileName || 'recorded sample'}). Actual voice will be standard TTS.
                            <Button variant="link" size="xs" className="ml-2 h-auto p-0 text-blue-700" onClick={() => setVoiceProfile(null)} disabled={isConversationStarted}>Change/Remove</Button>
                            </AlertDescription>
                        </Alert>
                        )}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
            
            {!isConversationStarted && (
                 <Button onClick={handleStartConversation} disabled={isLoading || !selectedProduct || !selectedCohort || !userMobileNumber.trim() || !userName.trim()} className="w-full mt-4">
                    <Smartphone className="mr-2 h-4 w-4"/> Start Call to {userName || "Customer"} ({countryCode}{userMobileNumber || "Number"})
                </Button>
            )}
          </CardContent>
        </Card>

        {isConversationStarted && (
          <Card className="w-full max-w-4xl mx-auto mt-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center"><SquareTerminal className="mr-2 h-5 w-5 text-primary"/> Conversation Log</CardTitle>
              <CardDescription>
                Call with {userName || "Customer"} ({countryCode}{userMobileNumber}). Agent: {agentName || "AI Agent"}.
                {currentAiAction && <span className="ml-2 text-xs text-muted-foreground italic">({currentAiAction})</span>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] w-full border rounded-md p-3 bg-muted/20 mb-3">
                {conversation.map((turn) => <ConversationTurnComponent key={turn.id} turn={turn} onPlayAudio={handlePlaySimulatedAudio} />)}
                {isLoading && conversation.length > 0 && <LoadingSpinner size={16} className="mx-auto my-2" />}
                <div ref={conversationEndRef} />
              </ScrollArea>
              
              {!isCallEnded && (
                <div className="space-y-3">
                  <Label htmlFor="user-response-text">Customer's Spoken Response (Type here):</Label>
                  <Textarea
                    id="user-response-text"
                    placeholder="Type customer's response here..."
                    value={userInputText}
                    onChange={(e) => setUserInputText(e.target.value)}
                    rows={3}
                    disabled={isLoading}
                  />
                  <div className="flex flex-col sm:flex-row gap-2 justify-end">
                     <Button onClick={handleGetRebuttal} variant="outline" disabled={isLoading || !userInputText.trim()}>
                        <Redo className="mr-2 h-4 w-4"/> Get Rebuttal for this
                    </Button>
                    <Button onClick={handleSendUserResponse} disabled={isLoading || !userInputText.trim()}>
                      <Send className="mr-2 h-4 w-4"/> Send Customer Response
                    </Button>
                  </div>
                </div>
              )}
              
              {error && (
                <Alert variant="destructive" className="mt-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

            </CardContent>
            <CardFooter className="flex justify-between items-center">
                 <Button onClick={() => { setIsConversationStarted(false); setConversation([]); setCurrentPitch(null); setFinalScore(null); setIsCallEnded(false); setUserInputText(""); }} variant="outline" size="sm">
                    New Call / Reset
                </Button>
                {!isCallEnded && (
                    <Button onClick={handleEndCall} variant="destructive" size="sm" disabled={isLoading}>
                        End Call & Get Score
                    </Button>
                )}
            </CardFooter>
          </Card>
        )}

        {isCallEnded && finalScore && (
          <div className="w-full max-w-4xl mx-auto mt-4">
             <CallScoringResultsCard 
                results={finalScore} 
                fileName={`Call: ${selectedProduct} to ${userName || "Customer"}`} 
                isHistoricalView={true} // No audio playback for historical scores here
            />
          </div>
        )}
      </main>
    </div>
  );
}
