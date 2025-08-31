
"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PitchCard } from '@/components/features/pitch-generator/pitch-card';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { useToast } from '@/hooks/use-toast';
import { GeneratePitchOutput, Product } from '@/types';
import { Save, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface OptimizedPitchesDialogProps {
    isOpen: boolean;
    onClose: () => void;
    product: string;
    optimizedPitches: { cohort: string; pitch: GeneratePitchOutput }[];
}

export function OptimizedPitchesDialog({ isOpen, onClose, product, optimizedPitches }: OptimizedPitchesDialogProps) {
    const { addFile } = useKnowledgeBase();
    const { toast } = useToast();
    const [savedCohorts, setSavedCohorts] = useState<string[]>([]);
    
    const formatPitchForKb = (pitch: GeneratePitchOutput) => {
        let content = `Title: ${pitch.pitchTitle}\n\n`;
        content += `## Full Script\n${pitch.fullPitchScript}\n\n`;
        content += `## Introduction\n${pitch.warmIntroduction}\n\n`;
        content += `## Hook\n${pitch.personalizedHook}\n\n`;
        content += `## Product Explanation\n${pitch.productExplanation}\n\n`;
        content += `## Key Benefits\n${pitch.keyBenefitsAndBundles}\n\n`;
        content += `## Offer\n${pitch.discountOrDealExplanation}\n\n`;
        content += `## Objection Previews\n${pitch.objectionHandlingPreviews}\n\n`;
        content += `## Call to Action\n${pitch.finalCallToAction}\n\n`;
        if (pitch.notesForAgent) {
            content += `## Agent Notes\n${pitch.notesForAgent}\n`;
        }
        return content;
    };

    const handleSaveToKB = (cohort: string, pitch: GeneratePitchOutput) => {
        const content = formatPitchForKb(pitch);
        const entryName = `Optimized Pitch: ${pitch.pitchTitle}`;

        addFile({
            name: entryName,
            type: 'text/plain',
            size: content.length,
            product: product,
            persona: cohort,
            category: 'Pitch',
            textContent: content,
            isTextEntry: true,
        });

        setSavedCohorts(prev => [...prev, cohort]);
        toast({
            title: 'Pitch Saved to Knowledge Base',
            description: `"${entryName}" saved for cohort: ${cohort}.`,
        });
    };

    const allPitchesHadErrors = optimizedPitches.every(p => p.pitch.pitchTitle.includes("Error"));

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-4xl md:max-w-5xl lg:max-w-6xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-4 pb-3 border-b sticky top-0 bg-background z-10">
                    <DialogTitle className="text-xl text-primary">Optimized Sales Pitches for '{product}'</DialogTitle>
                    <DialogDescription>
                        Based on the combined call analysis, here are optimized pitches for each customer cohort. You can save them to your Knowledge Base.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-grow p-4 overflow-y-auto">
                    {allPitchesHadErrors ? (
                        <div className="text-center py-10 text-muted-foreground">
                            <p>Could not generate optimized pitches due to errors.</p>
                            <p>Please check the console logs from the generation attempt.</p>
                        </div>
                    ) : (
                        <Accordion type="multiple" defaultValue={[optimizedPitches[0]?.cohort]} className="w-full space-y-2">
                        {optimizedPitches.map(({ cohort, pitch }, index) => (
                            <AccordionItem value={cohort} key={`${cohort}-${index}`}>
                                <AccordionTrigger className="text-md font-semibold hover:no-underline bg-muted/30 px-4 py-2 rounded-md">
                                    <div className="flex justify-between items-center w-full pr-2">
                                        <span>Cohort: {cohort}</span>
                                        {pitch.pitchTitle.includes("Error") ? (
                                            <Badge variant="destructive">Error</Badge>
                                        ) : (
                                             <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => {
                                                    e.stopPropagation(); // prevent accordion from toggling
                                                    handleSaveToKB(cohort, pitch);
                                                }}
                                                disabled={savedCohorts.includes(cohort)}
                                            >
                                                {savedCohorts.includes(cohort) ? <Check className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                                                {savedCohorts.includes(cohort) ? 'Saved' : 'Save to KB'}
                                            </Button>
                                        )}
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-3 px-1">
                                    <PitchCard pitch={pitch} />
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                    )}
                </ScrollArea>
                <DialogFooter className="p-3 border-t bg-muted/50 sticky bottom-0">
                    <Button onClick={onClose} size="sm">Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
