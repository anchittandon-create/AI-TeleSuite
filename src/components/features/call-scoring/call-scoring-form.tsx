
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import React from "react";
import { PRODUCTS, Product } from "@/types"; // Uses updated PRODUCTS
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";

const MAX_AUDIO_FILE_SIZE = 100 * 1024 * 1024; // Increased to 100MB
const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg", 
  "audio/wav", 
  "audio/mp4", 
  "audio/x-m4a", 
  "audio/ogg", 
  "audio/webm", 
  "audio/aac", 
  "audio/flac", 
];

const CallScoringFormSchema = z.object({
  audioFile: z
    .custom<FileList>((val) => val instanceof FileList && val.length > 0, "At least one audio file is required.")
    .refine((fileList) => {
      if (!fileList) return true;
      for (let i = 0; i < fileList.length; i++) {
        if (fileList[i].size > MAX_AUDIO_FILE_SIZE) return false;
      }
      return true;
    }, `Max file size is ${MAX_AUDIO_FILE_SIZE / (1024*1024)}MB per file.`)
    .refine(
      (fileList) => {
        if (!fileList) return true;
        for (let i = 0; i < fileList.length; i++) {
          if (!ALLOWED_AUDIO_TYPES.includes(fileList[i].type)) return false;
        }
        return true;
      },
      "Unsupported audio type. Allowed: MP3, WAV, M4A, OGG, WEBM, AAC, FLAC. One or more files have an unsupported type."
    ),
  product: z.enum(PRODUCTS, { required_error: "Product selection (ET or TOI) is required." }), // Updated error message
  agentName: z.string().optional(),
});

export type CallScoringFormValues = z.infer<typeof CallScoringFormSchema>;

interface CallScoringFormProps {
  onSubmit: (data: CallScoringFormValues) => Promise<void>;
  isLoading: boolean;
  submitButtonText?: string;
  formTitle?: string;
  selectedFileCount: number;
}

export function CallScoringForm({ 
    onSubmit, 
    isLoading, 
    submitButtonText = "Score Call",
    formTitle = "Score Call Recording(s)",
    selectedFileCount
}: CallScoringFormProps) {
  const audioFileInputRef = React.useRef<HTMLInputElement>(null);
  const form = useForm<CallScoringFormValues>({
    resolver: zodResolver(CallScoringFormSchema),
    defaultValues: {
      agentName: "",
      product: undefined, // Ensure it's undefined initially to show placeholder
    },
  });

  const handleSubmit = (data: CallScoringFormValues) => {
    onSubmit(data);
  };

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">{formTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="audioFile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Upload Audio File(s)</FormLabel>
                  <FormControl>
                    <Input 
                      type="file" 
                      accept={ALLOWED_AUDIO_TYPES.join(",")}
                      ref={audioFileInputRef}
                      multiple 
                      onChange={(e) => field.onChange(e.target.files)} 
                      className="pt-1.5"
                    />
                  </FormControl>
                  <FormDescription>
                    Supported: MP3, WAV, M4A, OGG, etc. (Max {MAX_AUDIO_FILE_SIZE / (1024*1024)}MB per file).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Alert variant="default" className="mt-2">
                <InfoIcon className="h-4 w-4" />
                <AlertTitle>Processing Time & Limits</AlertTitle>
                <AlertDescription>
                  Longer audio files (&gt;15-20 min or &gt;20MB) may cause delays or AI model errors. Shorter segments recommended.
                </AlertDescription>
            </Alert>
            <FormField
              control={form.control}
              name="product"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Focus <span className="text-destructive">*</span></FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value} // Controlled component
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product (ET / TOI)" /> {/* Updated placeholder */}
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
                  <FormDescription>
                    Select the primary product discussed. This is compulsory for scoring.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="agentName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agent Name (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter agent name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? `Scoring ${selectedFileCount > 0 ? selectedFileCount + ' files...' : 'files...'}` : `${submitButtonText}${selectedFileCount > 1 ? ` (${selectedFileCount} Files)` : ''}`}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
