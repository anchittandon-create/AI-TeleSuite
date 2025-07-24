
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { exportPlainTextFile } from "@/lib/export";
import { exportTextContentToPdf } from "@/lib/pdf-utils";
import type { GeneratePitchOutput } from "@/ai/flows/pitch-generator";
import { Copy, Download, FileText as FileTextIcon, Clock, Info, Mic, ListChecks, MessageSquare, MessageCircleQuestion, Goal, Lightbulb, User, Users, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


interface PitchCardProps {
  pitch: GeneratePitchOutput;
}

export function PitchCard({ pitch }: PitchCardProps) {
  const { toast } = useToast();

  if (pitch.pitchTitle?.startsWith("Pitch Generation Aborted") || pitch.pitchTitle?.startsWith("Pitch Generation Failed") || pitch.pitchTitle?.startsWith("Pitch Generation Error")) {
    return (
      <Card className="w-full max-w-3xl shadow-xl mt-8">
        <CardHeader>
          <CardTitle className="text-xl text-destructive flex items-center">
            <Info className="mr-2 h-5 w-5" /> {pitch.pitchTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Pitch Generation Unsuccessful</AlertTitle>
            <AlertDescription>
              <p>{pitch.warmIntroduction || "Could not generate pitch details."}</p>
              {pitch.fullPitchScript && (pitch.fullPitchScript.includes("Knowledge Base") || pitch.fullPitchScript.includes("AI service error")) && (
                <p className="mt-2 text-xs">This usually means the Knowledge Base content for the selected product was missing or insufficient, or there was an AI service error. Please check the Knowledge Base or server logs.</p>
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }
  
  const fullPitchTextForExport = `
Pitch Title: ${pitch.pitchTitle}
Estimated Duration: ${pitch.estimatedDuration || 'N/A'}
Agent Notes: ${pitch.notesForAgent || 'N/A'}

Full Pitch Script:
--------------------------------------------------
${pitch.fullPitchScript}
--------------------------------------------------

Individual Components:
Warm Introduction:
${pitch.warmIntroduction}

Personalized Hook:
${pitch.personalizedHook}

Product Explanation:
${pitch.productExplanation}

Key Benefits and Bundles:
${pitch.keyBenefitsAndBundles}

Discount or Deal Explanation:
${pitch.discountOrDealExplanation}

Objection Handling Previews:
${pitch.objectionHandlingPreviews}

Final Call to Action:
${pitch.finalCallToAction}
  `.trim();

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(pitch.fullPitchScript)
      .then(() => toast({ title: "Success", description: "Full pitch script copied to clipboard!" }))
      .catch(() => toast({ variant: "destructive", title: "Error", description: "Failed to copy pitch script." }));
  };

  const handleDownloadPdf = () => {
    try {
      exportTextContentToPdf(fullPitchTextForExport, `${pitch.pitchTitle.replace(/[^a-zA-Z0-9]/g, '_') || "sales_pitch"}.pdf`);
      toast({ title: "Success", description: "Pitch PDF (with components) downloaded." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to download PDF." });
    }
  };
  
  const handleDownloadDoc = () => { 
    try {
      exportPlainTextFile(`${pitch.pitchTitle.replace(/[^a-zA-Z0-9]/g, '_') || "sales_pitch"}.doc`, fullPitchTextForExport); 
      toast({ title: "Success", description: "Pitch DOC (as .txt, with components) downloaded." });
    } catch (error) {
       toast({ variant: "destructive", title: "Error", description: "Failed to download DOC (as .txt)." });
    }
  };

  return (
    <Card className="w-full max-w-4xl shadow-xl mt-8">
      <CardHeader>
        <div className="flex justify-between items-start flex-wrap gap-y-2">
            <div>
                <CardTitle className="text-xl text-primary flex items-center"><Mic className="mr-2 h-6 w-6"/>{pitch.pitchTitle}</CardTitle>
                <CardDescription>Review and use the generated sales pitch below. The full script integrates all components.</CardDescription>
            </div>
            {pitch.estimatedDuration && (
                <div className="flex items-center text-sm text-muted-foreground bg-secondary px-3 py-1.5 rounded-full">
                    <Clock className="mr-2 h-4 w-4" />
                    Est. Duration: {pitch.estimatedDuration}
                </div>
            )}
        </div>
      </CardHeader>
      
      <CardContent>
        <Accordion type="multiple" defaultValue={["item-script"]} className="w-full space-y-1">
          <AccordionItem value="item-script">
            <AccordionTrigger className="text-lg font-semibold hover:no-underline py-3 bg-muted/10 px-4 rounded-t-md [&_svg]:mr-2">
                <div className="flex items-center"><FileTextIcon className="mr-2 h-5 w-5 text-accent"/> Full Integrated Pitch Script</div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-0 px-4 border border-t-0 rounded-b-md">
                 <Textarea
                    value={pitch.fullPitchScript}
                    readOnly
                    className="min-h-[300px] text-sm bg-background whitespace-pre-line" // Increased min-height
                    aria-label="Full pitch script"
                 />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-intro">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 [&_svg]:mr-2">
                <div className="flex items-center"><User className="mr-1.5 h-4 w-4 text-accent"/>Warm Introduction</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 text-sm bg-muted/20 p-3 rounded-b-md">
                 <p className="text-sm text-muted-foreground whitespace-pre-line">{pitch.warmIntroduction}</p>
            </AccordionContent>
          </AccordionItem>

           <AccordionItem value="item-hook">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 [&_svg]:mr-2">
                <div className="flex items-center"><Users className="mr-1.5 h-4 w-4 text-accent"/>Personalized Hook</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 text-sm bg-muted/20 p-3 rounded-b-md">
                 <p className="text-sm text-muted-foreground whitespace-pre-line">{pitch.personalizedHook}</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-explanation">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 [&_svg]:mr-2">
                <div className="flex items-center"><Lightbulb className="mr-1.5 h-4 w-4 text-accent"/>Product Explanation</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 text-sm bg-muted/20 p-3 rounded-b-md">
                <p className="text-sm text-muted-foreground whitespace-pre-line">{pitch.productExplanation}</p>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-benefits">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 [&_svg]:mr-2">
                <div className="flex items-center"><ListChecks className="mr-1.5 h-4 w-4 text-accent"/>Key Benefits & Bundles</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 text-sm bg-muted/20 p-3 rounded-b-md">
                <p className="text-sm text-muted-foreground whitespace-pre-line">{pitch.keyBenefitsAndBundles}</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-deal">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 [&_svg]:mr-2">
                 <div className="flex items-center"><MessageSquare className="mr-1.5 h-4 w-4 text-accent"/>Discount or Deal Explanation</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 text-sm bg-muted/20 p-3 rounded-b-md">
                <p className="text-sm text-muted-foreground whitespace-pre-line">{pitch.discountOrDealExplanation}</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-objections">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 [&_svg]:mr-2">
                <div className="flex items-center"><MessageCircleQuestion className="mr-1.5 h-4 w-4 text-accent"/>Objection Handling Previews</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 text-sm bg-muted/20 p-3 rounded-b-md">
                <p className="text-sm text-muted-foreground whitespace-pre-line">{pitch.objectionHandlingPreviews}</p>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-cta">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 [&_svg]:mr-2">
                <div className="flex items-center"><Goal className="mr-1.5 h-4 w-4 text-accent"/>Final Call to Action</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 text-sm bg-muted/20 p-3 rounded-b-md">
                 <p className="text-sm text-muted-foreground whitespace-pre-line">{pitch.finalCallToAction}</p>
            </AccordionContent>
          </AccordionItem>
          
           {pitch.notesForAgent && (
            <AccordionItem value="item-notes">
                <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 [&_svg]:mr-2">
                    <div className="flex items-center"><Info className="mr-1.5 h-4 w-4 text-accent"/>Notes for Agent</div>
                </AccordionTrigger>
                <AccordionContent className="pt-1 text-sm bg-muted/20 p-3 rounded-b-md">
                     <p className="text-sm text-muted-foreground whitespace-pre-line italic">{pitch.notesForAgent}</p>
                </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </CardContent>
      
      <CardFooter className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t px-6">
        <Button variant="outline" onClick={handleCopyToClipboard} size="sm">
          <Copy className="mr-2 h-4 w-4" /> Copy Full Script
        </Button>
        <Button onClick={handleDownloadPdf} size="sm">
          <FileTextIcon className="mr-2 h-4 w-4" /> Download PDF (Full)
        </Button>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9"><ChevronDown className="h-4 w-4"/></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDownloadDoc}>
                    <Download className="mr-2 h-4 w-4" /> Download .doc (Full)
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
}

    
