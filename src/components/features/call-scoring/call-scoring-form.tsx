
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

const MAX_AUDIO_FILE_SIZE = 100 * 1024 * 1024;
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
  inputType: z.enum(["audio", "text"]).default("audio"),
  audioFile: z
    .custom<FileList>()
    .optional(),
  transcriptOverride: z.string().optional(),
  agentName: z.string().optional(),
  product: z.string().min(1, "Product must be selected."),
})
.superRefine((data, ctx) => {
    if (data.inputType === 'audio') {
        if (!data.audioFile || data.audioFile.length === 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At least one audio file is required.", path: ['audioFile'] });
        } else {
            for (let i = 0; i < data.audioFile.length; i++) {
              if (data.audioFile[i].size > MAX_AUDIO_FILE_SIZE) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Max file size is ${MAX_AUDIO_FILE_SIZE / (1024*1024)}MB. File "${data.audioFile[i].name}" is too large.`, path: ['audioFile'] });
              }
              if (data.audioFile[i].type !== "" && !ALLOWED_AUDIO_TYPES.includes(data.audioFile[i].type)) {
                console.warn(`Potentially unsupported audio type: ${data.audioFile[i].name} (${data.audioFile[i].type}).`)
              }
            }
        }
    } else if (data.inputType === 'text') {
        if (!data.transcriptOverride || data.transcriptOverride.length < 50) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Transcript must be at least 50 characters long.", path: ['transcriptOverride'] });
        }
    }
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
    submitButtonText = "Score Call(s)",
    formTitle = "Score Call Recording(s)",
    selectedFileCount
}: CallScoringFormProps) {
  const audioFileInputRef = React.useRef<HTMLInputElement>(null);
  const { availableProducts } = useProductContext();
  

  const form = useForm<CallScoringFormValues>({
    resolver: zodResolver(CallScoringFormSchema),
    defaultValues: {
      agentName: "",
      product: "",
      inputType: "audio",
      transcriptOverride: "",
    },
  });

  const inputType = form.watch("inputType");

  const handleSubmit = (data: CallScoringFormValues) => {
    onSubmit(data);
  };

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl flex items-center"><ListChecks className="mr-2 h-6 w-6 text-primary" />{formTitle}</CardTitle>
        <UiCardDescription>Upload an audio file or paste a transcript to score it against the selected product context.</UiCardDescription>
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
                        <FormLabel className="font-normal">Audio File</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl><RadioGroupItem value="text" /></FormControl>
                        <FormLabel className="font-normal">Paste Transcript</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {inputType === 'audio' && (
                <FormField
                  control={form.control}
                  name="audioFile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Upload Audio File(s) <span className="text-destructive">*</span></FormLabel>
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
                        Supported: MP3, WAV, M4A, etc. (Max {MAX_AUDIO_FILE_SIZE / (1024*1024)}MB per file).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            )}
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
                        Provide the full transcript to bypass audio processing.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? `Scoring ${selectedFileCount > 0 ? selectedFileCount + ' files...' : '... '}` : `${submitButtonText}${selectedFileCount > 1 ? ` (${selectedFileCount} Files)` : ''}`}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
