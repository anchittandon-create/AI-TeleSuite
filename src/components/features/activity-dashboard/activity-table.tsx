"use client";

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ActivityLogEntry } from "@/types";
import { format, parseISO } from 'date-fns';
import { Eye, ArrowUpDown } from 'lucide-react';

interface ActivityTableProps {
  activities: ActivityLogEntry[];
}

type SortKey = keyof ActivityLogEntry | null;
type SortDirection = 'asc' | 'desc';

export function ActivityTable({ activities }: ActivityTableProps) {
  const [selectedActivity, setSelectedActivity] = useState<ActivityLogEntry | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleViewDetails = (activity: ActivityLogEntry) => {
    setSelectedActivity(activity);
    setIsDialogOpen(true);
  };

  const sortedActivities = [...activities].sort((a, b) => {
    if (!sortKey) return 0;
    const valA = a[sortKey];
    const valB = b[sortKey];

    let comparison = 0;
    if (valA === undefined || valA === null) comparison = -1;
    else if (valB === undefined || valB === null) comparison = 1;
    else if (valA > valB) comparison = 1;
    else if (valA < valB) comparison = -1;
    
    return sortDirection === 'desc' ? comparison * -1 : comparison;
  });

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortKey === key && sortDirection === 'asc') {
      direction = 'desc';
    }
    setSortKey(key);
    setSortDirection(direction);
  };

  const getSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDirection === 'asc' ? <ArrowUpDown className="ml-2 h-4 w-4 inline transform rotate-180" /> : <ArrowUpDown className="ml-2 h-4 w-4 inline" />;
  };
  
  const formatDetails = (details: any): string => {
    if (typeof details === 'string') return details;
    if (typeof details === 'object' && details !== null) return JSON.stringify(details, null, 2);
    return 'N/A';
  };

  return (
    <>
      <ScrollArea className="h-[calc(100vh-280px)] rounded-md border shadow-sm"> {/* Adjust height as needed */}
        <Table>
          <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm">
            <TableRow>
              <TableHead onClick={() => requestSort('timestamp')} className="cursor-pointer">
                Date {getSortIndicator('timestamp')}
              </TableHead>
              <TableHead onClick={() => requestSort('module')} className="cursor-pointer">
                Module {getSortIndicator('module')}
              </TableHead>
              <TableHead onClick={() => requestSort('product')} className="cursor-pointer">
                Product {getSortIndicator('product')}
              </TableHead>
              <TableHead onClick={() => requestSort('agentName')} className="cursor-pointer">
                Agent {getSortIndicator('agentName')}
              </TableHead>
              <TableHead>Details Preview</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedActivities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No activities logged yet.
                </TableCell>
              </TableRow>
            ) : (
              sortedActivities.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell>{format(parseISO(activity.timestamp), 'PPpp')}</TableCell>
                  <TableCell>{activity.module}</TableCell>
                  <TableCell>{activity.product || 'N/A'}</TableCell>
                  <TableCell>{activity.agentName || 'N/A'}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {formatDetails(activity.details).substring(0,50)}
                    {formatDetails(activity.details).length > 50 && '...'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleViewDetails(activity)}>
                      <Eye className="mr-2 h-4 w-4" /> View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      {selectedActivity && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Activity Details</DialogTitle>
              <DialogDescription>
                Detailed information for activity ID: {selectedActivity.id}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] mt-4 pr-2">
              <div className="space-y-2 text-sm">
                <p><strong>Date:</strong> {format(parseISO(selectedActivity.timestamp), 'PPPP pppp')}</p>
                <p><strong>Module:</strong> {selectedActivity.module}</p>
                <p><strong>Product:</strong> {selectedActivity.product || 'N/A'}</p>
                <p><strong>Agent:</strong> {selectedActivity.agentName || 'N/A'}</p>
                <p><strong>Details:</strong></p>
                <pre className="bg-muted p-2 rounded-md text-xs whitespace-pre-wrap break-all">
                  {formatDetails(selectedActivity.details)}
                </pre>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
