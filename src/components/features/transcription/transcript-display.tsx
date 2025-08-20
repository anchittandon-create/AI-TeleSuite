
"use client";

import { cn } from '@/lib/utils';

export const TranscriptDisplay = ({ transcript }: { transcript: string }) => {
  const lines = transcript.split('\n');
  return (
    <div className="text-sm text-foreground whitespace-pre-wrap break-words leading-6">
      {lines.map((line, index) => {
        let style = "text-foreground";
        let content = line;
        
        if (line.trim().startsWith("AGENT:")) {
            style = "text-primary font-semibold";
        } else if (line.trim().startsWith("USER:")) {
            style = "text-green-700 font-semibold";
        } else if (line.trim().startsWith("RINGING:")) {
            style = "text-amber-600 italic";
        } else if (line.trim().startsWith("[")) {
            style = "text-muted-foreground text-xs font-mono pt-3 block";
        } else if (line.trim() === "") {
             return <div key={index} className="h-2" />;
        }
        
        return (
          <span key={index} className={cn(style, "block")}>
            {content}
          </span>
        );
      })}
    </div>
  );
};
