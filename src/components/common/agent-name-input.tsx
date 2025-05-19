"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAgentName } from "@/hooks/use-agent-name";
import { User } from "lucide-react";

export function AgentNameInput() {
  const [agentName, setAgentName] = useAgentName();

  return (
    <div className="space-y-1">
      <Label htmlFor="agent-name" className="text-xs text-sidebar-foreground/80 flex items-center gap-1.5">
        <User size={14} />
        Agent Name
      </Label>
      <Input
        id="agent-name"
        type="text"
        placeholder="Enter agent name"
        value={agentName}
        onChange={(e) => setAgentName(e.target.value)}
        className="h-8 bg-sidebar-background border-sidebar-border focus:border-primary focus:ring-primary text-sm"
      />
    </div>
  );
}
