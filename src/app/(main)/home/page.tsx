
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
  ActivityIcon,
  Briefcase,
  Clock,
  Type,
  Sigma,
  BarChart,
  Edit3,
  FilePieChart
} from 'lucide-react';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { useKnowledgeBase, KnowledgeFile } from '@/hooks/use-knowledge-base';
import { useState, useEffect, useMemo } from 'react';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { ActivityLogEntry } from '@/types';
import type { GeneratePitchOutput } from '@/ai/flows/pitch-generator';
import type { ScoreCallOutput } from '@/ai/flows/call-scoring';
import type { TranscriptionOutput } from '@/ai/flows/transcription-flow';
import type { GenerateTrainingDeckOutput } from '@/ai/flows/training-deck-generator';
import type { DataAnalysisReportOutput } from '@/ai/flows/data-analyzer';

interface FeatureWidgetConfig {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
  moduleMatcher?: string | string[]; // Module name(s) in ActivityLogEntry.details
  dataFetcher: (
    activities: ActivityLogEntry[],
    knowledgeBaseFiles: KnowledgeFile[]
  ) => {
    stats: Array<{ label: string; value: string | number; icon?: React.ElementType }>;
    lastActivity?: string;
  } | null;
}

const featureWidgetsConfig: FeatureWidgetConfig[] = [
  {
    href: "/pitch-generator",
    icon: Lightbulb,
    title: "AI Pitch Generator",
    description: "Craft tailored sales pitches.",
    moduleMatcher: "Pitch Generator",
    dataFetcher: (activities) => {
      const pitchActivities = activities.filter(a => 
        a.module === "Pitch Generator" && 
        a.details && typeof a.details === 'object' && 'pitchOutput' in a.details
      );
      const count = pitchActivities.length;
      const lastPitch = pitchActivities[0]?.details as { pitchOutput?: GeneratePitchOutput };
      return {
        stats: [{ label: "Pitches Generated", value: count, icon: Edit3 }],
        lastActivity: lastPitch?.pitchOutput?.pitchTitle ? `Last: ${lastPitch.pitchOutput.pitchTitle.substring(0, 25)}...` : (count > 0 ? "Recent activity" : "No pitches generated yet")
      };
    }
  },
  {
    href: "/rebuttal-generator",
    icon: MessageSquareReply,
    title: "AI Rebuttal Assistant",
    description: "Get intelligent suggestions for objections.",
    moduleMatcher: "Rebuttal Generator",
    dataFetcher: (activities) => {
      const rebuttalActivities = activities.filter(a => a.module === "Rebuttal Generator");
      const count = rebuttalActivities.length;
      const lastRebuttalInput = rebuttalActivities[0]?.details as { inputData?: { objection?: string } };
      return {
        stats: [{ label: "Rebuttals Generated", value: count, icon: Type }],
        lastActivity: lastRebuttalInput?.inputData?.objection ? `Last for: "${lastRebuttalInput.inputData.objection.substring(0, 20)}..."` : (count > 0 ? "Recent activity" : "No rebuttals generated")
      };
    }
  },
  {
    href: "/transcription",
    icon: Mic2,
    title: "Audio Transcription",
    description: "Transcribe audio files with diarization.",
    moduleMatcher: "Transcription",
    dataFetcher: (activities) => {
      const transcriptionActivities = activities.filter(a => a.module === "Transcription" && a.details && typeof a.details === 'object' && 'transcriptionOutput' in a.details && 'fileName' in a.details);
      const count = transcriptionActivities.length;
      const lastTranscription = transcriptionActivities[0]?.details as { fileName?: string, transcriptionOutput?: TranscriptionOutput };
      return {
        stats: [{ label: "Files Transcribed", value: count, icon: Mic2 }],
        lastActivity: lastTranscription?.fileName ? `Last: ${lastTranscription.fileName}` : (count > 0 ? "Recent activity" : "No transcriptions yet")
      };
    }
  },
  {
    href: "/call-scoring",
    icon: ListChecks,
    title: "AI Call Scoring",
    description: "Analyze call recordings for metrics.",
    moduleMatcher: "Call Scoring",
    dataFetcher: (activities) => {
      const scoringActivities = activities.filter(a => a.module === "Call Scoring" && a.details && typeof a.details === 'object' && 'scoreOutput' in a.details);
      const count = scoringActivities.length;
      const lastScored = scoringActivities[0]?.details as { fileName?: string, scoreOutput?: ScoreCallOutput };
      const recentScores = scoringActivities.slice(0, 5).map(a => (a.details as { scoreOutput?: ScoreCallOutput })?.scoreOutput?.overallScore || 0).filter(s => s > 0);
      const avgScore = recentScores.length > 0 ? (recentScores.reduce((sum, s) => sum + s, 0) / recentScores.length).toFixed(1) : "N/A";
      return {
        stats: [
          { label: "Calls Scored", value: count, icon: ListChecks },
          { label: "Avg. Score (Last 5)", value: avgScore, icon: Sigma }
        ],
        lastActivity: lastScored?.fileName ? `Last: ${lastScored.fileName}` : (count > 0 ? "Recent activity" : "No calls scored yet")
      };
    }
  },
  {
    href: "/knowledge-base",
    icon: Database,
    title: "Knowledge Base",
    description: "Manage sales enablement documents.",
    moduleMatcher: "Knowledge Base Management",
    dataFetcher: (activities, kbFiles) => {
      const count = kbFiles.length;
      const lastKbActivity = activities.filter(a => a.module === "Knowledge Base Management")[0];
      let lastAction = "No recent KB activity";
      if (lastKbActivity?.details && typeof lastKbActivity.details === 'object') {
          const details = lastKbActivity.details as any;
          if (details.action === 'add' || details.action === 'add_batch') lastAction = `Added: ${details.name || details.fileData?.name || (details.filesData && details.filesData[0]?.name) || 'entry'}`;
          else if (details.action === 'delete') lastAction = `Deleted an entry`;
          else if (details.action === 'clear_all') lastAction = `Cleared ${details.countCleared} entries`;
          else if (details.action === 'download_full_prompts') lastAction = 'Downloaded AI Prompts';

          if (lastAction.length > 30) lastAction = lastAction.substring(0,27) + "...";

      } else if (count > 0 && kbFiles[0]) {
         lastAction = `Last entry: ${kbFiles.sort((a,b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())[0].name.substring(0,20)}...`;
      }
      return {
        stats: [{ label: "Total Entries", value: count, icon: Database }],
        lastActivity: lastAction
      };
    }
  },
  {
    href: "/create-training-deck",
    icon: BookOpen,
    title: "Training Material Creator",
    description: "Generate training decks or brochures.",
    moduleMatcher: "Create Training Material",
    dataFetcher: (activities) => {
      const materialActivities = activities.filter(a => a.module === "Create Training Material" && a.details && typeof a.details === 'object' && 'materialOutput' in a.details);
      const count = materialActivities.length;
      const lastMaterial = materialActivities[0]?.details as { materialOutput?: GenerateTrainingDeckOutput };
      return {
        stats: [{ label: "Materials Created", value: count, icon: Presentation }],
        lastActivity: lastMaterial?.materialOutput?.deckTitle ? `Last: ${lastMaterial.materialOutput.deckTitle.substring(0, 20)}...` : (count > 0 ? "Recent activity" : "No materials created")
      };
    }
  },
   {
    href: "/data-analysis",
    icon: FileSearch,
    title: "AI Data Analyst",
    description: "Analyze telecalling data for insights.",
    moduleMatcher: "Data Analysis",
    dataFetcher: (activities) => {
      const analysisActivities = activities.filter(a => a.module === "Data Analysis" && a.details && typeof a.details === 'object' && 'analysisOutput' in a.details);
      const count = analysisActivities.length;
      const lastAnalysis = analysisActivities[0]?.details as { analysisOutput?: DataAnalysisReportOutput, inputData?: { userAnalysisPrompt?: string } };
      return {
        stats: [{ label: "Analyses Generated", value: count, icon: BarChart }],
        lastActivity: lastAnalysis?.analysisOutput?.reportTitle ? `Last: ${lastAnalysis.analysisOutput.reportTitle.substring(0,20)}...` : (count > 0 ? "Recent activity" : "No analyses performed")
      };
    }
  },
  // Dashboards - might just link or show total counts from relevant modules
  {
    href: "/activity-dashboard",
    icon: LayoutDashboard,
    title: "Activity Dashboard",
    description: "Monitor all user activities.",
    dataFetcher: (activities) => ({
      stats: [{ label: "Total Logged Activities", value: activities.length, icon: ActivityIcon }],
      lastActivity: activities.length > 0 ? `Last activity: ${formatDistanceToNow(parseISO(activities[0].timestamp), { addSuffix: true })}` : "No activities logged."
    })
  },
  {
    href: "/transcription-dashboard",
    icon: ListTree,
    title: "Transcript Dashboard",
    description: "Review historical transcriptions.",
    moduleMatcher: "Transcription",
    dataFetcher: (activities) => {
      const count = activities.filter(a => a.module === "Transcription").length;
      return {
        stats: [{ label: "Total Transcripts Logged", value: count, icon: ListTree }],
        lastActivity: count > 0 ? `View all ${count} transcripts` : "No transcripts in history."
      };
    }
  },
  {
    href: "/call-scoring-dashboard",
    icon: AreaChart,
    title: "Call Scoring Dashboard",
    description: "Review historical call scoring reports.",
    moduleMatcher: "Call Scoring",
    dataFetcher: (activities) => {
      const count = activities.filter(a => a.module === "Call Scoring").length;
      return {
        stats: [{ label: "Total Calls Scored", value: count, icon: AreaChart }],
        lastActivity: count > 0 ? `View all ${count} reports` : "No scoring reports in history."
      };
    }
  },
  {
    href: "/training-material-dashboard",
    icon: Presentation,
    title: "Material Dashboard",
    description: "View generated training materials.",
    moduleMatcher: "Create Training Material",
    dataFetcher: (activities) => {
      const count = activities.filter(a => a.module === "Create Training Material").length;
      return {
        stats: [{ label: "Total Materials Logged", value: count, icon: Presentation }],
        lastActivity: count > 0 ? `View all ${count} materials` : "No materials in history."
      };
    }
  },
  {
    href: "/data-analysis-dashboard",
    icon: FilePieChart, // Changed from BarChart3 to avoid repetition
    title: "Data Analysis Dashboard",
    description: "View historical data analysis reports.",
    moduleMatcher: "Data Analysis",
    dataFetcher: (activities) => {
      const count = activities.filter(a => a.module === "Data Analysis").length;
      return {
        stats: [{ label: "Total Reports Logged", value: count, icon: FilePieChart }],
        lastActivity: count > 0 ? `View all ${count} reports` : "No analysis reports in history."
      };
    }
  },
];


export default function HomePage() {
  const { activities } = useActivityLogger();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI_TeleSuite Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="container mx-auto">
          <Card className="mb-8 shadow-lg border-primary/20 bg-gradient-to-br from-background to-primary/5">
            <CardHeader>
              <CardTitle className="text-3xl font-bold text-primary flex items-center">
                <Zap className="h-8 w-8 mr-3 text-accent" />
                Welcome to AI_TeleSuite!
              </CardTitle>
              <CardDescription className="text-lg text-muted-foreground">
                Your intelligent partner for boosting telesales productivity and effectiveness. Explore your tools and insights below.
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featureWidgetsConfig.map((feature) => {
              const summaryData = isClient ? feature.dataFetcher(activities, knowledgeBaseFiles) : null;
              const FeatureIcon = feature.icon;

              return (
                <Link key={feature.href} href={feature.href} className="hover:no-underline flex group">
                  <Card className="hover:shadow-xl transition-all duration-300 w-full flex flex-col hover:border-primary/50 transform hover:-translate-y-1 bg-card hover:bg-secondary/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center text-lg font-semibold text-primary group-hover:text-accent transition-colors">
                          <FeatureIcon className="mr-3 h-5 w-5 shrink-0 text-primary group-hover:text-accent transition-colors" />
                          {feature.title}
                        </CardTitle>
                         {/* Optional: Small badge or icon on top right if needed */}
                      </div>
                      <CardDescription className="text-xs text-muted-foreground pt-1 h-10 line-clamp-2">
                        {feature.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow pt-2 space-y-2">
                      {!isClient ? (
                        <>
                          <Skeleton className="h-5 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                        </>
                      ) : summaryData ? (
                        <>
                          {summaryData.stats.map((stat, index) => {
                            const StatIcon = stat.icon;
                            return (
                              <div key={index} className="flex items-center text-sm text-foreground">
                                {StatIcon && <StatIcon className="mr-2 h-4 w-4 text-muted-foreground"/>}
                                <span className="font-medium">{stat.value}</span>
                                <span className="text-muted-foreground ml-1.5 text-xs">{stat.label}</span>
                              </div>
                            );
                          })}
                          {summaryData.lastActivity && (
                            <div className="flex items-center text-xs text-muted-foreground pt-1 border-t border-border/50 mt-2">
                              <Clock className="mr-1.5 h-3.5 w-3.5"/> 
                              <span className="truncate" title={summaryData.lastActivity}>{summaryData.lastActivity}</span>
                            </div>
                          )}
                        </>
                      ) : (
                         <p className="text-xs text-muted-foreground italic">Loading data...</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
           <div className="mt-12 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} AI_TeleSuite. Empowering Sales Teams.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
