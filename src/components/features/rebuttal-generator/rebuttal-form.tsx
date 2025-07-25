
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useProductContext } from "@/hooks/useProductContext";
import { MessageSquarePlus } from "lucide-react";
import React, { useMemo } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const FormSchema = z.object({
  product: z.string().min(1, "Product must be selected."),
  objection: z.string().min(5, { message: "Objection must be at least 5 characters." }).max(500, { message: "Objection must be at most 500 characters." }),
});

type RebuttalFormValues = z.infer<typeof FormSchema>;

interface RebuttalFormProps {
  onSubmit: (data: RebuttalFormValues) => Promise<void>;
  isLoading: boolean;
}

const defaultObjections = [
  "It's too expensive for me right now.",
  "I don't have time to use it.",
  "I get enough news for free already.",
  "I'll think about it and get back to you.",
  "Can you send me the details on WhatsApp?",
  "I tried it before and didn't find it useful.",
];

export function RebuttalForm({ onSubmit, isLoading }: RebuttalFormProps) {
  const { availableProducts } = useProductContext();
  const productOptions = useMemo(() => availableProducts.map(p => p.name), [availableProducts]);

  const form = useForm<RebuttalFormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      objection: "",
      product: ""
    },
  });

  const handleSubmit = (data: RebuttalFormValues) => {
    onSubmit(data);
  };

  const handleSetObjection = (objectionText: string) => {
    form.setValue("objection", objectionText);
  };

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Generate Rebuttal</CardTitle>
        <CardDescription>Enter the customer's objection to get an AI-assisted rebuttal based on the selected product's Knowledge Base.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="product"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product <span className="text-destructive">*</span></FormLabel>
                   <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a product for context" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {productOptions.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
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
              name="objection"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Objection <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., 'It's too expensive for me right now.'"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
                <FormLabel className="text-xs text-muted-foreground">Quick Start with Common Objections:</FormLabel>
                <div className="flex flex-wrap gap-2">
                    {defaultObjections.map((obj, index) => (
                        <Button
                            key={index}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetObjection(obj)}
                            className="text-xs"
                        >
                           <MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" /> {obj}
                        </Button>
                    ))}
                </div>
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading || !form.getValues("product")}>
              {isLoading ? "Generating..." : "Get Rebuttal"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
