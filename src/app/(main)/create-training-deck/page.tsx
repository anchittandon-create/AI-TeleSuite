
"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useKnowledgeBase } from "@/hooks/use-knowledge-base";
import { useState } from "react";
import { BookOpen, FileText, UploadCloud, Settings2, FileType2, Briefcase } from "lucide-react"; // Added new icons
import { useToast } from "@/hooks/use-toast";
import { PRODUCTS, Product } from "@/types"; // Import PRODUCTS and Product type

// Define deck format types
type DeckFormat = "PDF" | "Word Doc" | "PPT";
const DECK_FORMATS: DeckFormat[] = ["PDF", "Word Doc", "PPT"];

export default function CreateTrainingDeckPage() {
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const [selectedKbFileIds, setSelectedKbFileIds] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(undefined);
  const [selectedFormat, setSelectedFormat] = useState<DeckFormat | undefined>(DECK_FORMATS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerateDeck = async (fromFullKb: boolean = false) => {
    setIsLoading(true);

    if (!selectedProduct) {
      toast({
        variant: "destructive",
        title: "Product Not Selected",
        description: "Please select a product (ET or TOI) for the training deck.",
      });
      setIsLoading(false);
      return;
    }

    if (!selectedFormat) {
        toast({
            variant: "destructive",
            title: "Format Not Selected",
            description: "Please select an output format for the training deck.",
        });
        setIsLoading(false);
        return;
    }

    if (!fromFullKb && selectedKbFileIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No Files Selected",
        description: "Please select files from the knowledge base to create a deck, or choose to generate from the entire KB.",
      });
      setIsLoading(false);
      return;
    }
    
    // Placeholder for AI deck generation logic
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate AI processing

    const source = fromFullKb ? "the entire knowledge base" : `${selectedKbFileIds.length} selected file(s)`;
    
    console.log(`Generating training deck for product: ${selectedProduct}, format: ${selectedFormat}, from ${source}`);
    if (!fromFullKb) {
        console.log("Selected file IDs for deck:", selectedKbFileIds);
    }

    toast({
      title: "Deck Generation Started (Mock)",
      description: `A ${selectedFormat} training deck for ${selectedProduct} from ${source} is being generated. (This is a placeholder).`,
    });
    // TODO: Implement actual AI flow for deck generation and export
    // Example: const deckContent = await generateTrainingDeckFlow({ product: selectedProduct, format: selectedFormat, fileIds: fromFullKb ? knowledgeBaseFiles.map(f=>f.id) : selectedKbFileIds });
    // Example: exportDeck(deckContent, `training_deck_${selectedProduct}.${selectedFormat.toLowerCase().replace(' ', '')}`);
    setIsLoading(false);
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
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Product Selection */}
            <div>
              <Label htmlFor="product-select" className="mb-2 block flex items-center"><Briefcase className="h-4 w-4 mr-2"/>Product</Label>
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

            {/* Deck Format Selection */}
            <div>
              <Label htmlFor="format-select" className="mb-2 block flex items-center"><FileType2 className="h-4 w-4 mr-2"/>Output Format</Label>
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
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Choose Source</span>
              </div>
            </div>

            {/* Knowledge Base File Selection */}
            <div>
              <Label htmlFor="kb-files-select" className="mb-2 block flex items-center"><BookOpen className="h-4 w-4 mr-2"/>Select Knowledge Base Files (Ctrl/Cmd + Click)</Label>
              <select
                id="kb-files-select"
                multiple
                value={selectedKbFileIds}
                onChange={handleKbFileSelectionChange}
                className="w-full p-2 border rounded-md min-h-[150px] bg-background focus:ring-primary focus:border-primary"
                disabled={knowledgeBaseFiles.length === 0}
              >
                {knowledgeBaseFiles.length === 0 && <option disabled>No files in knowledge base.</option>}
                {knowledgeBaseFiles.map(file => (
                  <option key={file.id} value={file.id}>
                    {file.isTextEntry ? `(Text) ${file.name.substring(0,50)}...` : file.name} ({file.product || 'N/A'})
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
              disabled={isLoading || selectedKbFileIds.length === 0 || !selectedProduct || !selectedFormat}
            >
              <FileText className="mr-2 h-4 w-4" /> Generate from Selected Files
            </Button>
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <Button 
              onClick={() => handleGenerateDeck(true)} 
              variant="outline" 
              className="w-full"
              disabled={isLoading || knowledgeBaseFiles.length === 0 || !selectedProduct || !selectedFormat}
            >
              <UploadCloud className="mr-2 h-4 w-4" /> Generate from Entire Knowledge Base
            </Button>
            {isLoading && <p className="text-center text-muted-foreground mt-2">Generating deck...</p>}
          </CardContent>
        </Card>
        
        <Card className="w-full max-w-2xl shadow-lg">
            <CardHeader>
                <CardTitle className="text-lg flex items-center">
                    <InfoIcon className="h-5 w-5 mr-2 text-accent"/>
                    How it Works (Placeholder)
                </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>This feature is currently a placeholder for training deck generation.</p>
                <p>
                    In a future version, the AI will synthesize the content from your selected knowledge base files (or the entire KB)
                    for the chosen Product to create structured training material in your selected Format.
                </p>
                 <p className="font-semibold">For now, selecting files and clicking "Generate" will simulate the start of this process and log your selections.</p>
            </CardContent>
        </Card>

      </main>
    </div>
  );
}

// Placeholder Icon if not available or for specific styling
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

