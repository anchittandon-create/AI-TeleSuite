
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
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRODUCTS, CUSTOMER_COHORTS, Product, CustomerCohort, ET_PLAN_CONFIGURATIONS, ETPlanConfiguration } from "@/types"; // Updated import
import type { GeneratePitchInput } from "@/ai/flows/pitch-generator";
import { useKnowledgeBase } from "@/hooks/use-knowledge-base";
import React, { useMemo } from "react";

const FormSchema = z.object({
  product: z.enum(PRODUCTS),
  customerCohort: z.enum(CUSTOMER_COHORTS),
  etPlanConfiguration: z.enum(ET_PLAN_CONFIGURATIONS).optional(), // Updated field
});

interface PitchFormProps {
  onSubmit: (data: GeneratePitchInput) => Promise<void>;
  isLoading: boolean;
}

export function PitchForm({ onSubmit, isLoading }: PitchFormProps) {
  const { getUsedCohorts } = useKnowledgeBase();

  const availableCohorts = useMemo(() => {
    const usedCohorts = getUsedCohorts();
    return usedCohorts.length > 0 ? usedCohorts : CUSTOMER_COHORTS;
  }, [getUsedCohorts]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      product: PRODUCTS[0],
      customerCohort: availableCohorts[0] || CUSTOMER_COHORTS[0],
      etPlanConfiguration: undefined, // Updated field
    },
  });

  const selectedProduct = form.watch("product");

  React.useEffect(() => {
    if (selectedProduct !== "ET") { 
      form.setValue("etPlanConfiguration", undefined); // Updated field
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


  const handleSubmit = (data: z.infer<typeof FormSchema>) => {
    const submissionData: GeneratePitchInput = {
      product: data.product,
      customerCohort: data.customerCohort,
    };
    if (data.product === "ET" && data.etPlanConfiguration) { // Updated field
      submissionData.etPlanConfiguration = data.etPlanConfiguration; // Updated field
    }
    onSubmit(submissionData);
  };

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Generate Sales Pitch</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="product"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (value !== "ET") { 
                        form.setValue("etPlanConfiguration", undefined); // Updated field
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
                name="etPlanConfiguration" // Updated field
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
                        {ET_PLAN_CONFIGURATIONS.map((config) => ( // Updated constant
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
                  <FormLabel>Customer Cohort</FormLabel>
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
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Generating..." : "Generate Pitch"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
