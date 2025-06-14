
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription as UiCardDescription } from "@/components/ui/card";
import { PRODUCTS, CUSTOMER_COHORTS, Product, CustomerCohort, ET_PLAN_CONFIGURATIONS, ETPlanConfiguration, SALES_PLANS, SalesPlan } from "@/types";
import type { GeneratePitchInput } from "@/ai/flows/pitch-generator";
import { useKnowledgeBase } from "@/hooks/use-knowledge-base";
import React, { useMemo } from "react";
import { Separator } from "@/components/ui/separator";
import { FileUp, InfoIcon } from "lucide-react";

const MAX_DIRECT_KB_FILE_SIZE = 100 * 1024; // 100KB for direct text upload for pitch context
const ALLOWED_DIRECT_KB_FILE_TYPES = ["text/plain", "text/markdown", "text/csv"];


const FormSchema = z.object({
  product: z.enum(PRODUCTS),
  customerCohort: z.enum(CUSTOMER_COHORTS),
  etPlanConfiguration: z.enum(ET_PLAN_CONFIGURATIONS).optional(),
  salesPlan: z.enum(SALES_PLANS).optional(),
  offer: z.string().max(200, "Offer details should be max 200 characters.").optional(),
  agentName: z.string().max(50, "Agent name should be max 50 characters.").optional(),
  userName: z.string().max(50, "Customer name should be max 50 characters.").optional(),
  directKbFile: z
    .custom<FileList>()
    .optional()
    .refine(
      (fileList) => {
        if (!fileList || fileList.length === 0) return true; // Optional, so valid if not present
        const file = fileList[0];
        return file.size <= MAX_DIRECT_KB_FILE_SIZE;
      },
      `Direct KB file size must be ${MAX_DIRECT_KB_FILE_SIZE / 1024}KB or less.`
    )
    .refine(
      (fileList) => {
        if (!fileList || fileList.length === 0) return true;
        const file = fileList[0];
        return ALLOWED_DIRECT_KB_FILE_TYPES.includes(file.type);
      },
      "Unsupported file type for direct KB. Allowed: .txt, .md, .csv"
    ),
});

export type PitchFormValues = z.infer<typeof FormSchema>; // Exporting form values type

interface PitchFormProps {
  onSubmit: (data: PitchFormValues, directKbContent?: string) => Promise<void>; // Pass directKbContent separately
  isLoading: boolean;
}

export function PitchForm({ onSubmit, isLoading }: PitchFormProps) {
  const { getUsedCohorts } = useKnowledgeBase();
  const directKbFileInputRef = React.useRef<HTMLInputElement>(null);

  const availableCohorts = useMemo(() => {
    const usedCohorts = getUsedCohorts();
    return usedCohorts.length > 0 ? usedCohorts : CUSTOMER_COHORTS;
  }, [getUsedCohorts]);

  const form = useForm<PitchFormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      product: PRODUCTS[0],
      customerCohort: availableCohorts[0] || CUSTOMER_COHORTS[0],
      etPlanConfiguration: undefined,
      salesPlan: undefined,
      offer: "",
      agentName: "",
      userName: "",
    },
  });

  const selectedProduct = form.watch("product");

  React.useEffect(() => {
    if (selectedProduct !== "ET") {
      form.setValue("etPlanConfiguration", undefined);
    }
  }, [selectedProduct, form]);

  React.useEffect(() => {
    const currentCohort = form.getValues("customerCohort");
    const newDefaultCohort = availableCohorts[0] || CUSTOMER_COHORTS[0];
    if (availableCohorts.length > 0 && !availableCohorts.includes(currentCohort as CustomerCohort)) {
        form.setValue("customerCohort", newDefaultCohort);
    } else if (availableCohorts.length === 0 && currentCohort !== newDefaultCohort) {
        form.setValue("customerCohort", newDefaultCohort);
    }
  }, [availableCohorts, form]);


  const handleSubmit = async (data: PitchFormValues) => {
    let directKbContent: string | undefined = undefined;
    if (data.directKbFile && data.directKbFile.length > 0) {
      const file = data.directKbFile[0];
      try {
        directKbContent = await file.text();
      } catch (e) {
        form.setError("directKbFile", { type: "manual", message: "Could not read file content." });
        return;
      }
    }
    await onSubmit(data, directKbContent);
  };

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Configure & Generate Sales Pitch</CardTitle>
        <UiCardDescription>
          Set the product context, target audience, and optionally provide specific offers or a direct knowledge file for this pitch.
        </UiCardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="product"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product <span className="text-destructive">*</span></FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (value !== "ET") {
                        form.setValue("etPlanConfiguration", undefined);
                      }
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a product" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PRODUCTS.map((product) => (
                        <SelectItem key={product} value={product}>
                          {product}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {selectedProduct === "ET" && (
              <FormField
                control={form.control}
                name="etPlanConfiguration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ET Plan Configuration (Optional)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select ET plan configuration (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ET_PLAN_CONFIGURATIONS.map((config) => (
                          <SelectItem key={config} value={config}>
                            {config}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="customerCohort"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Cohort <span className="text-destructive">*</span></FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a customer cohort" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableCohorts.map((cohort) => (
                        <SelectItem key={cohort} value={cohort}>
                          {cohort}
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
              name="salesPlan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sales Plan (Optional)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select sales plan (e.g., 1-Year)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SALES_PLANS.map((plan) => (
                        <SelectItem key={plan} value={plan}>
                          {plan}
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
              name="offer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Specific Offer Details (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 20% off, TimesPrime bundle" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="agentName"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Agent Name (Optional)</FormLabel>
                    <FormControl>
                        <Input placeholder="Agent's name" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="userName"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Customer Name (Optional)</FormLabel>
                    <FormControl>
                        <Input placeholder="Customer's name" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>

            <Separator className="my-4" />
            
            <FormField
              control={form.control}
              name="directKbFile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><FileUp className="mr-2 h-4 w-4"/>Direct Knowledge File (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      type="file"
                      accept={ALLOWED_DIRECT_KB_FILE_TYPES.join(",")}
                      ref={directKbFileInputRef}
                      onChange={(e) => field.onChange(e.target.files)}
                      className="pt-1.5"
                    />
                  </FormControl>
                  <FormDescription>
                    Upload a .txt, .md, or .csv file (max {MAX_DIRECT_KB_FILE_SIZE / 1024}KB) to use its content as the knowledge base for THIS pitch only. Overrides general KB.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="bg-accent/10 p-3 rounded-md text-xs text-accent-foreground/80 flex items-start">
                <InfoIcon className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                <span>If no direct file is uploaded, the pitch will be generated using relevant entries from your main Knowledge Base for the selected product.</span>
            </div>


            <Button type="submit" className="w-full !mt-6" disabled={isLoading}>
              {isLoading ? "Generating Pitch..." : "Generate Pitch"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
