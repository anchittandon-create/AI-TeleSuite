
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription as UiCardDescription } from "@/components/ui/card";
import React from "react";
import { PRODUCTS, Product } from "@/types";
import { PieChart, InfoIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// This component is no longer used by the page, but is kept for reference or future use.
// The primary page now uses a simpler form to trigger analysis from historical data.

const MAX_AUDIO_FILE_SIZE = 100 * 1024 * 1024; // 100MB per file
const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a", "audio/ogg", "audio/webm", "audio/aac", "audio/flac",
];
const MIN_FILES = 2;
const MAX_FILES = 10; // Arbitrary limit for reasonable AI processing

const CombinedCallAnalysisFormSchema = z.object({
  product: z.enum(PRODUCTS, { required_error: "Product selection (ET or TOI) is required." }),
  audioFiles: z
    .custom<FileList>((val) => val instanceof FileList && val.length > 0, "At least one audio file is required.")
    .refine(fileList => fileList.length >= MIN_FILES, `At least ${MIN_FILES} audio files are required for combined analysis.`)
    .refine(fileList => fileList.length <= MAX_FILES, `A maximum of ${MAX_FILES} audio files can be processed at once for combined analysis.`)
    .refine((fileList) => {
      for (let i = 0; i < fileList.length; i++) {
        if (fileList[i].size > MAX_AUDIO_FILE_SIZE) return false;
      }
      return true;
    }, `Max file size is ${MAX_AUDIO_FILE_SIZE / (1024*1024)}MB per file.`)
    .refine(
      (fileList) => {
        for (let i = 0; i < fileList.length; i++) {
          if (fileList[i].type === "" || ALLOWED_AUDIO_TYPES.includes(fileList[i].type)) {
             // continue
          } else {
            return false;
          }
        }
        return true;
      },
      "One or more files have an unsupported audio type. Allowed: MP3, WAV, M4A, OGG, etc."
    ),
  agentName: z.string().optional().describe("Name of the agent whose calls are being analyzed, or the analyst."),
  overallAnalysisGoal: z.string().max(500, "Analysis goal should be max 500 characters.").optional().describe("Optional: A specific goal or focus for this combined analysis (e.g., 'Identify reasons for low conversion in this batch').")
});

export type CombinedCallAnalysisFormValues = z.infer<typeof CombinedCallAnalysisFormSchema>;

interface CombinedCallAnalysisFormProps {
  onSubmit: (data: CombinedCallAnalysisFormValues) => Promise<void>;
  isLoading: boolean;
  processedFileCount: number;
  totalFilesToProcess: number;
}

export function CombinedCallAnalysisForm({ 
    onSubmit, 
    isLoading, 
    processedFileCount,
    totalFilesToProcess,
}: CombinedCallAnalysisFormProps) {
  const audioFileInputRef = React.useRef<HTMLInputElement>(null);
  const form = useForm<CombinedCallAnalysisFormValues>({
    resolver: zodResolver(CombinedCallAnalysisFormSchema),
    defaultValues: {
      agentName: "",
      product: undefined, 
      overallAnalysisGoal: "",
    },
  });

  const handleSubmit = (data: CombinedCallAnalysisFormValues) => {
    onSubmit(data);
  };
  
  const selectedFileCountInForm = form.watch("audioFiles")?.length || 0;

  return (
    <Card className="w-full max-w-xl shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl flex items-center"><PieChart className="mr-2 h-6 w-6 text-primary" /> Combined Call Analysis</CardTitle>
        <UiCardDescription>
            Upload multiple call recordings to get an aggregated analysis of performance, themes, and trends across the batch.
        </UiCardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="product"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Focus <span className="text-destructive">*</span></FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value} 
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product (ET / TOI)" />
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
                    The primary product these calls relate to.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="audioFiles"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Upload Audio Files ({MIN_FILES}-{MAX_FILES} files) <span className="text-destructive">*</span></FormLabel>
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
                    Select between {MIN_FILES} and {MAX_FILES} audio files (MP3, WAV, M4A, etc.). Max {MAX_AUDIO_FILE_SIZE / (1024*1024)}MB per file.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="overallAnalysisGoal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Specific Analysis Goal (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                        placeholder="e.g., 'Focus on how pricing objections were handled in this batch' or 'Assess consistency of new product feature presentation'." 
                        rows={2} 
                        {...field} 
                    />
                  </FormControl>
                   <FormDescription>
                    Provide a specific focus for the AI's combined analysis if desired.
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
                  <FormLabel>Agent Name / Analyst (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter name for reference" {...field} />
                  </FormControl>
                  <FormDescription>
                    Name associated with this batch analysis (e.g., team lead, analyst).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Alert variant="default" className="mt-2">
                <InfoIcon className="h-4 w-4" />
                <AlertTitle>Processing Information</AlertTitle>
                <AlertDescription className="text-xs">
                  Each file will be individually transcribed and scored first. Then, a combined analysis will be generated. This may take several minutes depending on the number and length of files.
                </AlertDescription>
            </Alert>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading 
                ? `Analyzing Batch (${processedFileCount}/${totalFilesToProcess} individual calls scored)...` 
                : `Analyze Batch of ${selectedFileCountInForm > 0 ? selectedFileCountInForm : ''} Calls`}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
