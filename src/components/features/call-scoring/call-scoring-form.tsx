
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import React from "react";

const MAX_AUDIO_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg", // .mp3
  "audio/wav", // .wav
  "audio/mp4", // .m4a, .mp4 audio
  "audio/x-m4a", // common for m4a
  "audio/ogg", // .ogg
  "audio/webm", // .webm
  "audio/aac", // .aac
  "audio/flac", // .flac
];

const CallScoringFormSchema = z.object({
  audioFile: z
    .custom<FileList>((val) => val instanceof FileList && val.length > 0, "Audio file is required.")
    .refine((files) => files?.[0]?.size <= MAX_AUDIO_FILE_SIZE, `Max file size is 15MB.`)
    .refine(
      (files) => ALLOWED_AUDIO_TYPES.includes(files?.[0]?.type),
      "Unsupported audio type. Allowed: MP3, WAV, M4A, OGG, WEBM, AAC, FLAC"
    ),
  agentName: z.string().optional(),
});

export type CallScoringFormValues = z.infer<typeof CallScoringFormSchema>;

interface CallScoringFormProps {
  onSubmit: (data: CallScoringFormValues) => Promise<void>;
  isLoading: boolean;
  submitButtonText?: string;
  formTitle?: string;
}

export function CallScoringForm({ 
    onSubmit, 
    isLoading, 
    submitButtonText = "Score Call",
    formTitle = "Score a Call Recording" 
}: CallScoringFormProps) {
  const audioFileInputRef = React.useRef<HTMLInputElement>(null);
  const form = useForm<CallScoringFormValues>({
    resolver: zodResolver(CallScoringFormSchema),
    defaultValues: {
      agentName: "",
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
                  <FormLabel>Upload Audio File</FormLabel>
                  <FormControl>
                    <Input 
                      type="file" 
                      accept={ALLOWED_AUDIO_TYPES.join(",")}
                      ref={audioFileInputRef}
                      onChange={(e) => field.onChange(e.target.files)} 
                      className="pt-1.5"
                    />
                  </FormControl>
                  <FormDescription>
                    Supported: MP3, WAV, M4A, OGG, WEBM, AAC, FLAC (Max 15MB)
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
              {isLoading ? "Analyzing..." : submitButtonText}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
