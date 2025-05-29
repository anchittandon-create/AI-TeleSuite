
"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useKnowledgeBase, KnowledgeFile } from "@/hooks/use-knowledge-base";
import { useState, useMemo, useEffect } from "react";
import { BookOpen, FileText, UploadCloud, Settings2, FileType2, Briefcase, Download, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PRODUCTS, Product } from "@/types";
import { generateTrainingDeck } from "@/ai/flows/training-deck-generator";
import type { GenerateTrainingDeckInput, GenerateTrainingDeckOutput, KnowledgeBaseItemSchema as FlowKnowledgeBaseItemSchema } from "@/ai/flows/training-deck-generator";
import { useActivityLogger } from "@/hooks/use-activity-logger";
import { exportTextContentToPdf } from "@/lib/pdf-utils";
import { exportToTxt } from "@/lib/export";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { Alert as UiAlert, AlertDescription } from "@/components/ui/alert"; // Renamed to avoid conflict with window.Alert
import type { z } from "zod";


type DeckFormat = "PDF" | "Word Doc" | "PPT";
const DECK_FORMATS: DeckFormat[] = ["PDF", "Word Doc", "PPT"];

export default function CreateTrainingDeckPage() {
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const [selectedKbFileIds, setSelectedKbFileIds] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(undefined);
  const [selectedFormat, setSelectedFormat] = useState<DeckFormat | undefined>(DECK_FORMATS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedDeck, setGeneratedDeck] = useState<GenerateTrainingDeckOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Ensure selectedKbFileIds only contains IDs of currently available files
    setSelectedKbFileIds(prevSelectedIds => {
      const availableFileIds = new Set(knowledgeBaseFiles.map(f => f.id));
      return prevSelectedIds.filter(id => availableFileIds.has(id));
    });
  }, [knowledgeBaseFiles]);

  const selectedKnowledgeBaseItems = useMemo(() => {
    return knowledgeBaseFiles.filter(file => selectedKbFileIds.includes(file.id));
  }, [knowledgeBaseFiles, selectedKbFileIds]);

  const mapToKbFlowItems = (items: KnowledgeFile[]): Array<z.infer<typeof FlowKnowledgeBaseItemSchema>> => {
    return items.map(item => ({
        name: item.name,
        textContent: item.isTextEntry ? item.textContent : undefined,
        isTextEntry: !!item.isTextEntry
    }));
  };

  const handleGenerateDeck = async (fromFullKb: boolean = false) => {
    setIsLoading(true);
    setGeneratedDeck(null);
    setError(null);

    if (!selectedProduct) {
      toast({ variant: "destructive", title: "Product Not Selected", description: "Please select a product." });
      setIsLoading(false);
      return;
    }
    if (!selectedFormat) {
      toast({ variant: "destructive", title: "Format Not Selected", description: "Please select an output format." });
      setIsLoading(false);
      return;
    }

    const itemsToProcess = fromFullKb ? knowledgeBaseFiles.filter(f => f.product === selectedProduct) : selectedKnowledgeBaseItems;
    if (!fromFullKb && itemsToProcess.length === 0) {
      toast({ variant: "destructive", title: "No Files Selected", description: "Please select files or generate from entire KB for the selected product." });
      setIsLoading(false);
      return;
    }
     if (fromFullKb && itemsToProcess.length === 0) { 
      toast({ variant: "destructive", title: "Knowledge Base Empty for Product", description: `Cannot generate from entire KB as it's empty for ${selectedProduct}.` });
      setIsLoading(false);
      return;
    }


    const flowInput: GenerateTrainingDeckInput = {
      product: selectedProduct,
      deckFormatHint: selectedFormat,
      knowledgeBaseItems: mapToKbFlowItems(itemsToProcess),
      generateFromAllKb: fromFullKb,
    };

    try {
      const result = await generateTrainingDeck(flowInput);
      if (result.deckTitle.startsWith("Error Generating Deck")) {
        setError(result.slides[0]?.content || "AI failed to generate training deck content.");
        setGeneratedDeck(null);
        toast({ variant: "destructive", title: "Deck Generation Failed", description: result.slides[0]?.content || "AI reported an error during deck generation." });
        logActivity({
          module: "Create Training Deck",
          product: selectedProduct,
          details: {
            error: result.slides[0]?.content || "AI failed to generate training deck content.",
            inputData: flowInput
          }
        });
      } else {
        setGeneratedDeck(result);
        toast({ title: "Training Deck Generated!", description: `Deck for ${selectedProduct} is ready.` });
        logActivity({
          module: "Create Training Deck",
          product: selectedProduct,
          details: { 
            deckOutput: result,
            inputData: flowInput
          }
        });
      }
    } catch (e) {
      console.error("Error generating training deck:", e);
      const errorMessage = e instanceof Error ? e.message : "An unexpected AI error occurred.";
      setError(errorMessage);
      toast({ variant: "destructive", title: "Deck Generation Failed", description: errorMessage });
      logActivity({
          module: "Create Training Deck",
          product: selectedProduct,
          details: {
            error: errorMessage,
            inputData: flowInput
          }
        });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDeckForTextExport = (deck: GenerateTrainingDeckOutput, format: "Word Doc" | "PPT"): string => {
    let output = `Training Deck: ${deck.deckTitle}\n`;
    output += `Product: ${selectedProduct}\n`;
    output += `Format Hint: ${format}\n\n`;

    deck.slides.forEach((slide, index) => {
      output += `--------------------------------------------------\n`;
      output += `Slide ${index + 1}: ${slide.title}\n`;
      output += `--------------------------------------------------\n`;
      output += `${slide.content}\n\n`;
      if (slide.notes) {
        output += `Speaker Notes:\n${slide.notes}\n\n`;
      }
    });
    return output;
  };

  const handleExportDeck = (deck: GenerateTrainingDeckOutput | null, format: DeckFormat | undefined) => {
    if (!deck || !format || !selectedProduct) return;

    const filenameBase = `Training_Deck_${selectedProduct.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`;
    let exportFilename = "";

    if (format === "PDF") {
      let pdfContent = `Training Deck: ${deck.deckTitle}\nProduct: ${selectedProduct}\n\n`;
      deck.slides.forEach((slide, index) => {
        pdfContent += `Slide ${index + 1}: ${slide.title}\n\n${slide.content}\n\n`;
        if(slide.notes) pdfContent += `Speaker Notes:\n${slide.notes}\n\n`;
        pdfContent += "-----\n\n";
      });
      exportFilename = `${filenameBase}.pdf`;
      exportTextContentToPdf(pdfContent, exportFilename);
      toast({ title: "PDF Exported", description: `${exportFilename} has been downloaded.` });
    } else if (format === "Word Doc") {
      const textContent = formatDeckForTextExport(deck, format);
      exportFilename = `${filenameBase}.doc`; 
      exportToTxt(exportFilename, textContent);
      toast({ title: "Word Doc Text Outline Downloaded", description: `${exportFilename} is a text file. Open it and copy the content into Word. You may need to rename the extension to .txt to open easily.` });
    } else if (format === "PPT") {
      const textContent = formatDeckForTextExport(deck, format);
      exportFilename = `${filenameBase}.ppt`; 
      exportToTxt(exportFilename, textContent);
      toast({ title: "PPT Text Outline Downloaded", description: `${exportFilename} is a text file. Open it and copy the content into PowerPoint slides. You may need to rename the extension to .txt to open easily.` });
    }
  };

  const handleCopyToClipboard = (deck: GenerateTrainingDeckOutput | null) => {
    if (!deck || !selectedProduct || !selectedFormat) return;
    const textContent = formatDeckForTextExport(deck, selectedFormat === "PDF" ? "Word Doc" : selectedFormat);
    navigator.clipboard.writeText(textContent)
      .then(() => toast({ title: "Success", description: "Deck content copied to clipboard!" }))
      .catch(_ => toast({ variant: "destructive", title: "Error", description: "Failed to copy deck content." }));
  };


  const handleKbFileSelectionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const options = event.target.options;
    const value: string[] = [];
    for (let i = 0, l = options.length; i < l; i++) {
      if (options[i].selected) {
        value.push(options[i].value);
      }
    }
    setSelectedKbFileIds(value);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Create Training Deck" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 flex flex-col items-center">
        <Card className="w-full max-w-2xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl text-primary flex items-center">
              <Settings2 className="h-6 w-6 mr-3" />
              Configure Training Deck
            </CardTitle>
            <CardDescription>
              Select product, format, and source files to generate your training material.
              The AI will use text from 'Text Entries' and file names from 'File Uploads' in the KB for the selected product.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="product-select" className="mb-2 block flex items-center"><Briefcase className="h-4 w-4 mr-2" />Product</Label>
              <Select
                value={selectedProduct}
                onValueChange={(value) => setSelectedProduct(value as Product)}
              >
                <SelectTrigger id="product-select">
                  <SelectValue placeholder="Select Product (ET / TOI)" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCTS.map(product => (
                    <SelectItem key={product} value={product}>
                      {product}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="format-select" className="mb-2 block flex items-center"><FileType2 className="h-4 w-4 mr-2" />Output Format</Label>
              <Select
                value={selectedFormat}
                onValueChange={(value) => setSelectedFormat(value as DeckFormat)}
              >
                <SelectTrigger id="format-select">
                  <SelectValue placeholder="Select Deck Format" />
                </SelectTrigger>
                <SelectContent>
                  {DECK_FORMATS.map(format => (
                    <SelectItem key={format} value={format}>
                      {format}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Choose Source</span>
              </div>
            </div>

            <div>
              <Label htmlFor="kb-files-select" className="mb-2 block flex items-center"><BookOpen className="h-4 w-4 mr-2" />Select Knowledge Base Files (Ctrl/Cmd + Click)</Label>
              <select
                id="kb-files-select"
                multiple
                value={selectedKbFileIds}
                onChange={handleKbFileSelectionChange}
                className="w-full p-2 border rounded-md min-h-[150px] bg-background focus:ring-primary focus:border-primary"
                disabled={!isClient || !selectedProduct || knowledgeBaseFiles.filter(f => f.product === selectedProduct).length === 0 || isLoading}
              >
                {!isClient && <option disabled>Loading files...</option>}
                {isClient && (!selectedProduct || knowledgeBaseFiles.filter(f => f.product === selectedProduct).length === 0) && <option disabled>No files in knowledge base for selected product.</option>}
                {isClient && selectedProduct && knowledgeBaseFiles.filter(f => f.product === selectedProduct).map(file => (
                  <option key={file.id} value={file.id}>
                    {file.isTextEntry ? `(Text) ${file.name.substring(0, 50)}...` : `(File) ${file.name}`}
                  </option>
                ))}
              </select>
              {selectedKbFileIds.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{selectedKbFileIds.length} file(s) selected.</p>
              )}
            </div>

            <Button
              onClick={() => handleGenerateDeck(false)}
              className="w-full"
              disabled={isLoading || !isClient || selectedKbFileIds.length === 0 || !selectedProduct || !selectedFormat}
            >
              <FileText className="mr-2 h-4 w-4" /> Generate from Selected Files
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <Button
              onClick={() => handleGenerateDeck(true)}
              variant="outline"
              className="w-full"
              disabled={isLoading || !isClient || !selectedProduct || knowledgeBaseFiles.filter(f => f.product === selectedProduct).length === 0 || !selectedFormat}
            >
              <UploadCloud className="mr-2 h-4 w-4" /> Generate from Entire KB for {selectedProduct || 'Product'}
            </Button>

          </CardContent>
        </Card>

        {isLoading && (
            <div className="mt-8 flex flex-col items-center gap-2">
                <LoadingSpinner size={32} />
                <p className="text-muted-foreground">Generating training deck, this may take a moment...</p>
            </div>
        )}

        {error && !isLoading && (
          <UiAlert variant="destructive" className="mt-8 max-w-2xl w-full">
            <InfoIcon className="h-4 w-4" /> {/* Local InfoIcon */}
            <AlertDescription>{error}</AlertDescription>
          </UiAlert>
        )}

        {generatedDeck && !isLoading && (
          <Card className="w-full max-w-3xl shadow-xl mt-8">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                    <CardTitle className="text-xl text-primary">{generatedDeck.deckTitle}</CardTitle>
                    <CardDescription>Generated for: {selectedProduct}, Format Hint: {selectedFormat}</CardDescription>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleCopyToClipboard(generatedDeck)}>
                        <Copy className="mr-2 h-4 w-4" /> Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExportDeck(generatedDeck, selectedFormat)}>
                        <Download className="mr-2 h-4 w-4" /> Download
                    </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[50vh] border rounded-md p-4 bg-muted/20">
                <div className="space-y-6">
                  {generatedDeck.slides.map((slide, index) => (
                    <div key={index} className="pb-4 mb-4 border-b last:border-b-0">
                      <h4 className="font-semibold text-lg mb-2 text-foreground">Slide {index + 1}: {slide.title}</h4>
                      <p className="text-muted-foreground whitespace-pre-line">{slide.content}</p>
                      {slide.notes && (
                        <div className="mt-2 p-2 bg-accent/10 rounded-md">
                            <p className="text-xs font-semibold text-accent-foreground/80">Speaker Notes:</p>
                            <p className="text-xs text-accent-foreground/70 whitespace-pre-line">{slide.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {!generatedDeck && !isLoading && !error && (
           <Card className="w-full max-w-2xl shadow-lg">
            <CardHeader>
                <CardTitle className="text-lg flex items-center">
                    <InfoIcon className="h-5 w-5 mr-2 text-accent"/> {/* Local InfoIcon */}
                    How it Works
                </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                    This feature uses AI to generate a structured training deck. The AI considers the selected Product
                    and items from your Knowledge Base (text from 'Text Entries' and file names from 'File Uploads' associated with the selected product) as context.
                </p>
                <p>
                    Select the Product, desired Output Format (PDF, Word Doc, or PPT), and either specific Knowledge Base files
                    (filtered by the selected product) or choose to generate from the entire Knowledge Base for that product.
                </p>
                <p className="font-semibold">
                    Output: A PDF will be generated directly. "Word Doc" and "PPT" formats will download structured text files
                    with the .doc or .ppt extension respectively. Open these text files (you might need to rename to .txt to open easily) and copy the content into Word or PowerPoint to create your slides.
                </p>
            </CardContent>
        </Card>
        )}

      </main>
    </div>
  );
}

// Local InfoIcon component as lucide-react does not have a direct 'Info' icon usually used like this.
function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}


    

    