
"use client";

import { useState } from 'react';
import { PageHeader } from "@/components/layout/page-header";
import { useKnowledgeBase } from "@/hooks/use-knowledge-base";
import { KnowledgeBaseTable } from "@/components/features/knowledge-base/knowledge-base-table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useActivityLogger } from "@/hooks/use-activity-logger";

export default function KnowledgeBaseDashboardPage() {
    const { files, deleteFile, setFiles } = useKnowledgeBase();
    const { toast } = useToast();
    const { logActivity } = useActivityLogger();
    const [isClearAlertOpen, setIsClearAlertOpen] = useState(false);

    const handleDeleteFile = (fileId: string) => {
        const fileName = files.find(f => f.id === fileId)?.name || "Unknown file";
        deleteFile(fileId);
        toast({
        title: "Entry Deleted",
        description: `"${fileName}" has been removed from the knowledge base.`,
        });
        logActivity({
            module: "Knowledge Base Management",
            details: { action: "delete", fileId, name: fileName }
        });
    };

    const handleClearAllKnowledgeBase = () => {
        const count = files.length;
        setFiles([]);
        toast({
        title: "Knowledge Base Cleared",
        description: `${count} entr(y/ies) have been removed.`,
        });
        logActivity({
            module: "Knowledge Base Management",
            details: { action: "clear_all", countCleared: count }
        });
        setIsClearAlertOpen(false);
    };

    return (
        <div className="flex flex-col h-full">
            <PageHeader title="View Knowledge Base Dashboard" />
            <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-6">
                <div className="w-full max-w-4xl flex justify-end">
                     <AlertDialog open={isClearAlertOpen} onOpenChange={setIsClearAlertOpen}>
                        <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={files.length === 0}>
                            <Trash2 className="mr-2 h-4 w-4" /> Clear All Entries
                        </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete all 
                            ({files.length}) entries from your knowledge base.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleClearAllKnowledgeBase} className="bg-destructive hover:bg-destructive/90">
                                Yes, delete all
                            </AlertDialogAction>
                        </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
                <KnowledgeBaseTable files={files} onDeleteFile={handleDeleteFile} />
            </main>
        </div>
    );
}
