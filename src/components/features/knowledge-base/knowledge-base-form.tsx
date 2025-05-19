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

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "text/csv",
  "audio/mpeg", // .mp3
  "audio/mp4", // .m4a, .mp4 audio
  "audio/x-m4r", // .m4r - this MIME type might vary, adjust if needed
];

const FormSchema = z.object({
  file: z
    .custom<FileList>((val) => val instanceof FileList && val.length > 0, "File is required.")
    .refine((files) => files?.[0]?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
    .refine(
      (files) => ALLOWED_FILE_TYPES.includes(files?.[0]?.type),
      "Unsupported file type. Allowed: .pdf, .docx, .csv, .mp3, .mp4, .m4r"
    ),
  product: z.enum(PRODUCTS).optional(),
  persona: z.enum(CUSTOMER_COHORTS).optional(),
});

interface KnowledgeBaseFormProps {
  onFileUpload: (fileData: Omit<KnowledgeFile, 'id' | 'uploadDate'>) => void;
}

export function KnowledgeBaseForm({ onFileUpload }: KnowledgeBaseFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
  });

  const handleSubmit = async (data: z.infer<typeof FormSchema>) => {
    setIsLoading(true);
    const file = data.file[0];
    
    // Simulate file processing/upload
    await new Promise(resolve => setTimeout(resolve, 1000));

    onFileUpload({
      name: file.name,
      type: file.type,
      size: file.size,
      product: data.product,
      persona: data.persona,
    });

    toast({
      title: "File Uploaded",
      description: `${file.name} has been successfully added to the knowledge base.`,
    });
    
    form.reset();
    if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Clear the file input
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
              name="file"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Upload File</FormLabel>
                  <FormControl>
                    <Input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={(e) => field.onChange(e.target.files)} 
                      className="pt-1.5" // Adjust padding for better alignment
                    />
                  </FormControl>
                  <FormDescription>
                    Supported: .docx, .pdf, .csv, .mp3, .m4r, .mp4 (Max 5MB)
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
              {isLoading ? "Uploading..." : "Upload File"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
