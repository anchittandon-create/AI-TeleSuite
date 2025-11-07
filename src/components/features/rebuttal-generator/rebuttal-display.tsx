"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { GenerateRebuttalOutput } from "@/types";
import { Copy } from "lucide-react";

interface RebuttalDisplayProps {
  rebuttal: GenerateRebuttalOutput;
}

export function RebuttalDisplay({ rebuttal }: RebuttalDisplayProps) {
  const { toast } = useToast();

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(rebuttal.rebuttal)
      .then(() => toast({ title: "Success", description: "Rebuttal copied to clipboard!" }))
      .catch(() => toast({ variant: "destructive", title: "Error", description: "Failed to copy rebuttal." }));
  };

  return (
    <Card className="w-full max-w-lg shadow-xl mt-8">
      <CardHeader>
        <CardTitle className="text-xl text-primary">Suggested Rebuttal</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
          {rebuttal.rebuttal}
        </p>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={handleCopyToClipboard}>
            <Copy className="mr-2 h-4 w-4" /> Copy Rebuttal
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
