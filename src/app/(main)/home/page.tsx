
"use client";

import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Lightbulb, 
  MessageSquareReply, 
  LayoutDashboard, 
  Database, 
  BookOpen, 
  ListChecks, 
  Mic2, 
  AreaChart, 
  FileSearch, 
  BarChart3,
  Presentation,
  Zap,
  ListTree,
  TrendingUp,
  ActivityIcon,
  Briefcase
} from 'lucide-react';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { useState, useEffect, useMemo } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const features = [
  { href: "/pitch-generator", icon: Lightbulb, title: "AI Pitch Generator", description: "Craft tailored sales pitches for your audience and product.", label: "Pitch Gen" },
  { href: "/rebuttal-generator", icon: MessageSquareReply, title: "AI Rebuttal Assistant", description: "Get intelligent suggestions to counter customer objections.", label: "Rebuttals" },
  { href: "/transcription", icon: Mic2, title: "Audio Transcription", description: "Transcribe audio files with speaker diarization.", label: "Transcribe" },
  { href: "/transcription-dashboard", icon: ListTree, title: "Transcript Dashboard", description: "Review historical transcriptions and download.", label: "Transcript DB" },
  { href: "/call-scoring", icon: ListChecks, title: "AI Call Scoring", description: "Analyze call recordings for metrics and feedback.", label: "Call Score" },
  { href: "/call-scoring-dashboard", icon: AreaChart, title: "Call Scoring Dashboard", description: "Review historical call scoring analysis.", label: "Scoring DB" },
  { href: "/knowledge-base", icon: Database, title: "Knowledge Base", description: "Manage sales enablement documents and text entries.", label: "Knowledge Base" },
  { href: "/create-training-deck", icon: BookOpen, title: "Training Material Creator", description: "Generate training decks or brochures from knowledge.", label: "Train Create" },
  { href: "/training-material-dashboard", icon: Presentation, title: "Training Material Dashboard", description: "View generated training materials.", label: "Material DB" },
  { href: "/data-analysis", icon: FileSearch, title: "Telecalling Data Analysis", description: "Analyze telecalling data for insights.", label: "Data Analysis" },
  { href: "/data-analysis-dashboard", icon: BarChart3, title: "Data Analysis Dashboard", description: "View history of data analyses and findings.", label: "Analysis DB" },
  { href: "/activity-dashboard", icon: LayoutDashboard, title: "Activity Dashboard", description: "Monitor all activities across AI_TeleSuite modules.", label: "Activity DB" },
];

function OverviewCard() {
  const { activities } = useActivityLogger();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const uniqueModulesUsed = useMemo(() => {
    if (!isClient || !activities) return 0;
    const modules = new Set(activities.map(a => a.module));
    return modules.size;
  }, [activities, isClient]);

  const recentActivities = useMemo(() => {
    if (!isClient || !activities) return [];
    return activities.slice(0, 3);
  }, [activities, isClient]);

  const totalKnowledgeBaseEntries = isClient ? knowledgeBaseFiles.length : 0;

  if (!isClient) {
    return (
      <Card className="mb-8 shadow-lg border-accent/20">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-accent flex items-center">
            <TrendingUp className="h-6 w-6 mr-3" />
            Quick Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <div>
            <Skeleton className="h-5 w-1/4 mb-2" />
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const getModuleIcon = (moduleName: string) => {
    const feature = features.find(f => f.title.toLowerCase().includes(moduleName.toLowerCase().split(" ")[0]) || f.label?.toLowerCase().includes(moduleName.toLowerCase().split(" ")[0]));
    if (feature) return <feature.icon className="h-4 w-4 mr-2 text-primary shrink-0" />;
    return <ActivityIcon className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />;
  };

  return (
     <Card className="mb-8 shadow-lg border border-accent/30 bg-gradient-to-br from-background to-accent/5 hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-accent flex items-center">
          <TrendingUp className="h-6 w-6 mr-3" />
          Quick Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center p-3 bg-background/70 rounded-md shadow-sm border border-border">
            <Database className="h-5 w-5 mr-3 text-primary" />
            <div>
              <p className="font-medium text-foreground">{totalKnowledgeBaseEntries} Entries</p>
              <p className="text-xs text-muted-foreground">In Knowledge Base</p>
            </div>
          </div>
          <div className="flex items-center p-3 bg-background/70 rounded-md shadow-sm border border-border">
            <Briefcase className="h-5 w-5 mr-3 text-primary" />
             <div>
              <p className="font-medium text-foreground">{uniqueModulesUsed} Modules</p>
              <p className="text-xs text-muted-foreground">Used Recently</p>
            </div>
          </div>
        </div>
        
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2 flex items-center">
            <ActivityIcon className="h-5 w-5 mr-2 text-primary" />
            Recent Activities
          </h4>
          {recentActivities.length > 0 ? (
            <ul className="space-y-2">
              {recentActivities.map(activity => (
                <li key={activity.id} className="text-xs p-2.5 bg-background/70 rounded-md shadow-sm hover:bg-muted/20 transition-colors border border-border">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-foreground flex items-center">
                       {getModuleIcon(activity.module)}
                       {activity.module}
                       {activity.product && <Badge variant="outline" className="ml-2 text-xs">{activity.product}</Badge>}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(parseISO(activity.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                   {activity.details && typeof activity.details === 'object' && 'fileName' in activity.details && (
                    <p className="text-muted-foreground mt-0.5 truncate">File: {(activity.details as any).fileName}</p>
                  )}
                   {activity.details && typeof activity.details === 'object' && 'pitchOutput' in activity.details && 'pitchTitle' in (activity.details as any).pitchOutput && (
                     <p className="text-muted-foreground mt-0.5 truncate">Pitch: {(activity.details as any).pitchOutput.pitchTitle}</p>
                   )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No activities logged yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


export default function HomePage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Home Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="container mx-auto">
          <Card className="mb-8 shadow-lg border-primary/20 bg-gradient-to-br from-background to-primary/5">
            <CardHeader>
              <CardTitle className="text-3xl font-bold text-primary flex items-center">
                <Zap className="h-8 w-8 mr-3 text-accent" />
                Welcome to AI_TeleSuite!
              </CardTitle>
              <CardDescription className="text-lg text-muted-foreground">
                Your intelligent partner for boosting telesales productivity and effectiveness.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-foreground">
                AI_TeleSuite leverages cutting-edge AI to help you craft compelling pitches, generate smart rebuttals,
                analyze call performance, manage your sales knowledge efficiently, and gain insights from your data. 
                Explore the modules below to get started.
              </p>
            </CardContent>
          </Card>

          <OverviewCard />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Link key={feature.href} href={feature.href} className="hover:no-underline flex group">
                <Card className="hover:shadow-xl transition-all duration-300 w-full flex flex-col hover:border-primary/50 transform hover:-translate-y-1 bg-card hover:bg-secondary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center text-lg font-semibold text-primary group-hover:text-accent transition-colors">
                      <feature.icon className="mr-3 h-5 w-5 shrink-0 text-primary group-hover:text-accent transition-colors" />
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow pt-0">
                    <p className="text-muted-foreground text-sm">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
           <div className="mt-12 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} AI_TeleSuite. Empowering Sales Teams.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
