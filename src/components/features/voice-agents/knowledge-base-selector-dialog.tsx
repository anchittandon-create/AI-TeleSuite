
"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { KnowledgeFile, CustomerCohort } from '@/types';
import { format, parseISO } from 'date-fns';
import { useProductContext } from '@/hooks/useProductContext';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';

interface KnowledgeBaseSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSelection: (selectedIds: string[]) => void;
  selectedProduct: string;
  selectedCohort?: CustomerCohort;
  selectedSalesPlan?: string;
  initialSelectedIds: string[];
}

export function KnowledgeBaseSelectorDialog({
  isOpen,
  onClose,
  onConfirmSelection,
  selectedProduct,
  selectedCohort,
  selectedSalesPlan,
  initialSelectedIds,
}: KnowledgeBaseSelectorDialogProps) {
  const { files: allKbFiles } = useKnowledgeBase();
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(initialSelectedIds);

  const productFiles = allKbFiles.filter(f => f.product === selectedProduct);

  const suggestedFiles = React.useMemo(() => {
    return productFiles
        .map(file => {
            let score = 0;
            const lowerName = file.name.toLowerCase();
            const lowerContent = file.textContent?.toLowerCase() || '';
            const lowerCategory = file.category?.toLowerCase() || '';

            if (selectedCohort && file.persona === selectedCohort) score += 20;
            if (selectedCohort && lowerContent.includes(selectedCohort.toLowerCase())) score += 5;

            if (lowerCategory === 'pitch') score += 15;
            if (lowerCategory === 'rebuttals') score += 10;
            if (lowerCategory === 'product description') score += 8;
            
            if (selectedSalesPlan && (lowerName.includes(selectedSalesPlan.toLowerCase()) || lowerContent.includes(selectedSalesPlan.toLowerCase()))) {
                score += 10;
            }
            if (lowerName.includes('pricing') || lowerCategory === 'pricing') score += 5;

            const recency = (new Date().getTime() - new Date(file.uploadDate).getTime()) / (1000 * 3600 * 24);
            if (recency < 30) score += 2;
            
            return { ...file, score };
        })
        .filter(file => file.score > 0)
        .sort((a, b) => b.score - a.score);
  }, [productFiles, selectedCohort, selectedSalesPlan]);
  
  useEffect(() => {
    setLocalSelectedIds(initialSelectedIds);
  }, [initialSelectedIds, isOpen]);

  const handleToggleFile = (id: string) => {
    setLocalSelectedIds(prev =>
      prev.includes(id) ? prev.filter(fileId => fileId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setLocalSelectedIds(productFiles.map(f => f.id));
  };
  
  const handleSelectSuggested = () => {
     setLocalSelectedIds(suggestedFiles.map(f => f.id));
  };

  const handleConfirm = () => {
    onConfirmSelection(localSelectedIds);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-3 border-b sticky top-0 bg-background z-10">
          <DialogTitle>Select Knowledge Base Files for Context</DialogTitle>
          <DialogDescription>
            Choose files for '{selectedProduct}'. The AI will use these to ground its responses.
          </DialogDescription>
        </DialogHeader>
        <div className="p-4 flex-grow overflow-y-hidden flex flex-col gap-4">
             <div className="flex gap-2 flex-wrap">
                <Button onClick={handleSelectAll} size="sm" variant="outline">Select All ({productFiles.length})</Button>
                <Button onClick={handleSelectSuggested} size="sm" variant="outline">Select Suggested ({suggestedFiles.length})</Button>
                <Button onClick={() => setLocalSelectedIds([])} size="sm" variant="outline">Deselect All</Button>
            </div>
            <p className="text-xs text-muted-foreground">Selected {localSelectedIds.length} of {productFiles.length} file(s).</p>
            <ScrollArea className="flex-grow border rounded-md p-2">
            {productFiles.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">No Knowledge Base files found for this product.</div>
            ) : (
                <div className="space-y-2">
                {productFiles.map(file => (
                    <div
                        key={file.id}
                        className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleToggleFile(file.id)}
                    >
                    <Checkbox
                        id={`kb-select-${file.id}`}
                        checked={localSelectedIds.includes(file.id)}
                        onCheckedChange={() => handleToggleFile(file.id)}
                    />
                    <Label htmlFor={`kb-select-${file.id}`} className="flex-grow cursor-pointer">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold">{file.name}</span>
                             {suggestedFiles.some(sf => sf.id === file.id) && <Badge variant="secondary" className="text-xs">Suggested</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Category: {file.category || "General"} | Persona: {file.persona || "Universal"} | Uploaded: {format(parseISO(file.uploadDate), 'PP')}
                        </p>
                    </Label>
                    </div>
                ))}
                </div>
            )}
            </ScrollArea>
        </div>
        <DialogFooter className="p-3 border-t bg-muted/50 sticky bottom-0">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleConfirm}>Confirm Selection ({localSelectedIds.length})</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
