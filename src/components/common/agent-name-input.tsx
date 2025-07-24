
"use client";

// This component is deprecated and should not be used.
// User context is handled by useUserProfile.
// This file is kept to prevent build errors from potential lingering imports,
// but it should ideally be deleted if no longer imported anywhere.

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserProfile } from "@/hooks/useUserProfile";
import { User } from "lucide-react";

export function AgentNameInput() {
  const { currentProfile } = useUserProfile();

  return (
    <div className="space-y-1">
      <Label htmlFor="agent-name" className="text-xs text-sidebar-foreground/80 flex items-center gap-1.5">
        <User size={14} />
        Current Profile
      </Label>
      <Input
        id="agent-name"
        type="text"
        readOnly
        value={currentProfile}
        className="h-8 bg-sidebar-background border-sidebar-border focus:border-primary focus:ring-primary text-sm cursor-default"
      />
    </div>
  );
}
