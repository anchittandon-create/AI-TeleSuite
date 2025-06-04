
"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ActivityLogEntry, Product, PRODUCTS } from "@/types"; 
import { format } from "date-fns";
import { CalendarIcon, RotateCcw, Check } from "lucide-react"; 
import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";


export interface ActivityFilters {
  dateFrom?: Date;
  dateTo?: Date;
  agentName?: string;
  module?: string;
  product?: Product | "All";
}

interface FiltersProps {
  onFilterChange: (filters: ActivityFilters) => void;
  availableModules: string[];
}

export function ActivityDashboardFilters({ onFilterChange, availableModules }: FiltersProps) {
  // This state now holds the "draft" or "pending" filters
  const [draftFilters, setDraftFilters] = useState<ActivityFilters>({ product: "All" });

  // Removed useEffect that called onFilterChange on every draftFilters change.

  const handleApplyFilters = () => {
    onFilterChange(draftFilters);
  };

  const handleResetFilters = () => {
    const resetState: ActivityFilters = { product: "All" };
    setDraftFilters(resetState);
    onFilterChange(resetState); // Apply reset immediately
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Filter Activities</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label htmlFor="dateFrom">Date From</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !draftFilters.dateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {draftFilters.dateFrom ? format(draftFilters.dateFrom, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={draftFilters.dateFrom}
                  onSelect={(date) => setDraftFilters(prev => ({ ...prev, dateFrom: date || undefined }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <Label htmlFor="dateTo">Date To</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !draftFilters.dateTo && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {draftFilters.dateTo ? format(draftFilters.dateTo, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={draftFilters.dateTo}
                  onSelect={(date) => setDraftFilters(prev => ({ ...prev, dateTo: date || undefined }))}
                  disabled={(date) => draftFilters.dateFrom ? date < draftFilters.dateFrom : false }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <Label htmlFor="agentName">Agent Name</Label>
            <Input
              id="agentName"
              placeholder="Filter by agent name"
              value={draftFilters.agentName || ""}
              onChange={(e) => setDraftFilters(prev => ({ ...prev, agentName: e.target.value }))}
            />
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="module">Module</Label>
            <Select
              value={draftFilters.module || ""}
              onValueChange={(value) => setDraftFilters(prev => ({ ...prev, module: value === "All" ? undefined : value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Modules</SelectItem>
                {availableModules.map(mod => (
                  <SelectItem key={mod} value={mod}>{mod}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="product">Product</Label>
            <Select
              value={draftFilters.product || "All"}
              onValueChange={(value) => setDraftFilters(prev => ({ ...prev, product: value as Product | "All" }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by product (ET / TOI)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Products</SelectItem>
                {PRODUCTS.map(prod => (
                  <SelectItem key={prod} value={prod}>{prod}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-end space-x-2 pt-3 lg:col-start-3"> {/* Aligns buttons to the right on larger screens */}
              {/* Buttons are now grouped together */}
          </div>
        </div>
        <div className="flex justify-end space-x-2 pt-3">
            <Button onClick={handleResetFilters} variant="outline">
                <RotateCcw className="mr-2 h-4 w-4" /> Reset Filters
            </Button>
            <Button onClick={handleApplyFilters}>
                <Check className="mr-2 h-4 w-4" /> Apply Filters
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
