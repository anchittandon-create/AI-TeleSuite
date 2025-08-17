"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ProductObject, CUSTOMER_COHORTS as PREDEFINED_CUSTOMER_COHORTS, SALES_PLANS as PREDEFINED_SALES_PLANS, ET_PLAN_CONFIGURATIONS } from '@/types';
import { Sparkles, Loader2, Users, Briefcase, BadgeInfo, X } from 'lucide-react';
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
}> = ({ label, values, predefinedValues, onValuesChange }) => {
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
        if (!values.includes(value)) {
            onValuesChange([...values, value]);
        }
    };
    
    const remainingPredefined = predefinedValues.filter(pv => !values.includes(pv));

    return (
        <div>
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
                    placeholder={`Type a new ${label.toLowerCase()} and press Enter`}
                />
                <Button type="button" onClick={handleAddValue}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
                {values.map(value => (
                    <Badge key={value} variant="secondary" className="text-sm py-1 pl-3 pr-1">
                        {value}
                        <button type="button" onClick={() => handleRemoveValue(value)} className="ml-2 rounded-full p-0.5 hover:bg-destructive/20 text-destructive">
                            <X size={14}/>
                        </button>
                    </Badge>
                ))}
            </div>
            {remainingPredefined.length > 0 && (
                 <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-1">Add from predefined:</p>
                    <div className="flex flex-wrap gap-1">
                        {remainingPredefined.map(value => (
                             <Button key={value} type="button" size="xs" variant="outline" onClick={() => handlePredefinedClick(value)}>
                                + {value}
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

    const handleCheckboxChange = (type: 'etPlanConfigurations', value: string, checked: boolean) => {
        const currentValues = productData[type] || [];
        const newValues = checked ? [...currentValues, value] : currentValues.filter(v => v !== value);
        updater(prev => ({ ...prev, [type]: newValues }));
    };
    
    const handleTagsChange = (type: 'customerCohorts' | 'salesPlans', newValues: string[]) => {
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
            <Accordion type="multiple" defaultValue={["cohorts", "sales-plans"]} className="w-full col-span-4">
                <AccordionItem value="cohorts">
                    <AccordionTrigger><Users className="mr-2 h-4 w-4 text-accent" />Customer Cohorts</AccordionTrigger>
                    <AccordionContent className="p-4">
                        <TagInput
                            label="Cohort"
                            values={productData.customerCohorts || []}
                            predefinedValues={PREDEFINED_CUSTOMER_COHORTS}
                            onValuesChange={(newValues) => handleTagsChange('customerCohorts', newValues)}
                        />
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="sales-plans">
                    <AccordionTrigger><Briefcase className="mr-2 h-4 w-4 text-accent" />Sales Plans</AccordionTrigger>
                    <AccordionContent className="p-4">
                         <TagInput
                            label="Sales Plan"
                            values={productData.salesPlans || []}
                            predefinedValues={PREDEFINED_SALES_PLANS}
                            onValuesChange={(newValues) => handleTagsChange('salesPlans', newValues)}
                        />
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="et-plans">
                    <AccordionTrigger><BadgeInfo className="mr-2 h-4 w-4 text-accent" />ET Plan Configurations</AccordionTrigger>
                    <AccordionContent>
                        <p className="text-xs text-muted-foreground p-2">These are predefined configurations specific to the ET product.</p>
                        <ScrollArea className="h-24 border rounded-md p-2">
                            <div className="space-y-2">
                                {ET_PLAN_CONFIGURATIONS.map(plan => (
                                    <div key={plan} className="flex items-center space-x-2">
                                        <Checkbox id={`${context}-et-plan-${plan}`} checked={productData.etPlanConfigurations?.includes(plan)} onCheckedChange={(checked) => handleCheckboxChange('etPlanConfigurations', plan, !!checked)} />
                                        <Label htmlFor={`${context}-et-plan-${plan}`} className="text-sm font-normal">{plan}</Label>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
