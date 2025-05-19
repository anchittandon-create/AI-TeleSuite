
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

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "text/csv",
  "audio/mpeg", // .mp3
  "audio/mp4", // .m4a, .mp4 audio
  "audio/x-m4r", 
  "audio/wav", // .wav
  "audio/ogg", // .ogg
  "audio/webm", // .webm
  "text/plain", // .txt
];

const FormSchema = z.object({
  knowledgeFiles: z // Changed from 'file' to 'knowledgeFiles' for clarity and to avoid conflict
    .custom<FileList>((val) => val instanceof FileList && val.length > 0, "At least one file is required.")
    .refine((fileList) => {
      if (!fileList) return true; // Allow empty if not required / handle by first rule
      for (let i = 0; i < fileList.length; i++) {
        if (fileList[i].size > MAX_FILE_SIZE) return false;
      }
      return true;
    }, `Max file size is 5MB per file.`)
    .refine(
      (fileList) => {
        if (!fileList) return true; // Allow empty if not required / handle by first rule
        for (let i = 0; i < fileList.length; i++) {
          if (!ALLOWED_FILE_TYPES.includes(fileList[i].type)) return false;
        }
        return true;
      },
      "Unsupported file type. Allowed: .pdf, .docx, .csv, .txt, .mp3, .m4a, .mp4, .wav, .ogg, .webm, .m4r"
    ),
  product: z.enum(PRODUCTS).optional(),
  persona: z.enum(CUSTOMER_COHORTS).optional(),
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
  });

  const handleSubmit = async (data: KnowledgeBaseFormValues) => {
    setIsLoading(true);
    const uploadedFilesInfo: Array<Omit<KnowledgeFile, 'id' | 'uploadDate'>> = [];

    if (data.knowledgeFiles) {
      for (let i = 0; i < data.knowledgeFiles.length; i++) {
        const file = data.knowledgeFiles[i];
        
        // Simulate file processing/upload for each file
        // In a real app, this would be the actual upload call
        await new Promise(resolve => setTimeout(resolve, 100)); // Shorter timeout for UI feedback

        const fileData = {
          name: file.name,
          type: file.type,
          size: file.size,
          product: data.product,
          persona: data.persona,
        };
        onFileUpload(fileData); // Call existing onFileUpload for each file
        uploadedFilesInfo.push(fileData);
      }
    }

    if (uploadedFilesInfo.length > 0) {
      toast({
        title: `${uploadedFilesInfo.length} File(s) Uploaded`,
        description: `${uploadedFilesInfo.map(f => f.name).join(', ')} ${uploadedFilesInfo.length > 1 ? 'have' : 'has'} been successfully added.`,
      });
    } else {
       toast({
        title: "No Files Selected",
        description: "Please select files to upload.",
        variant: "default" 
      });
    }
    
    form.reset({ knowledgeFiles: undefined, product: data.product, persona: data.persona });
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
              name="knowledgeFiles"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Upload File(s)</FormLabel>
                  <FormControl>
                    <Input 
                      type="file" 
                      multiple // Allow multiple file selection
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
            <FormField
              control={form.control}
              name="product"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Associated Product (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a product" />
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
              {isLoading ? "Uploading..." : "Upload File(s)"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
