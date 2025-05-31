
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription as UiCardDescription } from "@/components/ui/card"; // Renamed CardDescription
import React from "react";
import { FileSearch } from "lucide-react";

const MAX_FILE_SIZE_ANALYSIS = 10 * 1024 * 1024; // 10MB limit for analysis uploads
const MAX_TEXT_CONTENT_LENGTH = 5000; // Max characters to read from text files

const ALLOWED_ANALYSIS_FILE_TYPES = [
  "text/csv",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.ms-excel", // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/pdf" // Allow PDF as it's common, though content won't be read by AI
];

const DataAnalysisFormSchema = z.object({
  analysisFile: z
    .custom<FileList>((val) => val instanceof FileList && val.length > 0, "At least one file is required.")
    .refine((fileList) => fileList?.[0]?.size <= MAX_FILE_SIZE_ANALYSIS, `Max file size is ${MAX_FILE_SIZE_ANALYSIS / (1024*1024)}MB.`)
    .refine(
      (fileList) => ALLOWED_ANALYSIS_FILE_TYPES.includes(fileList?.[0]?.type),
      "Unsupported file type. Allowed: CSV, TXT, DOCX, XLSX, XLS, PDF."
    ),
  userDescription: z.string().min(10, "Please provide a brief description or analysis goal (min 10 characters).").max(500, "Description is too long (max 500 characters).").optional(),
});

export type DataAnalysisFormValues = z.infer<typeof DataAnalysisFormSchema>;

interface DataAnalysisFormProps {
  onSubmit: (data: DataAnalysisFormValues, fileContent: string | undefined) => Promise<void>;
  isLoading: boolean;
}

export function DataAnalysisForm({ onSubmit, isLoading }: DataAnalysisFormProps) {
  const analysisFileInputRef = React.useRef<HTMLInputElement>(null);
  const form = useForm<DataAnalysisFormValues>({
    resolver: zodResolver(DataAnalysisFormSchema),
    defaultValues: {
      userDescription: "",
    },
  });

  const handleSubmit = async (data: DataAnalysisFormValues) => {
    const file = data.analysisFile[0];
    let fileContent: string | undefined = undefined;

    if (file.type.startsWith('text/') || file.type === 'application/csv') {
      try {
        const text = await file.text();
        fileContent = text.substring(0, MAX_TEXT_CONTENT_LENGTH);
      } catch (error) {
        console.error("Error reading file content:", error);
        form.setError("analysisFile", { type: "manual", message: "Could not read text content from the file." });
        return;
      }
    }
    await onSubmit(data, fileContent);
  };

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl flex items-center"><FileSearch className="mr-2 h-6 w-6 text-primary"/> Analyze Data File</CardTitle>
        <UiCardDescription>
          Upload a CSV, TXT, DOCX, XLSX, XLS or PDF file. Provide a brief description or your analysis goal.
          For CSV/TXT, content will be analyzed. For DOCX/XLSX/PDF, analysis is based on filename and your description.
        </UiCardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="analysisFile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Upload File</FormLabel>
                  <FormControl>
                    <Input 
                      type="file" 
                      accept={ALLOWED_ANALYSIS_FILE_TYPES.join(",")}
                      ref={analysisFileInputRef}
                      onChange={(e) => field.onChange(e.target.files)} 
                      className="pt-1.5"
                    />
                  </FormControl>
                  <FormDescription>
                    Max file size: {MAX_FILE_SIZE_ANALYSIS / (1024*1024)}MB.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="userDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description / Analysis Goal (Optional but Recommended)</FormLabel>
                  <FormControl>
                    <Textarea 
                        placeholder="e.g., 'Summarize key themes in this customer feedback CSV.' or 'Identify potential sales trends from this monthly report XLSX.'" 
                        rows={3} 
                        {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Analyzing..." : "Analyze File"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

    