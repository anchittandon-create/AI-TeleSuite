
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription as UiCardDescription } from "@/components/ui/card";
import { Product } from "@/types";
import React, { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon, ListChecks } from "lucide-react";
import { useProductContext } from "@/hooks/useProductContext";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const MAX_AUDIO_FILE_SIZE = 100 * 1024 * 1024; // 100MB

const CallScoringFormSchema = z.object({
  inputType: z.enum(["audio", "text"]).default("audio"),
  audioFiles: z
    .custom<FileList>()
    .optional()
    .refine((files) => !files || files.length === 0 || Array.from(files).every(file => file.size <= MAX_AUDIO_FILE_SIZE), {
        message: `One or more files exceed the ${MAX_AUDIO_FILE_SIZE / (1024*1024)}MB limit.`,
    }),
  transcriptOverride: z.string().optional(),
  agentName: z.string().optional(),
  product: z.string().min(1, "Product must be selected."),
}).superRefine((data, ctx) => {
    // If inputType is audio, at least one audio file must be present
    if (data.inputType === 'audio' && (!data.audioFiles || data.audioFiles.length === 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please select at least one audio file for audio input.",
            path: ["audioFiles"],
        });
    }
    // If inputType is text, a transcript must be provided. For best results, audio should also be provided.
    if (data.inputType === 'text' && (!data.transcriptOverride || data.transcriptOverride.length < 50)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Transcript must be at least 50 characters long.",
            path: ["transcriptOverride"],
        });
    }
});


export type CallScoringFormValues = z.infer<typeof CallScoringFormSchema>;

interface CallScoringFormProps {
  onSubmit: (data: CallScoringFormValues) => Promise<void>;
  isLoading: boolean;
}

export function CallScoringForm({
    onSubmit,
    isLoading,
}: CallScoringFormProps) {
  const { availableProducts } = useProductContext();
  const audioFileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<CallScoringFormValues>({
    resolver: zodResolver(CallScoringFormSchema),
    defaultValues: {
      agentName: "",
      product: "",
      transcriptOverride: "",
      inputType: "audio",
    },
  });
  
  const inputType = form.watch("inputType");

  const handleSubmit = (data: CallScoringFormValues) => {
    onSubmit(data);
  };

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl flex items-center"><ListChecks className="mr-2 h-6 w-6 text-primary" />Score Call(s)</CardTitle>
        <UiCardDescription>Upload audio files directly or paste a transcript to score against the selected product context.</UiCardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
                control={form.control}
                name="inputType"
                render={({ field }) => (
                    <FormItem className="space-y-3">
                    <FormLabel>Input Type</FormLabel>
                    <FormControl>
                        <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex space-x-4"
                        >
                        <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl><RadioGroupItem value="audio" /></FormControl>
                            <FormLabel className="font-normal">Audio Only</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl><RadioGroupItem value="text" /></FormControl>
                            <FormLabel className="font-normal">Transcript + Audio</FormLabel>
                        </FormItem>
                        </RadioGroup>
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="product"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Product Focus <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Select a product for context" />
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

            <FormField
              control={form.control}
              name="audioFiles"
              render={({ field }) => (
                  <FormItem>
                  <FormLabel>Audio File(s) <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                      <Input
                          type="file"
                          accept="audio/*"
                          multiple
                          ref={audioFileInputRef}
                          onChange={(e) => field.onChange(e.target.files)}
                          className="pt-1.5"
                      />
                  </FormControl>
                  <FormDescription>Select one or more audio files (max 100MB each). Required for tonality analysis.</FormDescription>
                  <FormMessage />
                  </FormItem>
              )}
            />

            {inputType === 'text' && (
                <FormField
                  control={form.control}
                  name="transcriptOverride"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paste Full Call Transcript <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Textarea 
                            placeholder="Paste the diarized call transcript here. e.g., 'AGENT: Hello...' 'USER: Hi...'"
                            className="min-h-[150px]"
                             {...field}
                        />
                      </FormControl>
                       <FormDescription>
                        Get transcripts from the "Audio Transcription" page. Uploading audio above is still recommended for tonality analysis.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? `Processing...` : `Score Call(s)`}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
