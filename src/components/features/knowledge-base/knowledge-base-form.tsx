
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
import { CustomerCohort, KnowledgeFile } from "@/types";
import { useToast } from "@/hooks/use-toast";
import React, { useState } from "react";
import { FileUp, Type } from "lucide-react";
import { useProductContext } from "@/hooks/useProductContext";

const PREDEFINED_CATEGORIES = ["General", "Pricing", "Product Description", "Rebuttals", "Pitch"];

// This is just for client-side validation to prevent users from selecting massive files,
// not a technical limit for what can be handled by the logic anymore.
const MAX_FILE_SIZE = 50 * 1024 * 1024; 

const FormSchema = z.object({
  product: z.string().min(1, "Product must be selected."),
  persona: z.string().optional(),
  category: z.string().optional(),
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

// The form now passes raw File objects or text content up to the parent.
export type RawKnowledgeEntry = {
    product: string;
    persona?: CustomerCohort;
    category?: string;
    isTextEntry: false;
    file: File;
}
export type RawTextKnowledgeEntry = {
    product: string;
    persona?: CustomerCohort;
    category?: string;
    isTextEntry: true;
    name: string;
    textContent: string;
}

interface KnowledgeBaseFormProps {
  onSingleEntrySubmit: (entry: RawTextKnowledgeEntry) => Promise<void>;
  onMultipleFilesSubmit: (entries: RawKnowledgeEntry[]) => Promise<void>;
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
      textEntryName: "",
      category: "General",
    }
  });

  const entryType = form.watch("entryType");

  const handleSubmit = async (data: KnowledgeBaseFormValues) => {
    setIsLoading(true);
    
    if (data.entryType === "file" && data.knowledgeFiles && data.knowledgeFiles.length > 0) {
      const filesToUpload: RawKnowledgeEntry[] = Array.from(data.knowledgeFiles).map(file => ({
        file: file,
        product: data.product!,
        persona: data.persona as CustomerCohort,
        category: data.category,
        isTextEntry: false,
      }));
      
      await onMultipleFilesSubmit(filesToUpload);

      toast({
        title: `${filesToUpload.length} File(s) Submitted`,
        description: `Metadata for ${filesToUpload.map(f => f.file.name).join(', ')} has been saved.`,
      });

    } else if (data.entryType === "text" && data.textContent && data.textEntryName) {
      await onSingleEntrySubmit({
        name: data.textEntryName, 
        textContent: data.textContent,
        product: data.product!,
        persona: data.persona as CustomerCohort,
        category: data.category,
        isTextEntry: true,
      });

      toast({
        title: `Text Entry Added`,
        description: `"${data.textEntryName}" has been added to the knowledge base.`,
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
        category: data.category,
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="product"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a product" />
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
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PREDEFINED_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
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
                      The application will store file metadata (name, type, size) to use as context. File content is not stored in your browser to avoid storage quota errors.
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
              {isLoading ? "Adding..." : entryType === "file" ? "Add File Metadata to KB" : "Add Text Entry"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
