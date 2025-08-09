
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CUSTOMER_COHORTS, Product, CustomerCohort, KnowledgeFile } from "@/types";
import { useToast } from "@/hooks/use-toast";
import React, { useState } from "react";
import { FileUp, Type } from "lucide-react";
import { useProductContext } from "@/hooks/useProductContext";


const MAX_FILE_SIZE = 50 * 1024 * 1024; // Increased to 50MB per file
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword", // .doc
  "text/csv",
  "text/plain",
  // Common audio types also accepted for general storage, though AI might not process full audio from here
  "audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a", "audio/ogg", "audio/webm", "audio/aac", "audio/flac",
  // Common presentation types
  "application/vnd.ms-powerpoint", // .ppt
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  // Common spreadsheet types
  "application/vnd.ms-excel", // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
];

const FormSchema = z.object({
  product: z.string().min(1, "Product must be selected."),
  persona: z.string().optional(),
  entryType: z.enum(["file", "text"]).default("file"),
  knowledgeFiles: z 
    .custom<FileList>()
    .optional(),
  textContent: z.string().optional(), 
  textEntryName: z.string().optional(), 
})
.superRefine((data, ctx) => {
    if (data.entryType === "file") {
      if (!data.knowledgeFiles || data.knowledgeFiles.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one file is required for file upload.",
          path: ["knowledgeFiles"],
        });
      } else {
        for (let i = 0; i < data.knowledgeFiles.length; i++) {
          if (data.knowledgeFiles[i].size > MAX_FILE_SIZE) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Max file size is ${MAX_FILE_SIZE / (1024*1024)}MB. File "${data.knowledgeFiles[i].name}" is too large.`,
              path: ["knowledgeFiles"],
            });
          }
          // Allow empty type or check against a broader list
          if (data.knowledgeFiles[i].type !== "" && !ALLOWED_FILE_TYPES.includes(data.knowledgeFiles[i].type)) { 
             console.warn(`Potentially unsupported file type for KB: ${data.knowledgeFiles[i].name} (Type: ${data.knowledgeFiles[i].type}). Will be stored, but AI interaction may be limited to name/metadata.`);
             // Not adding an issue, just a warning, as we want to allow storing various files.
          }
        }
      }
    } else if (data.entryType === "text") {
      if (!data.textContent || data.textContent.trim().length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Text content must be at least 10 characters.",
          path: ["textContent"],
        });
      }
       if (!data.textEntryName || data.textEntryName.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A short name/title for the text entry is required (min 3 characters).",
          path: ["textEntryName"],
        });
      }
    }
});

type KnowledgeBaseFormValues = z.infer<typeof FormSchema>;

interface KnowledgeBaseFormProps {
  onSingleEntrySubmit: (fileData: Omit<KnowledgeFile, 'id' | 'uploadDate'>) => void;
  onMultipleFilesSubmit: (filesData: Array<Omit<KnowledgeFile, 'id' | 'uploadDate'>>) => void;
}

export function KnowledgeBaseForm({ onSingleEntrySubmit, onMultipleFilesSubmit }: KnowledgeBaseFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { availableProducts } = useProductContext();

  const form = useForm<KnowledgeBaseFormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      entryType: "file",
      textContent: "",
      textEntryName: ""
    }
  });

  const entryType = form.watch("entryType");

  const handleSubmit = async (data: KnowledgeBaseFormValues) => {
    setIsLoading(true);
    
    if (data.entryType === "file" && data.knowledgeFiles && data.knowledgeFiles.length > 0) {
      const filesToUpload: Array<Omit<KnowledgeFile, 'id' | 'uploadDate'>> = [];
      const uploadedFileNames: string[] = [];

      for (let i = 0; i < data.knowledgeFiles.length; i++) {
        const file = data.knowledgeFiles[i];
        filesToUpload.push({
          name: file.name,
          type: file.type,
          size: file.size,
          product: data.product,
          persona: data.persona as CustomerCohort,
          isTextEntry: false,
        });
        uploadedFileNames.push(file.name);
      }
      onMultipleFilesSubmit(filesToUpload);
      toast({
        title: `${uploadedFileNames.length} File(s) Processed`,
        description: `${uploadedFileNames.join(', ')} submitted to the knowledge base for product '${data.product}'.`,
      });
    } else if (data.entryType === "text" && data.textContent && data.textEntryName) {
      onSingleEntrySubmit({
        name: data.textEntryName, 
        type: "text/plain", 
        size: data.textContent.length,
        product: data.product,
        persona: data.persona as CustomerCohort,
        textContent: data.textContent,
        isTextEntry: true,
      });
      toast({
        title: `Text Entry Added`,
        description: `"${data.textEntryName}" has been added to the knowledge base for product '${data.product}'.`,
      });
    } else {
       toast({
        title: "Upload Error",
        description: "Please ensure you have selected files or entered text according to the form requirements.",
        variant: "destructive" 
      });
      setIsLoading(false);
      return;
    }
    
    form.reset({ 
        product: data.product,
        persona: data.persona,
        entryType: data.entryType, 
        knowledgeFiles: undefined, 
        textContent: "",
        textEntryName: ""
    });
    if (fileInputRef.current) {
        fileInputRef.current.value = ""; 
    }
    setIsLoading(false);
  };

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Update Knowledge Base</CardTitle>
        <CardDescription>Add files or text entries to the knowledge base for a specific product.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="product"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product <span className="text-destructive">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a product for this entry" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableProducts.map((p) => (
                        <SelectItem key={p.name} value={p.name}>
                          {p.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="persona"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Persona/Cohort (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a persona" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CUSTOMER_COHORTS.map((cohort) => (
                        <SelectItem key={cohort} value={cohort}>
                          {cohort}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="entryType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Entry Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex space-x-4"
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="file" />
                        </FormControl>
                        <FormLabel className="font-normal flex items-center"><FileUp className="mr-1.5 h-4 w-4"/> Upload File(s)</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="text" />
                        </FormControl>
                        <FormLabel className="font-normal flex items-center"><Type className="mr-1.5 h-4 w-4"/> Add Text/Prompt</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {entryType === "file" && (
              <FormField
                control={form.control}
                name="knowledgeFiles"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Upload File(s)</FormLabel>
                    <FormControl>
                      <Input 
                        type="file" 
                        multiple
                        ref={fileInputRef}
                        onChange={(e) => field.onChange(e.target.files)} 
                        className="pt-1.5" 
                      />
                    </FormControl>
                    <FormDescription>
                      Max {MAX_FILE_SIZE / (1024*1024)}MB per file. Allowed: PDF, DOCX, CSV, TXT, audio, PPTX, XLSX etc. 
                      AI primarily uses text content from text entries or small text files for generation. Large binary files provide name/type context.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {entryType === "text" && (
              <>
                <FormField
                  control={form.control}
                  name="textEntryName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name/Title for Text Entry</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Key Objection Rebuttals" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="textContent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Text Content / Prompt</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter your text, instructions, or prompt here..."
                          className="resize-y min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                       <FormDescription>
                        Enter the text directly. This can be used for quick notes, standard responses, or AI prompts.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Adding..." : entryType === "file" ? "Upload File(s)" : "Add Text Entry"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
