"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  TrendingUp,
  Play,
  RefreshCw,
  BarChart3,
  Monitor,
  Zap,
  AlertCircle
} from 'lucide-react';
import { useFeatureLogger } from '@/lib/feature-logger';
import { featureTester, FEATURE_REGISTRY, useFeatureTester } from '@/lib/feature-tester';
import type { FeatureTestResult } from '@/lib/feature-tester';
import type { FeatureHealthCheck } from '@/lib/feature-logger';

interface FeatureMonitorProps {
  className?: string;
}

export function FeatureMonitor({ className }: FeatureMonitorProps) {
  const [testResults, setTestResults] = useState<FeatureTestResult[]>([]);
  const [healthChecks, setHealthChecks] = useState<FeatureHealthCheck[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [lastTestRun, setLastTestRun] = useState<string | null>(null);
  
  const { getStats, getHealthChecks, exportMetrics } = useFeatureLogger();
  const { runTests, getSummary } = useFeatureTester();

  // Update health checks periodically
  useEffect(() => {
    const updateHealthChecks = () => {
      setHealthChecks(getHealthChecks());
    };

    updateHealthChecks();
    const interval = setInterval(updateHealthChecks, 10000); // Update every 10 seconds
    
    return () => clearInterval(interval);
  }, [getHealthChecks]);

  const handleRunAllTests = async () => {
    setIsRunningTests(true);
    try {
      const results = await runTests();
      setTestResults(results);
      setLastTestRun(new Date().toISOString());
    } catch (error) {
      console.error('Failed to run tests:', error);
    } finally {
      setIsRunningTests(false);
    }
  };

  const testSummary = getSummary();
  const overallStats = getStats();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
      case 'healthy':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'failed':
      case 'error':
        return 'text-red-600';
      case 'offline':
        return 'text-gray-600';
      default:
        return 'text-blue-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'failed':
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'offline':
        return <Clock className="h-4 w-4 text-gray-600" />;
      default:
        return <Activity className="h-4 w-4 text-blue-600" />;
    }
  };

  const criticalFeatures = FEATURE_REGISTRY.filter(f => f.criticalPath);
  const criticalTestResults = testResults.filter(r => 
    criticalFeatures.some(cf => cf.name === r.featureName)
  );

  return (
    <div className={className}>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Feature Health Monitor</h2>
            <p className="text-muted-foreground">
              Real-time monitoring and testing of all AI-TeleSuite features
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleRunAllTests}
              disabled={isRunningTests}
              className="flex items-center gap-2"
            >
              {isRunningTests ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isRunningTests ? 'Running Tests...' : 'Run All Tests'}
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Features</p>
                  <p className="text-2xl font-bold">{FEATURE_REGISTRY.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Usage</p>
                  <p className="text-2xl font-bold">{overallStats.totalUsage}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Error Rate</p>
                  <p className="text-2xl font-bold">{overallStats.errorRate.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Avg Response</p>
                  <p className="text-2xl font-bold">{overallStats.averageResponseTime.toFixed(0)}ms</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Critical Features Alert */}
        {testSummary.criticalFailures > 0 && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Critical Features Failing</AlertTitle>
            <AlertDescription className="text-red-700">
              {testSummary.criticalFailures} critical feature(s) are currently failing. 
              Immediate attention required to ensure system functionality.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Tabs defaultValue="health" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="health">Health Checks</TabsTrigger>
          <TabsTrigger value="tests">Test Results</TabsTrigger>
          <TabsTrigger value="critical">Critical Path</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Real-time Health Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {healthChecks.length > 0 ? healthChecks.map((check, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(check.status)}
                        <div>
                          <p className="font-medium">{check.featureName}</p>
                          <p className="text-sm text-muted-foreground">
                            Last checked: {new Date(check.lastChecked).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={check.status === 'healthy' ? 'default' : 'destructive'}>
                          {check.status}
                        </Badge>
                        {check.responseTime && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {check.responseTime}ms
                          </p>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No health data available. Start using features to see their health status.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tests" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Test Results
                {lastTestRun && (
                  <span className="text-sm font-normal text-muted-foreground">
                    (Last run: {new Date(lastTestRun).toLocaleString()})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {testResults.length > 0 ? (
                <>
                  <div className="mb-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{testSummary.passed}</p>
                      <p className="text-sm text-muted-foreground">Passed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{testSummary.failed}</p>
                      <p className="text-sm text-muted-foreground">Failed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-600">{testSummary.warnings}</p>
                      <p className="text-sm text-muted-foreground">Warnings</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-600">{testSummary.skipped}</p>
                      <p className="text-sm text-muted-foreground">Skipped</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{testSummary.averageResponseTime.toFixed(0)}ms</p>
                      <p className="text-sm text-muted-foreground">Avg Time</p>
                    </div>
                  </div>
                  <Separator className="my-4" />
                  <ScrollArea className="h-80">
                    <div className="space-y-2">
                      {testResults.map((result, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(result.status)}
                            <div>
                              <p className="font-medium">{result.featureName}</p>
                              <p className="text-sm text-muted-foreground">{result.message}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant={result.status === 'passed' ? 'default' : 'destructive'}>
                              {result.status}
                            </Badge>
                            <p className="text-sm text-muted-foreground mt-1">
                              {result.duration}ms
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Play className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No test results available. Click "Run All Tests" to start testing features.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="critical" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Critical Path Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {criticalFeatures.map((feature, index) => {
                  const testResult = criticalTestResults.find(r => r.featureName === feature.name);
                  const healthCheck = healthChecks.find(h => h.featureName === feature.name);
                  
                  return (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{feature.name}</h3>
                        <div className="flex items-center gap-2">
                          {testResult && getStatusIcon(testResult.status)}
                          {healthCheck && (
                            <Badge variant={healthCheck.status === 'healthy' ? 'default' : 'destructive'}>
                              {healthCheck.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{feature.description}</p>
                      {testResult && (
                        <div className="text-sm">
                          <span className={`font-medium ${getStatusColor(testResult.status)}`}>
                            {testResult.message}
                          </span>
                          {testResult.error && (
                            <p className="text-red-600 mt-1">{testResult.error.message}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Usage Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">Top Actions</h3>
                  {overallStats.topActions.slice(0, 5).map((action, index) => (
                    <div key={index} className="flex items-center justify-between mb-2">
                      <span className="text-sm">{action.action}</span>
                      <div className="flex items-center gap-2">
                        <Progress value={(action.count / overallStats.totalUsage) * 100} className="w-20" />
                        <span className="text-sm font-medium">{action.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="font-semibold mb-3">Performance Metrics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Average Response Time</p>
                      <p className="text-2xl font-bold">{overallStats.averageResponseTime.toFixed(2)}ms</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Error Rate</p>
                      <p className="text-2xl font-bold text-red-600">{overallStats.errorRate.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
