
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
import { useKnowledgeBase } from "@/hooks/use-knowledge-base";
import React, { useMemo } from "react";
import { FileUp, InfoIcon, ChevronDown } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const MAX_DIRECT_UPLOAD_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit for any file type upload for context

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
        if (!fileList || fileList.length === 0) return true;
        const file = fileList[0];
        return file.size <= MAX_DIRECT_UPLOAD_FILE_SIZE;
      },
      `Direct context file size must be ${MAX_DIRECT_UPLOAD_FILE_SIZE / (1024 * 1024)}MB or less.`
    )
});

export type PitchFormValues = z.infer<typeof FormSchema>; 

interface PitchFormProps {
  onSubmit: (data: PitchFormValues, directKbContent?: string, directKbFileInfo?: {name: string, type: string}) => Promise<void>; 
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
    let directKbFileInfo: {name: string, type: string} | undefined = undefined;

    if (data.directKbFile && data.directKbFile.length > 0) {
      const file = data.directKbFile[0];
      directKbFileInfo = { name: file.name, type: file.type || "unknown" };
      
      const TEXT_READABLE_TYPES = ["text/plain", "text/markdown", "text/csv"];
      const MAX_CONTENT_READ_SIZE = 100 * 1024; // 100KB for reading content

      const isReadableTextType = TEXT_READABLE_TYPES.includes(file.type) || 
                                 file.name.match(/\.(txt|md|csv)$/i);

      if (isReadableTextType) {
        if (file.size <= MAX_CONTENT_READ_SIZE) {
          try {
            directKbContent = await file.text();
          } catch (e) {
            console.warn(`Could not read text content from file ${file.name}:`, e);
          }
        } else {
          console.warn(`File ${file.name} is too large (${(file.size/1024).toFixed(1)}KB) to read its content directly. Max for reading: ${MAX_CONTENT_READ_SIZE/1024}KB.`);
        }
      } else {
        console.log(`File ${file.name} (type: ${file.type}) is not a directly readable text type. Only name/type will be used as context.`);
      }
    }
    await onSubmit(data, directKbContent, directKbFileInfo);
  };

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Configure & Generate Sales Pitch</CardTitle>
        <UiCardDescription>
          Set primary context, optionally personalize, and provide a direct knowledge file if needed.
        </UiCardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </div>

            <FormField
              control={form.control}
              name="directKbFile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><FileUp className="mr-2 h-4 w-4"/>Direct Context File (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      type="file"
                      accept="*" // Allows all file types
                      ref={directKbFileInputRef}
                      onChange={(e) => field.onChange(e.target.files)}
                      className="pt-1.5"
                    />
                  </FormControl>
                  <FormDescription>
                    Upload any file (max {MAX_DIRECT_UPLOAD_FILE_SIZE / (1024*1024)}MB). 
                    Content from simple text files (.txt, .md, .csv up to 100KB) will be used directly. 
                    For other file types (like .pdf, .doc, .docx) or larger text files, only their name and type will be used as context for the AI. 
                    This direct file context, if provided, overrides the general Knowledge Base.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="optional-details">
                <AccordionTrigger className="text-sm py-2 hover:no-underline">
                  Optional Personalization Details
                </AccordionTrigger>
                <AccordionContent className="pt-3 space-y-4">
                  {selectedProduct === "ET" && (
                    <FormField
                      control={form.control}
                      name="etPlanConfiguration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ET Plan Configuration</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || ""}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select ET plan configuration" />
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
                    name="salesPlan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sales Plan</FormLabel>
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
                        <FormLabel>Specific Offer Details</FormLabel>
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
                          <FormLabel>Agent Name</FormLabel>
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
                          <FormLabel>Customer Name</FormLabel>
                          <FormControl>
                              <Input placeholder="Customer's name" {...field} />
                          </FormControl>
                          <FormMessage />
                          </FormItem>
                      )}
                      />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            
            <div className="bg-accent/10 p-3 rounded-md text-xs text-accent-foreground/80 flex items-start mt-4">
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
