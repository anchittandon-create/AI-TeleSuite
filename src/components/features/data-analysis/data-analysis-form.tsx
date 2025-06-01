
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
import type { DataAnalysisInput } from "@/ai/flows/data-analyzer"; // Updated import

const MAX_FILE_SIZE_UPLOAD_VALIDATION = 50 * 1024 * 1024; // 50MB for upload validation
const MAX_TEXT_CONTENT_SAMPLE_LENGTH = 10000; // Max characters from CSV/TXT to pass as sample

const ALLOWED_UPLOAD_FILE_TYPES = [ // All common types are fine for metadata
  "text/csv",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword", // .doc
  "application/vnd.ms-excel", // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/pdf",
  "application/zip", // For CDR dumps etc.
  "application/x-zip-compressed",
  // Add other common data file types if necessary
];

// Updated schema to reflect that 'analysisFiles' are for context (name/type)
// and 'userAnalysisPrompt' is the main detailed input.
const DataAnalysisFormSchema = z.object({
  analysisFiles: z 
    .custom<FileList>((val) => val instanceof FileList && val.length > 0, "Please select or 'upload' at least one file to provide context (name and type) for your analysis prompt.")
    .refine((fileList) => {
        for (let i = 0; i < fileList.length; i++) {
            if (fileList[i].size > MAX_FILE_SIZE_UPLOAD_VALIDATION) return false;
        }
        return true;
    }, `Max file size for upload validation is ${MAX_FILE_SIZE_UPLOAD_VALIDATION / (1024*1024)}MB per file. One or more files exceed this.`)
    .refine((fileList) => {
        for (let i = 0; i < fileList.length; i++) {
            // Allowing empty type for robustness or if browser doesn't set it for some uploads.
            // The backend AI prompt primarily uses file name and user's description of the file.
            if (fileList[i].type !== "" && !ALLOWED_UPLOAD_FILE_TYPES.includes(fileList[i].type) && !fileList[i].name.endsWith('.zip')) { // Added specific check for .zip
                console.warn(`Unsupported file type heuristic for ${fileList[i].name}: ${fileList[i].type}`);
                // Not strictly failing for unknown types, as name might be enough for user's prompt.
                // Consider adding a soft warning in the UI if this becomes an issue.
            }
        }
        return true;
    }, "One or more files appear to have an unusual type. Common types like CSV, TXT, DOCX, XLSX, PDF, ZIP are expected."),
  userAnalysisPrompt: z.string().min(50, "Please provide a detailed analysis prompt (min 50 characters) describing your files, data, and goals.").max(10000, "Analysis prompt is too long (max 10,000 characters)."),
});

export type DataAnalysisFormValues = z.infer<typeof DataAnalysisFormSchema>;

interface DataAnalysisFormProps {
  onSubmit: (data: DataAnalysisInput) => Promise<void>; // Expecting the flow's input type
  isLoading: boolean;
  selectedFileCount: number; // To show in button
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
        fileType: file.type || "unknown" // Provide a fallback for empty type
    }));

    // Try to get a sample from the first CSV or TXT file if present
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
        <CardTitle className="text-xl flex items-center"><Lightbulb className="mr-2 h-6 w-6 text-primary"/> AI Data Analysis Strategist</CardTitle>
        <UiCardDescription className="text-sm">
            Describe your data files (e.g., Excel MIS, CDR dumps, CSV reports) and your specific analysis goals in the prompt below.
            "Upload" files to provide their names and types as context for the AI.
            <br />- For <strong>CSV/TXT files:</strong> A small sample of the content (first ~{MAX_TEXT_CONTENT_SAMPLE_LENGTH/1000}K chars) from the first text file will be used by the AI to make initial observations more concrete.
            <br />- For <strong>Excel, DOCX, PDF, ZIP etc.:</strong> The AI will generate a strategic playbook based on your detailed prompt and the file names/types. <strong>It does not read the internal content of these complex binary files.</strong>
            The AI will provide a comprehensive "Analysis Playbook" to guide you.
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
                      accept="*" // Allow all, as AI mainly uses name/type + prompt
                      ref={analysisFileInputRef}
                      multiple 
                      onChange={(e) => field.onChange(e.target.files)} 
                      className="pt-1.5"
                    />
                  </FormControl>
                  <FormDescription>
                    Select one or more files (Excel, CSV, TXT, PDF, DOCX, ZIP etc.). Their names and types provide context. Max upload validation: {MAX_FILE_SIZE_UPLOAD_VALIDATION / (1024*1024)}MB per file.
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
                  <FormLabel>Detailed Analysis Prompt & Goals</FormLabel>
                  <FormControl>
                    <Textarea 
                        placeholder="Describe your files, their likely data structure (e.g., 'Monthly MIS in Excel has sheets for Oct-May with columns: AgentID, Sales, Revenue... CDR dump is a ZIP of CSVs with CallID, Duration...'), and your specific analysis objectives (e.g., 'Analyze sales trends MoM for Q4 and Q1, identify top 5 performing agents based on revenue and conversion, understand cohort drop-offs in the payment funnel...'). The more detail, the better the strategic guidance." 
                        rows={8} 
                        {...field} 
                    />
                  </FormControl>
                   <FormDescription>
                    This is the primary input for the AI. Be specific!
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? `Generating Strategy...` : `Get Analysis Strategy${selectedFileCount > 0 ? ' ('+selectedFileCount+' files context)' : ''}`}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

    