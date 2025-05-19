
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { exportToTxt } from "@/lib/export";
import { exportElementToPdf, exportTextContentToPdf } from "@/lib/pdf-utils"; // Updated import
import type { GeneratePitchOutput } from "@/ai/flows/pitch-generator";
import { Copy, Download, FileText, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PitchCardProps {
  pitch: GeneratePitchOutput;
}

const PITCH_CARD_CONTENT_ID = "pitch-card-scrollable-content"; // ID for the content div for PDF export

export function PitchCard({ pitch }: PitchCardProps) {
  const { toast } = useToast();

  const fullPitchText = `
Sales Pitch (${pitch.estimatedDuration || 'N/A'})

Headline Hook:
${pitch.headlineHook}

Introduction:
${pitch.introduction}

Key Benefits:
${pitch.keyBenefits.map(b => `- ${b}`).join('\n')}

Pitch Body:
${pitch.pitchBody || "N/A"}

Call to Action:
${pitch.callToAction}
  `.trim();

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(fullPitchText)
      .then(() => toast({ title: "Success", description: "Pitch copied to clipboard!" }))
      .catch(() => toast({ variant: "destructive", title: "Error", description: "Failed to copy pitch." }));
  };

  const handleDownloadPdf = async () => {
    try {
      // For PDF export, we'll use the text content to ensure layout consistency in the PDF
      // as html2canvas can be tricky with complex scrollable layouts.
      exportTextContentToPdf(fullPitchText, "sales-pitch.pdf");
      toast({ title: "Success", description: "Pitch PDF downloaded." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to download PDF." });
    }
  };
  
  const handleDownloadDoc = () => { 
    try {
      exportToTxt("sales-pitch.txt", fullPitchText); 
      toast({ title: "Success", description: "Pitch DOC (as .txt) downloaded." });
    } catch (error) {
       toast({ variant: "destructive", title: "Error", description: "Failed to download DOC (as .txt)." });
    }
  };


  return (
    <Card className="w-full max-w-4xl shadow-xl mt-8 flex flex-col max-h-[85vh]">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="text-2xl text-primary">Your Sales Pitch</CardTitle>
                <CardDescription>Review and use the generated sales pitch below.</CardDescription>
            </div>
            {pitch.estimatedDuration && (
                <div className="flex items-center text-sm text-muted-foreground bg-secondary px-3 py-1.5 rounded-full">
                    <Clock className="mr-2 h-4 w-4" />
                    Estimated: {pitch.estimatedDuration}
                </div>
            )}
        </div>
      </CardHeader>
      
      <CardContent className="flex-grow overflow-hidden p-0"> {/* Make CardContent flex-grow and remove its padding */}
        <ScrollArea className="h-full px-6 pb-6"> {/* ScrollArea takes full height of CardContent */}
          <div id={PITCH_CARD_CONTENT_ID} className="space-y-4"> {/* Content for PDF export if using html2canvas */}
            <div>
              <h3 className="font-semibold text-lg mb-1 text-foreground">Headline Hook</h3>
              <p className="text-muted-foreground">{pitch.headlineHook}</p>
            </div>
            <Separator />
            <div>
              <h3 className="font-semibold text-lg mb-1 text-foreground">Introduction</h3>
              <p className="text-muted-foreground">{pitch.introduction}</p>
            </div>
            <Separator />
            <div>
              <h3 className="font-semibold text-lg mb-1 text-foreground">Key Benefits</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                {pitch.keyBenefits.map((benefit, index) => (
                  <li key={index}>{benefit}</li>
                ))}
              </ul>
            </div>
            <Separator />
            <div>
              <h3 className="font-semibold text-lg mb-1 text-foreground">Pitch Body</h3>
              <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                  {pitch.pitchBody || "Pitch body content will appear here."}
              </p>
            </div>
            <Separator />
            <div>
              <h3 className="font-semibold text-lg mb-1 text-foreground">Call to Action</h3>
              <p className="text-muted-foreground">{pitch.callToAction}</p>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
      
      <CardFooter className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t px-6 shrink-0">
        <Button variant="outline" onClick={handleCopyToClipboard}>
          <Copy className="mr-2 h-4 w-4" /> Copy
        </Button>
        <Button variant="outline" onClick={handleDownloadDoc}>
          <Download className="mr-2 h-4 w-4" /> Download DOC
        </Button>
        <Button onClick={handleDownloadPdf}>
          <FileText className="mr-2 h-4 w-4" /> Download PDF
        </Button>
      </CardFooter>
    </Card>
  );
}
