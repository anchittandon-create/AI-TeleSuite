"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ActivityLogEntry, Product, PRODUCTS } from "@/types";
import { format } from "date-fns";
import { CalendarIcon, FilterX, RotateCcw } from "lucide-react";
import React, { useState, useEffect } from "react";

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
  const [filters, setFilters] = useState<ActivityFilters>({ product: "All" });

  useEffect(() => {
    onFilterChange(filters);
  }, [filters, onFilterChange]);

  const handleResetFilters = () => {
    setFilters({ product: "All" });
  };

  return (
    <Card className="mb-6 shadow">
      <CardHeader>
        <CardTitle className="text-lg">Filter Activities</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label htmlFor="dateFrom">Date From</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !filters.dateFrom && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateFrom ? format(filters.dateFrom, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filters.dateFrom}
                onSelect={(date) => setFilters(prev => ({ ...prev, dateFrom: date || undefined }))}
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
                  !filters.dateTo && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateTo ? format(filters.dateTo, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filters.dateTo}
                onSelect={(date) => setFilters(prev => ({ ...prev, dateTo: date || undefined }))}
                disabled={(date) => filters.dateFrom ? date < filters.dateFrom : false }
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
            value={filters.agentName || ""}
            onChange={(e) => setFilters(prev => ({ ...prev, agentName: e.target.value }))}
          />
        </div>
        
        <div className="space-y-1">
          <Label htmlFor="module">Module</Label>
          <Select
            value={filters.module || ""}
            onValueChange={(value) => setFilters(prev => ({ ...prev, module: value === "All" ? undefined : value }))}
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
            value={filters.product || "All"}
            onValueChange={(value) => setFilters(prev => ({ ...prev, product: value as Product | "All" }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Products</SelectItem>
              {PRODUCTS.map(prod => (
                <SelectItem key={prod} value={prod}>{prod}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-end space-x-2">
            <Button onClick={handleResetFilters} variant="outline" className="w-full">
                <RotateCcw className="mr-2 h-4 w-4" /> Reset Filters
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Dummy Card components for compilation, replace with actual imports if needed
const Card = ({className, children}: {className?: string, children: React.ReactNode}) => <div className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}>{children}</div>;
const CardHeader = ({className, children}: {className?: string, children: React.ReactNode}) => <div className={cn("flex flex-col space-y-1.5 p-6", className)}>{children}</div>;
const CardTitle = ({className, children}: {className?: string, children: React.ReactNode}) => <h3 className={cn("text-2xl font-semibold leading-none tracking-tight", className)}>{children}</h3>;
const CardContent = ({className, children}: {className?: string, children: React.ReactNode}) => <div className={cn("p-6 pt-0", className)}>{children}</div>;
const Label = ({htmlFor, className, children}: {htmlFor?: string, className?: string, children: React.ReactNode}) => <label htmlFor={htmlFor} className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}>{children}</label>;
