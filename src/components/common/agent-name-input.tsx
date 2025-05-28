
"use client";

// This component is now largely superseded by the login system and useAuth.
// It's kept for potential other uses or if a non-authenticated agent name input is needed elsewhere.
// For displaying the current agent, use information from useAuth.

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAgentName } from "@/hooks/use-agent-name"; // Still uses the deprecated hook if used directly
import { User } from "lucide-react";

export function AgentNameInput() {
  const [agentName, setAgentName] = useAgentName();

  return (
    <div className="space-y-1">
      <Label htmlFor="agent-name" className="text-xs text-sidebar-foreground/80 flex items-center gap-1.5">
        <User size={14} />
        Agent Name (Legacy)
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
