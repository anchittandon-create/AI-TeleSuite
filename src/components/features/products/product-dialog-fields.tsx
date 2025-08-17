
"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ProductObject, CUSTOMER_COHORTS as PREDEFINED_CUSTOMER_COHORTS, SALES_PLANS as PREDEFINED_SALES_PLANS, ET_PLAN_CONFIGURATIONS as PREDEFINED_SPECIAL_CONFIGS } from '@/types';
import { Sparkles, Loader2, Users, Briefcase, BadgeInfo, X, Plus } from 'lucide-react';
import React, { useState } from "react";

interface ProductDialogFieldsProps {
    context: 'add' | 'edit';
    productData: Omit<ProductObject, 'name'>;
    updater: React.Dispatch<React.SetStateAction<Omit<ProductObject, 'name'>>>;
    isGeneratingDesc: boolean;
    onGenerateDescription: (context: 'add' | 'edit') => void;
}

const TagInput: React.FC<{
    label: string;
    values: string[];
    predefinedValues: readonly string[];
    onValuesChange: (newValues: string[]) => void;
    showCustomInput?: boolean;
    customInputPlaceholder?: string;
}> = ({ label, values, predefinedValues, onValuesChange, showCustomInput = true, customInputPlaceholder }) => {
    const [inputValue, setInputValue] = useState("");

    const handleAddValue = () => {
        const newValue = inputValue.trim();
        if (newValue && !values.includes(newValue)) {
            onValuesChange([...values, newValue]);
        }
        setInputValue("");
    };

    const handleRemoveValue = (valueToRemove: string) => {
        onValuesChange(values.filter(v => v !== valueToRemove));
    };

    const handlePredefinedClick = (value: string) => {
        const newValues = values.includes(value)
            ? values.filter(v => v !== value) // Toggle off
            : [...values, value]; // Toggle on
        onValuesChange(newValues);
    };
    
    return (
        <div className="space-y-4">
             {values.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-background min-h-[40px]">
                    {values.map(value => (
                        <Badge key={value} variant="secondary" className="text-sm py-1 pl-3 pr-1">
                            {value}
                            <button type="button" onClick={() => handleRemoveValue(value)} className="ml-2 rounded-full p-0.5 hover:bg-destructive/20 text-destructive">
                                <X size={14}/>
                            </button>
                        </Badge>
                    ))}
                </div>
            )}
             {showCustomInput && (
                <div className="flex items-center gap-2">
                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddValue();
                            }
                        }}
                        placeholder={customInputPlaceholder || `Type a new ${label.toLowerCase()} and press Enter`}
                    />
                    <Button type="button" onClick={handleAddValue} variant="outline" size="sm">Add</Button>
                </div>
            )}
            {predefinedValues.length > 0 && (
                 <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-2">Click to add/remove from predefined list:</p>
                    <div className="flex flex-wrap gap-1.5">
                        {predefinedValues.map(value => (
                             <Button key={value} type="button" size="xs" variant={values.includes(value) ? 'default' : 'outline'} onClick={() => handlePredefinedClick(value)} className="font-normal">
                                {values.includes(value) ? <X className="mr-1.5 h-3 w-3"/> : <Plus className="mr-1.5 h-3 w-3" />} {value}
                            </Button>
                        ))}
                    </div>
                 </div>
            )}
        </div>
    );
};


export function ProductDialogFields({
    context,
    productData,
    updater,
    isGeneratingDesc,
    onGenerateDescription
}: ProductDialogFieldsProps) {
    
    const handleTagsChange = (type: 'customerCohorts' | 'salesPlans' | 'etPlanConfigurations', newValues: string[]) => {
        updater(prev => ({ ...prev, [type]: newValues }));
    };

    return (
        <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor={`${context}-product-display-name`} className="text-right">Display Name</Label>
                <Input
                    id={`${context}-product-display-name`}
                    value={productData.displayName}
                    onChange={(e) => updater(p => ({ ...p, displayName: e.target.value }))}
                    className="col-span-3"
                    placeholder="e.g., MagicBricks"
                />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor={`${context}-product-brand-name`} className="text-right">Brand Name</Label>
                <Input
                    id={`${context}-product-brand-name`}
                    value={productData.brandName}
                    onChange={(e) => updater(p => ({ ...p, brandName: e.target.value }))}
                    className="col-span-3"
                    placeholder="(Optional) Official brand name"
                />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor={`${context}-product-brand-url`} className="text-right">Brand URL</Label>
                <Input
                    id={`${context}-product-brand-url`}
                    value={productData.brandUrl}
                    onChange={(e) => updater(p => ({ ...p, brandUrl: e.target.value }))}
                    className="col-span-3"
                    placeholder="(Optional) https://www.brand.com"
                />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor={`${context}-product-description`} className="text-right pt-2">Description</Label>
                <div className="col-span-3 space-y-2">
                    <Textarea
                        id={`${context}-product-description`}
                        value={productData.description}
                        onChange={(e) => updater(p => ({ ...p, description: e.target.value }))}
                        placeholder="(Optional) A short description of the product."
                    />
                    <Button size="xs" variant="outline" onClick={() => onGenerateDescription(context)} disabled={isGeneratingDesc}>
                        {isGeneratingDesc ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                        Generate with AI
                    </Button>
                </div>
            </div>
            <Accordion type="multiple" defaultValue={["cohorts"]} className="w-full col-span-4">
                <AccordionItem value="cohorts">
                    <AccordionTrigger><Users className="mr-2 h-4 w-4 text-accent" />Customer Cohorts</AccordionTrigger>
                    <AccordionContent className="p-4 bg-muted/20">
                        <TagInput
                            label="Cohort"
                            values={productData.customerCohorts || []}
                            predefinedValues={PREDEFINED_CUSTOMER_COHORTS}
                            onValuesChange={(newValues) => handleTagsChange('customerCohorts', newValues)}
                            customInputPlaceholder="Type a new cohort and press Enter"
                        />
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="sales-plans">
                    <AccordionTrigger><Briefcase className="mr-2 h-4 w-4 text-accent" />Sales Plans</AccordionTrigger>
                    <AccordionContent className="p-4 bg-muted/20">
                         <TagInput
                            label="Sales Plan"
                            values={productData.salesPlans || []}
                            predefinedValues={PREDEFINED_SALES_PLANS}
                            onValuesChange={(newValues) => handleTagsChange('salesPlans', newValues)}
                            customInputPlaceholder="Type a new sales plan and press Enter"
                        />
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="plan-configs">
                    <AccordionTrigger><BadgeInfo className="mr-2 h-4 w-4 text-accent" />Special Plan Configurations</AccordionTrigger>
                    <AccordionContent className="p-4 bg-muted/20">
                        <p className="text-xs text-muted-foreground mb-2">These are predefined special configurations. They can be selected but not edited here.</p>
                        <TagInput
                            label="Plan Configuration"
                            values={productData.etPlanConfigurations || []}
                            predefinedValues={PREDEFINED_SPECIAL_CONFIGS}
                            onValuesChange={(newValues) => handleTagsChange('etPlanConfigurations', newValues)}
                            showCustomInput={false}
                        />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
