
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
import { FileSearch } from "lucide-react";

const MAX_FILE_SIZE_ANALYSIS = 50 * 1024 * 1024; // Increased to 50MB for upload validation
const MAX_TEXT_CONTENT_LENGTH = 10000; // Max characters to read from text files for AI processing

const ALLOWED_ANALYSIS_FILE_TYPES = [
  "text/csv",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.ms-excel", // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/pdf"
];

const DataAnalysisFormSchema = z.object({
  analysisFiles: z 
    .custom<FileList>((val) => val instanceof FileList && val.length > 0, "At least one file is required.")
    .refine((fileList) => {
        for (let i = 0; i < fileList.length; i++) {
            if (fileList[i].size > MAX_FILE_SIZE_ANALYSIS) return false;
        }
        return true;
    }, `Max file size for upload is ${MAX_FILE_SIZE_ANALYSIS / (1024*1024)}MB per file. One or more files exceed this limit. Actual AI processing of content is limited for large binary files.`)
    .refine((fileList) => {
        for (let i = 0; i < fileList.length; i++) {
            if (!ALLOWED_ANALYSIS_FILE_TYPES.includes(fileList[i].type) && fileList[i].type !== "") return false; // Allow empty type for robustness
        }
        return true;
    }, "Unsupported file type detected in one or more files. Allowed: CSV, TXT, DOCX, XLSX, XLS, PDF."),
  userDescription: z.string().min(10, "Please provide a brief description or analysis goal (min 10 characters).").max(500, "Description is too long (max 500 characters).").optional(),
});

export type DataAnalysisFormValues = z.infer<typeof DataAnalysisFormSchema>;

interface DataAnalysisFormProps {
  onSubmit: (data: DataAnalysisFormValues, fileContents: (string | undefined)[]) => Promise<void>;
  isLoading: boolean;
  selectedFileCount: number;
}

export function DataAnalysisForm({ onSubmit, isLoading, selectedFileCount }: DataAnalysisFormProps) {
  const analysisFileInputRef = React.useRef<HTMLInputElement>(null);
  const form = useForm<DataAnalysisFormValues>({
    resolver: zodResolver(DataAnalysisFormSchema),
    defaultValues: {
      userDescription: "",
    },
  });

  const handleSubmit = async (data: DataAnalysisFormValues) => {
    const files = Array.from(data.analysisFiles);
    const fileContents: (string | undefined)[] = [];

    for (const file of files) {
      let content: string | undefined = undefined;
      // Only read content for CSV and TXT files
      if (file.type === 'text/csv' || file.type === 'text/plain') {
        try {
          const text = await file.text();
          content = text.substring(0, MAX_TEXT_CONTENT_LENGTH);
        } catch (error) {
          console.error(`Error reading file content for ${file.name}:`, error);
          // Pass undefined content; the flow's prompt handles missing content by relying on metadata
        }
      }
      fileContents.push(content);
    }
    await onSubmit(data, fileContents);
  };

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl flex items-center"><FileSearch className="mr-2 h-6 w-6 text-primary"/> Analyze Data File(s)</CardTitle>
        <UiCardDescription>
          Upload one or more CSV, TXT, DOCX, XLSX, XLS, or PDF files. Provide a brief description or your analysis goal.
          <br />- For <strong>CSV/TXT files:</strong> The AI will analyze up to the first ~{MAX_TEXT_CONTENT_LENGTH/1000}K characters of content.
          <br />- For <strong>DOCX, XLSX, XLS, PDF files:</strong> Analysis is based on the file's <strong>name, type, and your description/goal</strong>. The internal content of these binary files is not directly processed by the AI.
        </UiCardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="analysisFiles"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Upload File(s)</FormLabel>
                  <FormControl>
                    <Input 
                      type="file" 
                      accept={ALLOWED_ANALYSIS_FILE_TYPES.join(",")}
                      ref={analysisFileInputRef}
                      multiple 
                      onChange={(e) => field.onChange(e.target.files)} 
                      className="pt-1.5"
                    />
                  </FormControl>
                  <FormDescription>
                    Max upload validation: {MAX_FILE_SIZE_ANALYSIS / (1024*1024)}MB per file. See detailed handling notes above.
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
                        placeholder="e.g., 'Analyze agent conversion rates from this Q1 call log CSV.' or 'What insights can be drawn from a file named sales_summary_q3.xlsx?'" 
                        rows={3} 
                        {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? `Analyzing ${selectedFileCount > 0 ? selectedFileCount + ' files...' : 'files...'}` : `Analyze File(s)${selectedFileCount > 0 ? ' ('+selectedFileCount+')' : ''}`}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
