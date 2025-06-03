
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
import { FileSearch, Lightbulb } from "lucide-react";
import type { DataAnalysisInput } from "@/ai/flows/data-analyzer";

const MAX_FILE_SIZE_FOR_UPLOAD_VALIDATION = 1024 * 1024 * 1024; // 1GB for client-side selection validation
const MAX_TEXT_CONTENT_SAMPLE_LENGTH = 10000; // Max characters from CSV/TXT to pass as sample

const ALLOWED_UPLOAD_FILE_TYPES = [ 
  "text/csv",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 
  "application/msword", 
  "application/vnd.ms-excel", 
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
  "application/pdf",
  "application/zip", 
  "application/x-zip-compressed",
];

const DataAnalysisFormSchema = z.object({
  analysisFiles: z 
    .custom<FileList>((val) => val instanceof FileList && val.length > 0, "Please select or 'upload' at least one file to provide context (name and type) for your analysis.")
    .refine((fileList) => {
        for (let i = 0; i < fileList.length; i++) {
            if (fileList[i].size > MAX_FILE_SIZE_FOR_UPLOAD_VALIDATION) return false;
        }
        return true;
    }, `Max file size for selection is ${MAX_FILE_SIZE_FOR_UPLOAD_VALIDATION / (1024*1024*1024)}GB per file. One or more files exceed this limit. Note: For very large files, especially non-text files, the AI analyzes based on your prompt and file metadata, not the full content.`)
    .refine((fileList) => {
        for (let i = 0; i < fileList.length; i++) {
            if (fileList[i].type !== "" && !ALLOWED_UPLOAD_FILE_TYPES.includes(fileList[i].type) && !fileList[i].name.endsWith('.zip')) {
                console.warn(`Potentially unsupported file type for ${fileList[i].name}: ${fileList[i].type}. Analysis will rely heavily on your prompt.`);
            }
        }
        return true;
    }, "One or more files appear to have an unusual type. Ensure your prompt accurately describes the content of these files."),
  userAnalysisPrompt: z.string().min(50, "Please provide a detailed analysis prompt (min 50 characters) describing your files, specific file mappings, and any particular focus areas for this analysis run.").max(10000, "Analysis prompt is too long (max 10,000 characters)."),
});

export type DataAnalysisFormValues = z.infer<typeof DataAnalysisFormSchema>;

interface DataAnalysisFormProps {
  onSubmit: (data: DataAnalysisInput) => Promise<void>;
  isLoading: boolean;
  selectedFileCount: number; 
}

export function DataAnalysisForm({ onSubmit, isLoading, selectedFileCount }: DataAnalysisFormProps) {
  const analysisFileInputRef = React.useRef<HTMLInputElement>(null);
  const form = useForm<DataAnalysisFormValues>({
    resolver: zodResolver(DataAnalysisFormSchema),
    defaultValues: {
      userAnalysisPrompt: "",
    },
  });

  const handleSubmit = async (data: DataAnalysisFormValues) => {
    const files = Array.from(data.analysisFiles);
    let sampledFileContent: string | undefined = undefined;
    
    const fileDetailsForFlow: DataAnalysisInput['fileDetails'] = files.map(file => ({
        fileName: file.name,
        fileType: file.type || "unknown" 
    }));

    const firstTextFile = files.find(f => f.type === 'text/csv' || f.type === 'text/plain');
    if (firstTextFile) {
      try {
        const text = await firstTextFile.text();
        sampledFileContent = text.substring(0, MAX_TEXT_CONTENT_SAMPLE_LENGTH);
      } catch (error) {
        console.error(`Error reading content sample for ${firstTextFile.name}:`, error);
      }
    }

    const flowInput: DataAnalysisInput = {
        fileDetails: fileDetailsForFlow,
        userAnalysisPrompt: data.userAnalysisPrompt,
        sampledFileContent: sampledFileContent
    };
    
    await onSubmit(flowInput);
  };

  return (
    <Card className="w-full max-w-2xl shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl flex items-center"><Lightbulb className="mr-2 h-6 w-6 text-primary"/> AI Data Analyst</CardTitle>
        <UiCardDescription className="text-sm">
            Describe your data files and analysis goals in the prompt below. "Upload" files to provide their names and types as context for the AI.
            <br />- The AI will perform a comprehensive analysis based on its built-in instructions and your specific prompt.
            <br />- For <strong>CSV/TXT files:</strong> A small sample (first ~{MAX_TEXT_CONTENT_SAMPLE_LENGTH/1000}K chars) from the first selected text file will be sent to the AI for more concrete initial observations.
            <br />- For <strong>Excel, DOCX, PDF, ZIP etc. (including very large files):</strong> The AI analyzes based on your detailed prompt and the file names/types. <strong>The AI does not directly read or process the internal content of these large binary files.</strong>
            The AI will provide a structured analysis report.
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
                  <FormLabel>"Upload" Context Files</FormLabel>
                  <FormControl>
                    <Input 
                      type="file" 
                      accept="*" 
                      ref={analysisFileInputRef}
                      multiple 
                      onChange={(e) => field.onChange(e.target.files)} 
                      className="pt-1.5"
                    />
                  </FormControl>
                  <FormDescription>
                    Select one or more files (Excel, CSV, TXT, PDF, DOCX, ZIP etc.).
                    The AI's analysis method varies by file type (see description above).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="userAnalysisPrompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Specific Analysis Prompt & Context</FormLabel>
                  <FormControl>
                    <Textarea 
                        placeholder="Provide specific details for THIS analysis run. For example: 'File sales_oct.xlsx is the Monthly Revenue Tracker for Oct.' or 'Focus the trend analysis on Q1 (Jan-Mar).' or 'Pay special attention to Agent X's performance in April as per APR Report intervention.' This information supplements the AI's main analysis instructions." 
                        rows={8} 
                        {...field} 
                    />
                  </FormControl>
                   <FormDescription>
                    This is your primary input to guide the AI's analysis for this specific run. Be detailed!
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? `Analyzing Data...` : `Generate Analysis Report${selectedFileCount > 0 ? ' ('+selectedFileCount+' files context)' : ''}`}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
    

    