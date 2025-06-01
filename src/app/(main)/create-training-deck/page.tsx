
"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useKnowledgeBase, KnowledgeFile } from "@/hooks/use-knowledge-base";
import { useState, useMemo, useEffect, ChangeEvent } from "react";
import { BookOpen, FileText, UploadCloud, Settings2, FileType2, Briefcase, Download, Copy, LayoutList, InfoIcon as InfoIconLucide, FileUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PRODUCTS, Product } from "@/types";
import { generateTrainingDeck } from "@/ai/flows/training-deck-generator";
import type { GenerateTrainingDeckInput, GenerateTrainingDeckOutput, KnowledgeBaseItemSchema as FlowKnowledgeBaseItemSchema } from "@/ai/flows/training-deck-generator";
import { useActivityLogger } from "@/hooks/use-activity-logger";
import { exportTextContentToPdf } from "@/lib/pdf-utils";
import { exportToTxt } from "@/lib/export";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { Alert as UiAlert, AlertDescription as UiAlertDescription } from "@/components/ui/alert";
import type { z } from "zod";
import { fileToDataUrl } from '@/lib/file-utils'; // For reading text content from uploads


type DeckFormat = "PDF" | "Word Doc" | "PPT" | "Brochure";
const DECK_FORMATS: DeckFormat[] = ["PDF", "Word Doc", "PPT", "Brochure"];

const MAX_DIRECT_UPLOAD_SIZE_TEXT = 50000; // 50KB limit for trying to read text content from direct uploads for context
const MAX_TOTAL_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB total for all uploaded files

export default function CreateTrainingDeckPage() {
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const [selectedKbFileIds, setSelectedKbFileIds] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(undefined);
  const [selectedFormat, setSelectedFormat] = useState<DeckFormat | undefined>(DECK_FORMATS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedMaterial, setGeneratedMaterial] = useState<GenerateTrainingDeckOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const [isClient, setIsClient] = useState(false);
  const [directUploadFiles, setDirectUploadFiles] = useState<File[]>([]);
  const directUploadInputRef = React.useRef<HTMLInputElement>(null);


  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    setSelectedKbFileIds(prevSelectedIds => {
      const availableFileIds = new Set(knowledgeBaseFiles.map(f => f.id));
      return prevSelectedIds.filter(id => availableFileIds.has(id));
    });
  }, [knowledgeBaseFiles]);

  const selectedKnowledgeBaseItems = useMemo(() => {
    return knowledgeBaseFiles.filter(file => selectedKbFileIds.includes(file.id));
  }, [knowledgeBaseFiles, selectedKbFileIds]);

  const mapKbFilesToFlowItems = (items: KnowledgeFile[]): Array<z.infer<typeof FlowKnowledgeBaseItemSchema>> => {
    return items.map(item => ({
        name: item.name,
        textContent: item.isTextEntry ? item.textContent : undefined, // Only text content from KB text entries
        isTextEntry: !!item.isTextEntry,
        fileType: item.isTextEntry ? 'text/plain' : item.type,
    }));
  };

  const mapDirectUploadsToFlowItems = async (uploads: File[]): Promise<Array<z.infer<typeof FlowKnowledgeBaseItemSchema>>> => {
    const flowItems: Array<z.infer<typeof FlowKnowledgeBaseItemSchema>> = [];
    for (const file of uploads) {
        let textContent: string | undefined = undefined;
        // Attempt to read text content for small text-based files
        if (file.type.startsWith('text/') && file.size < MAX_DIRECT_UPLOAD_SIZE_TEXT) {
            try {
                textContent = await file.text();
            } catch (e) {
                console.warn(`Could not read text content for uploaded file ${file.name}`, e);
            }
        }
        flowItems.push({
            name: file.name,
            textContent: textContent, // Pass content if read, otherwise AI uses name/type
            isTextEntry: false, // These are direct file uploads, not KB text entries
            fileType: file.type,
        });
    }
    return flowItems;
  };

  const handleGenerateMaterial = async (source: "selected_kb" | "entire_kb" | "direct_uploads") => {
    setIsLoading(true);
    setGeneratedMaterial(null);
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

    let itemsToProcessForFlow: Array<z.infer<typeof FlowKnowledgeBaseItemSchema>> = [];
    let generateFromAllKbFlag = false;
    let sourceDescription = "";

    if (source === "direct_uploads") {
      if (directUploadFiles.length === 0) {
        toast({ variant: "destructive", title: "No Files Uploaded", description: "Please upload files to generate material from." });
        setIsLoading(false);
        return;
      }
      itemsToProcessForFlow = await mapDirectUploadsToFlowItems(directUploadFiles);
      sourceDescription = `${directUploadFiles.length} uploaded file(s)`;
    } else if (source === "selected_kb") {
      if (selectedKnowledgeBaseItems.length === 0) {
        toast({ variant: "destructive", title: "No KB Files Selected", description: "Please select files from the Knowledge Base." });
        setIsLoading(false);
        return;
      }
      itemsToProcessForFlow = mapKbFilesToFlowItems(selectedKnowledgeBaseItems);
      sourceDescription = `${selectedKnowledgeBaseItems.length} selected KB item(s)`;
    } else if (source === "entire_kb") {
      const kbForProduct = knowledgeBaseFiles.filter(f => f.product === selectedProduct);
      if (kbForProduct.length === 0) {
        toast({ variant: "destructive", title: "KB Empty for Product", description: `Knowledge Base is empty for ${selectedProduct}.` });
        setIsLoading(false);
        return;
      }
      itemsToProcessForFlow = mapKbFilesToFlowItems(kbForProduct);
      generateFromAllKbFlag = true;
      sourceDescription = `Entire KB for ${selectedProduct}`;
    }

    const flowInput: GenerateTrainingDeckInput = {
      product: selectedProduct,
      deckFormatHint: selectedFormat,
      knowledgeBaseItems: itemsToProcessForFlow,
      generateFromAllKb: generateFromAllKbFlag,
      sourceDescriptionForAi: sourceDescription, // New field for AI context
    };

    try {
      const result = await generateTrainingDeck(flowInput);
      const materialType = selectedFormat === "Brochure" ? "Brochure" : "Deck";
      if (result.deckTitle.startsWith("Error Generating")) {
        setError(result.sections[0]?.content || `AI failed to generate ${materialType.toLowerCase()} content.`);
        setGeneratedMaterial(null);
        toast({ variant: "destructive", title: `${materialType} Generation Failed`, description: result.sections[0]?.content || `AI reported an error.` });
      } else {
        setGeneratedMaterial(result);
        toast({ title: `Training ${materialType} Generated!`, description: `${materialType} for ${selectedProduct} is ready.` });
      }
      logActivity({
        module: "Create Training Material",
        product: selectedProduct,
        details: {
          output: result, // Log full output
          input: flowInput // Log full input for traceability
        }
      });
    } catch (e) {
      console.error("Error generating training material:", e);
      const errorMessage = e instanceof Error ? e.message : "An unexpected AI error occurred.";
      setError(errorMessage);
      const materialType = selectedFormat === "Brochure" ? "Brochure" : "Deck";
      toast({ variant: "destructive", title: `${materialType} Generation Failed`, description: errorMessage });
       logActivity({
          module: "Create Training Material",
          product: selectedProduct,
          details: {
            error: errorMessage,
            input: flowInput
          }
        });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDirectFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files);
      let totalSize = 0;
      for (const file of fileArray) {
        totalSize += file.size;
      }
      if (totalSize > MAX_TOTAL_UPLOAD_SIZE) {
        toast({
          variant: "destructive",
          title: "Upload Limit Exceeded",
          description: `Total size of selected files exceeds ${MAX_TOTAL_UPLOAD_SIZE / (1024*1024)}MB. Please select fewer or smaller files.`,
        });
        setDirectUploadFiles([]);
        if (directUploadInputRef.current) directUploadInputRef.current.value = "";
        return;
      }
      setDirectUploadFiles(fileArray);
    } else {
      setDirectUploadFiles([]);
    }
  };


  const formatMaterialForTextExport = (material: GenerateTrainingDeckOutput, format: DeckFormat): string => {
    const materialType = format === "Brochure" ? "Brochure" : "Deck";
    let output = `${materialType}: ${material.deckTitle}\n`;
    output += `Product: ${selectedProduct}\n`;
    output += `Format: ${format}\n\n`;

    material.sections.forEach((section, index) => {
      output += `--------------------------------------------------\n`;
      output += `${format === "Brochure" ? "Section/Panel" : "Slide"} ${index + 1}: ${section.title}\n`;
      output += `--------------------------------------------------\n`;
      output += `${section.content}\n\n`;
      if (section.notes) {
        output += `${format === "Brochure" ? "Internal Notes/Suggestions" : "Speaker Notes"}:\n${section.notes}\n\n`;
      }
    });
    return output;
  };

  const handleExportMaterial = (material: GenerateTrainingDeckOutput | null, format: DeckFormat | undefined) => {
    if (!material || !format || !selectedProduct) return;

    const materialType = format === "Brochure" ? "Brochure" : "Deck";
    const filenameBase = `Training_${materialType}_${selectedProduct.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`;
    let exportFilename = "";
    const textContent = formatMaterialForTextExport(material, format);

    if (format === "PDF") {
      exportFilename = `${filenameBase}.pdf`;
      exportTextContentToPdf(textContent, exportFilename);
      toast({ title: "PDF Exported", description: `${exportFilename} has been downloaded.` });
    } else { // Word Doc, PPT, Brochure (as text outline)
      const extension = (format === "Word Doc" || format === "PPT") ? ".doc" : ".txt";
      exportFilename = `${filenameBase}${extension}`;
      exportToTxt(exportFilename, textContent);
      const userAction = format === "Brochure"
        ? "Open it and copy the content into your brochure design software."
        : `Open it and copy the content into ${format}. You may need to rename the extension to .txt to open easily if .doc doesn't open as plain text.`;
      toast({ title: `${format} Text Outline Downloaded`, description: `${exportFilename} is a text file. ${userAction}` });
    }
  };

  const handleCopyToClipboard = (material: GenerateTrainingDeckOutput | null) => {
    if (!material || !selectedProduct || !selectedFormat) return;
    const textContent = formatMaterialForTextExport(material, selectedFormat);
    navigator.clipboard.writeText(textContent)
      .then(() => toast({ title: "Success", description: "Material content copied to clipboard!" }))
      .catch(_ => toast({ variant: "destructive", title: "Error", description: "Failed to copy material content." }));
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

  const materialTypeDisplay = selectedFormat === "Brochure" ? "Brochure" : "Deck";
  
  const canGenerateFromSelectedKb = isClient && selectedKbFileIds.length > 0 && selectedProduct && selectedFormat;
  const canGenerateFromEntireKb = isClient && selectedProduct && selectedFormat && knowledgeBaseFiles.filter(f => f.product === selectedProduct).length > 0;
  const canGenerateFromDirectUploads = isClient && directUploadFiles.length > 0 && selectedProduct && selectedFormat;


  return (
    <div className="flex flex-col h-full">
      <PageHeader title={`Create Training ${materialTypeDisplay}`} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 flex flex-col items-center">
        <Card className="w-full max-w-2xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl text-primary flex items-center">
              <Settings2 className="h-6 w-6 mr-3" />
              Configure Training {materialTypeDisplay}
            </CardTitle>
            <CardDescription>
              Select product, format, and source context. You can use files already in your Knowledge Base (managed on the "Knowledge Base Management" page)
              or directly upload files for this specific generation. The AI uses file names and, for text entries from the KB or small text uploads, their content as context.
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
                  <SelectValue placeholder="Select Output Format" />
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
                <span className="bg-card px-2 text-muted-foreground">Choose Source Context</span>
              </div>
            </div>
            
            {/* Direct File Upload Section */}
            <div>
              <Label htmlFor="direct-upload-files" className="mb-2 block flex items-center"><FileUp className="h-4 w-4 mr-2" />Directly Upload Files (for this generation)</Label>
              <Input
                id="direct-upload-files"
                type="file"
                multiple
                ref={directUploadInputRef}
                onChange={handleDirectFileChange}
                className="pt-1.5"
                disabled={isLoading}
              />
               {directUploadFiles.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{directUploadFiles.length} file(s) selected for direct upload. Total size: {(directUploadFiles.reduce((acc, file) => acc + file.size, 0) / (1024*1024)).toFixed(2)} MB.</p>
              )}
               <p className="text-xs text-muted-foreground mt-1">Max total upload size: {MAX_TOTAL_UPLOAD_SIZE / (1024*1024)}MB. PDF, DOCX, TXT, CSV etc.</p>
              <Button
                onClick={() => handleGenerateMaterial("direct_uploads")}
                className="w-full mt-3"
                disabled={isLoading || !canGenerateFromDirectUploads}
              >
                <UploadCloud className="mr-2 h-4 w-4" /> Generate from Uploaded Files
              </Button>
            </div>
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or Use Existing Knowledge Base</span>
              </div>
            </div>

            <div>
              <Label htmlFor="kb-files-select" className="mb-2 block flex items-center"><BookOpen className="h-4 w-4 mr-2" />Select Files from Knowledge Base</Label>
              <p className="text-xs text-muted-foreground mb-1">Use Ctrl/Cmd + Click to select multiple files. Filtered by selected product. View/manage KB on "Knowledge Base Management" page.</p>
              <select
                id="kb-files-select"
                multiple
                value={selectedKbFileIds}
                onChange={handleKbFileSelectionChange}
                className="w-full p-2 border rounded-md min-h-[100px] bg-background focus:ring-primary focus:border-primary"
                disabled={!isClient || !selectedProduct || knowledgeBaseFiles.filter(f => f.product === selectedProduct).length === 0 || isLoading}
              >
                {!isClient && <option disabled>Loading files...</option>}
                {isClient && (!selectedProduct || knowledgeBaseFiles.filter(f => f.product === selectedProduct).length === 0) && <option disabled>No files in knowledge base for selected product.</option>}
                {isClient && selectedProduct && knowledgeBaseFiles.filter(f => f.product === selectedProduct).length > 0 && knowledgeBaseFiles.filter(f => f.product === selectedProduct).map(file => (
                  <option key={file.id} value={file.id}>
                    {file.isTextEntry ? `(Text) ${file.name.substring(0, 50)}...` : `(File) ${file.name}`}
                  </option>
                ))}
              </select>
              {selectedKbFileIds.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{selectedKbFileIds.length} KB file(s) selected.</p>
              )}
            </div>

            <Button
              onClick={() => handleGenerateMaterial("selected_kb")}
              className="w-full"
              disabled={isLoading || !canGenerateFromSelectedKb}
            >
              <FileText className="mr-2 h-4 w-4" /> Generate from Selected KB Files
            </Button>

            <Button
              onClick={() => handleGenerateMaterial("entire_kb")}
              variant="outline"
              className="w-full"
              disabled={isLoading || !canGenerateFromEntireKb}
            >
              <BookOpen className="mr-2 h-4 w-4" /> Generate from Existing Knowledge Base for {selectedProduct || 'Product'}
            </Button>

          </CardContent>
        </Card>

        {isLoading && (
            <div className="mt-8 flex flex-col items-center gap-2">
                <LoadingSpinner size={32} />
                <p className="text-muted-foreground">Generating training {materialTypeDisplay.toLowerCase()}, this may take a moment...</p>
            </div>
        )}

        {error && !isLoading && (
          <UiAlert variant="destructive" className="mt-8 max-w-2xl w-full">
            <InfoIconLucide className="h-4 w-4" />
            <UiAlertDescription>{error}</UiAlertDescription>
          </UiAlert>
        )}

        {generatedMaterial && !isLoading && (
          <Card className="w-full max-w-3xl shadow-xl mt-8">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                    <CardTitle className="text-xl text-primary flex items-center">
                       {selectedFormat === "Brochure" ? <LayoutList className="mr-2 h-5 w-5"/> : <BookOpen className="mr-2 h-5 w-5"/>}
                       {generatedMaterial.deckTitle}
                    </CardTitle>
                    <CardDescription>Generated for: {selectedProduct}, Format: {selectedFormat}</CardDescription>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleCopyToClipboard(generatedMaterial)}>
                        <Copy className="mr-2 h-4 w-4" /> Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExportMaterial(generatedMaterial, selectedFormat)}>
                        <Download className="mr-2 h-4 w-4" /> Download
                    </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[50vh] border rounded-md p-4 bg-muted/20">
                <div className="space-y-6">
                  {generatedMaterial.sections.map((section, index) => (
                    <div key={index} className="pb-4 mb-4 border-b last:border-b-0">
                      <h4 className="font-semibold text-lg mb-2 text-foreground">
                        {selectedFormat === "Brochure" ? "Section/Panel" : "Slide"} {index + 1}: {section.title}
                      </h4>
                      <p className="text-muted-foreground whitespace-pre-line">{section.content}</p>
                      {section.notes && (
                        <div className="mt-2 p-2 bg-accent/10 rounded-md">
                            <p className="text-xs font-semibold text-accent-foreground/80">
                                {selectedFormat === "Brochure" ? "Internal Notes/Suggestions" : "Speaker Notes"}:
                            </p>
                            <p className="text-xs text-accent-foreground/70 whitespace-pre-line">{section.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {!generatedMaterial && !isLoading && !error && (
           <Card className="w-full max-w-2xl shadow-lg">
            <CardHeader>
                <CardTitle className="text-lg flex items-center">
                    <InfoIconLucide className="h-5 w-5 mr-2 text-accent"/>
                    How it Works
                </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                    This feature uses AI to generate a structured training {materialTypeDisplay.toLowerCase()}. You can provide context in three ways:
                </p>
                <ol className="list-decimal list-inside space-y-1 pl-4">
                    <li><strong>Directly Upload Files:</strong> Upload files (PDF, DOCX, TXT, CSV, etc.) specifically for this generation. The AI will use their names and types as primary context. For small text files, it may also consider their content.</li>
                    <li><strong>Select Files from Knowledge Base:</strong> Choose specific files or text entries already in your central Knowledge Base.</li>
                    <li><strong>Use Existing Knowledge Base for Product:</strong> The AI will use all files and text entries from your Knowledge Base associated with the selected product.</li>
                </ol>
                 <p className="font-semibold mt-2">
                    Output: For "PDF" format, a text-based PDF outline will be generated. For "Word Doc", "PPT", and "Brochure" formats, structured text outlines will be downloaded (as .doc or .txt files). Open these files (you might need to rename to .txt to open them easily if .doc does not open as plain text) and copy the content into the appropriate software to create your final document. The AI does not generate fully designed graphical documents.
                </p>
            </CardContent>
        </Card>
        )}
      </main>
    </div>
  );
}
