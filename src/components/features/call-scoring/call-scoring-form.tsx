
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
];

const CallScoringFormSchema = z.object({
  audioFile: z
    .custom<FileList>((val) => val instanceof FileList && val.length > 0, "Audio file is required.")
    .refine((files) => files?.[0]?.size <= MAX_AUDIO_FILE_SIZE, `Max file size is 15MB.`)
    .refine(
      (files) => ALLOWED_AUDIO_TYPES.includes(files?.[0]?.type),
      "Unsupported audio type. Allowed: MP3, WAV, M4A, OGG, WEBM"
    ),
  agentName: z.string().optional(),
});

export type CallScoringFormValues = z.infer<typeof CallScoringFormSchema>;

interface CallScoringFormProps {
  onSubmit: (data: CallScoringFormValues) => Promise<void>;
  isLoading: boolean;
}

export function CallScoringForm({ onSubmit, isLoading }: CallScoringFormProps) {
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
        <CardTitle className="text-xl">Score a Call Recording</CardTitle>
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
                      accept="audio/*"
                      ref={audioFileInputRef}
                      onChange={(e) => field.onChange(e.target.files)} 
                      className="pt-1.5"
                    />
                  </FormControl>
                  <FormDescription>
                    Supported formats: MP3, WAV, M4A, OGG, WEBM (Max 15MB)
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
              {isLoading ? "Analyzing..." : "Score Call"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
