
"use client";

import { cn } from '@/lib/utils';

export const TranscriptDisplay = ({ transcript }: { transcript: string }) => {
  const lines = transcript.split('\n');
  return (
    <p className="text-sm text-foreground whitespace-pre-wrap break-words">
      {lines.map((line, index) => {
        let style = "text-foreground";
        if (line.trim().startsWith("AGENT:")) style = "text-primary font-semibold";
        else if (line.trim().startsWith("USER:")) style = "text-green-700 font-semibold";
        else if (line.trim().startsWith("RINGING:")) style = "text-amber-600 italic";
        else if (line.trim().startsWith("[")) style = "text-muted-foreground text-xs";
        
        return (
          <span key={index} className={cn(style, "block")}>
            {line}
          </span>
        );
      })}
    </p>
  );
};
