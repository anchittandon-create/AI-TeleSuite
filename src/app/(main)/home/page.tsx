
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
  ListTree // Added ListTree
} from 'lucide-react';

// Order matches AppSidebar functional grouping (excluding Home itself)
const features = [
  { href: "/pitch-generator", icon: Lightbulb, title: "AI Pitch Generator", description: "Craft tailored sales pitches for your audience and product." },
  { href: "/rebuttal-generator", icon: MessageSquareReply, title: "AI Rebuttal Assistant", description: "Get intelligent suggestions to counter customer objections." },
  { href: "/transcription", icon: Mic2, title: "Audio Transcription", description: "Transcribe audio files with speaker diarization." },
  { href: "/transcription-dashboard", icon: ListTree, title: "Transcript Dashboard", description: "Review historical transcriptions and download." }, // Added
  { href: "/call-scoring", icon: ListChecks, title: "AI Call Scoring", description: "Analyze call recordings for metrics and feedback." },
  { href: "/call-scoring-dashboard", icon: AreaChart, title: "Call Scoring Dashboard", description: "Review historical call scoring analysis." },
  { href: "/knowledge-base", icon: Database, title: "Knowledge Base", description: "Manage sales enablement documents and text entries." },
  { href: "/create-training-deck", icon: BookOpen, title: "Training Material Creator", description: "Generate training decks or brochures from knowledge." },
  { href: "/training-material-dashboard", icon: Presentation, title: "Training Material Dashboard", description: "View generated training materials." },
  { href: "/data-analysis", icon: FileSearch, title: "Telecalling Data Analysis", description: "Analyze telecalling data (CSV, TXT) for insights." },
  { href: "/data-analysis-dashboard", icon: BarChart3, title: "Data Analysis Dashboard", description: "View history of data analyses and findings." },
  { href: "/activity-dashboard", icon: LayoutDashboard, title: "Activity Dashboard", description: "Monitor all activities across AI_TeleSuite modules." },
];

export default function HomePage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Home" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="container mx-auto">
          <Card className="mb-8 shadow-lg border-primary/20">
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Link key={feature.href} href={feature.href} className="hover:no-underline flex">
                <Card className="hover:shadow-xl transition-shadow duration-300 w-full flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center text-xl text-primary">
                      <feature.icon className="mr-3 h-6 w-6 shrink-0" />
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow">
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
