
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

const CallScoringFormSchema = z.object({
  transcriptOverride: z.string().min(50, "Transcript must be at least 50 characters long."),
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

  const form = useForm<CallScoringFormValues>({
    resolver: zodResolver(CallScoringFormSchema),
    defaultValues: {
      agentName: "",
      product: "",
      transcriptOverride: "",
    },
  });

  const handleSubmit = (data: CallScoringFormValues) => {
    onSubmit(data);
  };

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl flex items-center"><ListChecks className="mr-2 h-6 w-6 text-primary" />Score Call Transcript</CardTitle>
        <UiCardDescription>Paste a transcript to score it against the selected product context. Get transcripts from the "Audio Transcription" page.</UiCardDescription>
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
                    Get transcripts from the "Audio Transcription" page.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? `Scoring...` : `Score Call`}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
