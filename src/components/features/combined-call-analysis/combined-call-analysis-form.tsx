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
import { Card, CardContent, CardHeader, CardTitle, CardDescription as UiCardDescription } from "@/components/ui/card";
import React from "react";
import { PieChart, InfoIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// This component is no longer used by the page, but is kept for reference or future use.
// The primary page now uses a simpler form to trigger analysis from historical data.

const MIN_FILES = 2;
const MAX_FILES = 10; 

const CombinedCallAnalysisFormSchema = z.object({
  overallAnalysisGoal: z.string().max(500, "Analysis goal should be max 500 characters.").optional().describe("Optional: A specific goal or focus for this combined analysis (e.g., 'Identify reasons for low conversion in this batch').")
});

export type CombinedCallAnalysisFormValues = z.infer<typeof CombinedCallAnalysisFormSchema>;

interface CombinedCallAnalysisFormProps {
  onSubmit: (data: CombinedCallAnalysisFormValues) => Promise<void>;
  isLoading: boolean;
  totalFilesToProcess: number;
}

export function CombinedCallAnalysisForm({ 
    onSubmit, 
    isLoading, 
    totalFilesToProcess,
}: CombinedCallAnalysisFormProps) {
  const audioFileInputRef = React.useRef<HTMLInputElement>(null);
  const form = useForm<CombinedCallAnalysisFormValues>({
    resolver: zodResolver(CombinedCallAnalysisFormSchema),
    defaultValues: {
      overallAnalysisGoal: "",
    },
  });

  const handleSubmit = (data: CombinedCallAnalysisFormValues) => {
    onSubmit(data);
  };

  return (
    <Card className="w-full max-w-xl shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl flex items-center"><PieChart className="mr-2 h-6 w-6 text-primary" /> Combined Call Analysis</CardTitle>
        <UiCardDescription>
            Run an aggregated analysis on all previously scored calls for a selected product to identify trends and themes.
        </UiCardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
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
            <Alert variant="default" className="mt-2">
                <InfoIcon className="h-4 w-4" />
                <AlertTitle>Processing Information</AlertTitle>
                <AlertDescription className="text-xs">
                  This tool will automatically find all historical call scoring reports for the selected product in your activity log. A minimum of 2 scored calls are required.
                </AlertDescription>
            </Alert>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading 
                ? `Analyzing Batch...` 
                : `Analyze Batch of Calls`}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
