
"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { KnowledgeFile } from '@/types';
import { format, parseISO } from 'date-fns';
import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface KnowledgeBaseSelectorDialogProps {
    isOpen: boolean;
    onClose: () => void;
    allKbFiles: KnowledgeFile[];
    selectedFileIds: string[];
    onSelectionChange: (ids: string[]) => void;
    productName: string;
}

export function KnowledgeBaseSelectorDialog({ 
    isOpen, 
    onClose, 
    allKbFiles, 
    selectedFileIds, 
    onSelectionChange, 
    productName 
}: KnowledgeBaseSelectorDialogProps) {

    const handleCheckboxChange = (id: string, checked: boolean) => {
        if (checked) {
            onSelectionChange([...selectedFileIds, id]);
        } else {
            onSelectionChange(selectedFileIds.filter(fileId => fileId !== id));
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl md:max-w-3xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-primary">Select Knowledge Base Files for '{productName}'</DialogTitle>
                    <DialogDescription>
                        Choose specific files to use as the primary context for this interaction. The AI will prioritize this selection.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-y-auto -mx-6 px-6 py-2 border-y">
                  <ScrollArea className="h-[55vh] pr-4">
                      <div className="space-y-2">
                          {allKbFiles.length === 0 ? (
                              <div className="text-center py-10 text-muted-foreground">
                                  <p>No Knowledge Base files found for this product.</p>
                                  <p className="text-xs mt-1">You can add files on the "Knowledge Base Management" page.</p>
                              </div>
                          ) : (
                              allKbFiles.map(file => (
                                  <div 
                                      key={file.id} 
                                      className="flex items-start space-x-3 p-3 border rounded-md hover:bg-muted/50 cursor-pointer"
                                      onClick={() => handleCheckboxChange(file.id, !selectedFileIds.includes(file.id))}
                                  >
                                      <Checkbox
                                          id={`kb-select-${file.id}`}
                                          checked={selectedFileIds.includes(file.id)}
                                          onCheckedChange={(checked) => handleCheckboxChange(file.id, !!checked)}
                                          className="mt-1"
                                      />
                                      <label htmlFor={`kb-select-${file.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer">
                                          <div className="font-semibold flex items-center">
                                            <FileText size={14} className="mr-2 text-muted-foreground"/>
                                            {file.name}
                                          </div>
                                          <div className="text-xs text-muted-foreground ml-6 mt-1 flex flex-wrap gap-2 items-center">
                                              {file.category && <Badge variant="outline">{file.category}</Badge>}
                                              <span>{file.isTextEntry ? `${file.size} chars` : 'File'}</span>
                                              <span>{format(parseISO(file.uploadDate), 'PP')}</span>
                                          </div>
                                      </label>
                                  </div>
                              ))
                          )}
                      </div>
                  </ScrollArea>
                </div>
                <DialogFooter className="pt-4">
                    <span className="text-sm text-muted-foreground mr-auto">{selectedFileIds.length} of {allKbFiles.length} selected</span>
                    <Button variant="outline" onClick={() => onSelectionChange([])}>Clear Selection</Button>
                    <Button onClick={onClose}>Confirm Selection</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
