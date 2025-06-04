
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { exportPlainTextFile } from "@/lib/export";
import { exportTextContentToPdf } from "@/lib/pdf-utils";
import type { GeneratePitchOutput } from "@/ai/flows/pitch-generator";
import { Copy, Download, FileText as FileTextIcon, Clock, Info, Mic, ListChecks, MessageSquare, MessageCircleQuestion, Goal, Lightbulb, User, Users } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface PitchCardProps {
  pitch: GeneratePitchOutput;
}

export function PitchCard({ pitch }: PitchCardProps) {
  const { toast } = useToast();

  // Check for pitch generation failure indicated by specific title or content
  if (pitch.pitchTitle?.startsWith("Pitch Generation Aborted") || pitch.pitchTitle?.startsWith("Pitch Generation Failed") || pitch.pitchTitle?.startsWith("Pitch Generation Error")) {
    return (
      <Card className="w-full max-w-2xl shadow-xl mt-8">
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
              {pitch.fullPitchScript && pitch.fullPitchScript.includes("Knowledge Base") && (
                <p className="mt-2 text-xs">This usually means the Knowledge Base content for the selected product was missing or insufficient. Please add relevant information to the Knowledge Base via the 'Knowledge Base Management' page.</p>
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
    navigator.clipboard.writeText(pitch.fullPitchScript) // Copy only the full script for direct use
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
    <Card className="w-full max-w-4xl shadow-xl mt-8 flex flex-col max-h-[calc(100vh-12rem)]"> {/* Adjusted max height */}
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
      
      <CardContent className="flex-grow overflow-hidden p-0">
        <ScrollArea className="h-full px-6 pb-6">
          <div className="space-y-5">
            <div>
              <h3 className="font-semibold text-md mb-1 text-foreground flex items-center"><User className="mr-1.5 h-4 w-4 text-accent"/>Warm Introduction</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{pitch.warmIntroduction}</p>
            </div>
            <Separator/>
            <div>
              <h3 className="font-semibold text-md mb-1 text-foreground flex items-center"><Users className="mr-1.5 h-4 w-4 text-accent"/>Personalized Hook</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{pitch.personalizedHook}</p>
            </div>
            <Separator/>
            <div>
              <h3 className="font-semibold text-md mb-1 text-foreground flex items-center"><Lightbulb className="mr-1.5 h-4 w-4 text-accent"/>Product Explanation</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{pitch.productExplanation}</p>
            </div>
            <Separator/>
            <div>
              <h3 className="font-semibold text-md mb-1 text-foreground flex items-center"><ListChecks className="mr-1.5 h-4 w-4 text-accent"/>Key Benefits and Bundles</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{pitch.keyBenefitsAndBundles}</p>
            </div>
            <Separator/>
            <div>
              <h3 className="font-semibold text-md mb-1 text-foreground flex items-center"><MessageSquare className="mr-1.5 h-4 w-4 text-accent"/>Discount or Deal Explanation</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{pitch.discountOrDealExplanation}</p>
            </div>
            <Separator/>
            <div>
              <h3 className="font-semibold text-md mb-1 text-foreground flex items-center"><MessageCircleQuestion className="mr-1.5 h-4 w-4 text-accent"/>Objection Handling Previews</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{pitch.objectionHandlingPreviews}</p>
            </div>
            <Separator/>
            <div>
              <h3 className="font-semibold text-md mb-1 text-foreground flex items-center"><Goal className="mr-1.5 h-4 w-4 text-accent"/>Final Call to Action</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{pitch.finalCallToAction}</p>
            </div>
            
            {pitch.notesForAgent && (
              <>
                <Separator/>
                <div>
                  <h3 className="font-semibold text-md mb-1 text-foreground flex items-center"><Info className="mr-1.5 h-4 w-4 text-accent"/>Notes for Agent</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-line italic">{pitch.notesForAgent}</p>
                </div>
              </>
            )}

            <Separator className="my-6 !mt-8 !mb-5 border-dashed" />

            <div>
              <h3 className="font-semibold text-lg mb-2 text-primary flex items-center">
                <FileTextIcon className="mr-2 h-5 w-5"/> Full Integrated Pitch Script
              </h3>
              <Textarea
                value={pitch.fullPitchScript}
                readOnly
                className="min-h-[250px] text-sm bg-muted/20 whitespace-pre-line"
                aria-label="Full pitch script"
              />
            </div>
          </div>
        </ScrollArea>
      </CardContent>
      
      <CardFooter className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t px-6 shrink-0">
        <Button variant="outline" onClick={handleCopyToClipboard}>
          <Copy className="mr-2 h-4 w-4" /> Copy Full Script
        </Button>
        <Button variant="outline" onClick={handleDownloadDoc}>
          <Download className="mr-2 h-4 w-4" /> Download .doc (Pitch & Components)
        </Button>
        <Button onClick={handleDownloadPdf}>
          <FileTextIcon className="mr-2 h-4 w-4" /> Download PDF (Pitch & Components)
        </Button>
      </CardFooter>
    </Card>
  );
}
