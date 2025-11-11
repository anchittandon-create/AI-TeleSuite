"use client";

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { versionOptions, useAppVersion, type AppVersion } from '@/context/app-version-context';
import { Badge } from '@/components/ui/badge';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

export function AppVersionSwitcher() {
  const { appVersion, setAppVersion } = useAppVersion();
  const [isSwitching, setIsSwitching] = useState(false);

  const handleSelect = (value: AppVersion) => {
    if (value === appVersion) return;
    setIsSwitching(true);
    setAppVersion(value);
    setTimeout(() => {
      window.location.reload();
    }, 150);
  };

  const activeLabel = versionOptions.find((opt) => opt.value === appVersion)?.label ?? 'Completely Working Version';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <span className="text-xs font-medium">App Version</span>
          <Badge variant="secondary" className="text-[11px]">
            {isSwitching ? 'Switching…' : activeLabel}
          </Badge>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 text-sm">
        <DropdownMenuLabel>Select version</DropdownMenuLabel>
        {versionOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            className="flex flex-col items-start gap-1 whitespace-normal"
            onClick={() => handleSelect(option.value)}
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-medium text-foreground">{option.label}</span>
              {appVersion === option.value && <Badge variant="outline">Active</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">{option.description}</p>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
