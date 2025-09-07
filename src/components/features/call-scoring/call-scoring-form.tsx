
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription as UiCardDescription } from "@/components/ui/card";
import { Product } from "@/types";
import React from "react";
import { ListChecks } from "lucide-react";
import { useProductContext } from "@/hooks/useProductContext";

const MAX_AUDIO_FILE_SIZE = 100 * 1024 * 1024; // 100MB

const CallScoringFormSchema = z.object({
  audioFiles: z
    .custom<FileList>((val) => val instanceof FileList && val.length > 0, "Please select at least one audio file.")
    .refine((files) => !files || files.length === 0 || Array.from(files).every(file => file.size <= MAX_AUDIO_FILE_SIZE), {
        message: `One or more files exceed the ${MAX_AUDIO_FILE_SIZE / (1024*1024)}MB limit.`,
    }),
  agentName: z.string().optional(),
  product: z.string().min(1, "Product must be selected."),
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
    },
  });

  const handleSubmit = (data: CallScoringFormValues) => {
    onSubmit(data);
  };

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl flex items-center"><ListChecks className="mr-2 h-6 w-6 text-primary" />Score Call(s)</CardTitle>
        <UiCardDescription>Upload audio files to score them against a product's context. The AI analyzes both the audio tone and the transcribed content.</UiCardDescription>
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
                  <FormDescription>Select one or more audio files (max 100MB each). Tonality and content will be analyzed.</FormDescription>
                  <FormMessage />
                  </FormItem>
              )}
            />
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? `Processing...` : `Score Call(s)`}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
