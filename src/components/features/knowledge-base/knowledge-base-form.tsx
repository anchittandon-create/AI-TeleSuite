
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRODUCTS, CUSTOMER_COHORTS, Product, CustomerCohort, KnowledgeFile } from "@/types";
import { useToast } from "@/hooks/use-toast";
import React, { useState } from "react";
import { FileUp, Type } from "lucide-react";


const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "text/csv",
  "audio/mpeg", "audio/mp4", "audio/x-m4r", "audio/wav", "audio/ogg", "audio/webm",
  "text/plain",
];

const FormSchema = z.object({
  entryType: z.enum(["file", "text"]).default("file"),
  knowledgeFiles: z // For file uploads
    .custom<FileList>()
    .optional(),
  textContent: z.string().optional(), // For direct text input
  product: z.enum(PRODUCTS).optional(),
  persona: z.enum(CUSTOMER_COHORTS).optional(),
  textEntryName: z.string().optional(), // Optional name for text entries
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
              message: `Max file size is 5MB. File "${data.knowledgeFiles[i].name}" is too large.`,
              path: ["knowledgeFiles"],
            });
          }
          if (!ALLOWED_FILE_TYPES.includes(data.knowledgeFiles[i].type) && data.knowledgeFiles[i].type !== "") { // Allow empty type for some edge cases, let hook handle default
             ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Unsupported file type: "${data.knowledgeFiles[i].name}". Allowed: .pdf, .docx, .csv, .txt, audio.`,
              path: ["knowledgeFiles"],
            });
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
  onFileUpload: (fileData: Omit<KnowledgeFile, 'id' | 'uploadDate'>) => void;
}

export function KnowledgeBaseForm({ onFileUpload }: KnowledgeBaseFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
    
    if (data.entryType === "file" && data.knowledgeFiles) {
      const uploadedFileNames: string[] = [];
      for (let i = 0; i < data.knowledgeFiles.length; i++) {
        const file = data.knowledgeFiles[i];
        onFileUpload({
          name: file.name,
          type: file.type,
          size: file.size,
          product: data.product,
          persona: data.persona,
          isTextEntry: false,
        });
        uploadedFileNames.push(file.name);
      }
      toast({
        title: `${uploadedFileNames.length} File(s) Uploaded`,
        description: `${uploadedFileNames.join(', ')} added to the knowledge base.`,
      });
    } else if (data.entryType === "text" && data.textContent && data.textEntryName) {
      onFileUpload({
        name: data.textEntryName, // Use user-provided name
        type: "text/plain", // Default type for text entries
        size: data.textContent.length,
        product: data.product,
        persona: data.persona,
        textContent: data.textContent,
        isTextEntry: true,
      });
      toast({
        title: `Text Entry Added`,
        description: `"${data.textEntryName}" has been added to the knowledge base.`,
      });
    } else {
      // This case should ideally be caught by validation, but as a fallback:
       toast({
        title: "Upload Error",
        description: "Please ensure you have selected files or entered text.",
        variant: "destructive" 
      });
      setIsLoading(false);
      return;
    }
    
    form.reset({ 
        entryType: data.entryType, // Keep current entry type selected
        product: data.product, 
        persona: data.persona,
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
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
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
                      Supported: .pdf, .docx, .csv, .txt, audio files (Max 5MB per file)
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

            <FormField
              control={form.control}
              name="product"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Associated Product (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a product (ET / TOI)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PRODUCTS.map((product) => (
                        <SelectItem key={product} value={product}>
                          {product}
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
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Adding..." : entryType === "file" ? "Upload File(s)" : "Add Text Entry"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

