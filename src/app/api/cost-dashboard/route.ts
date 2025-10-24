/**
 * Cost Dashboard API - Monitor and analyze AI usage costs
 */
import { NextRequest, NextResponse } from 'next/server';
import { costMonitor } from '@/lib/cost-monitor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    const dailyUsage = costMonitor.getDailyUsage();
    const cacheHitRate = costMonitor.getCacheHitRate();
    const topDrivers = costMonitor.getTopCostDrivers();
    const suggestions = costMonitor.getOptimizationSuggestions();

    const dashboard = {
      summary: {
        dailyUsage,
        totalDailyCost: Object.values(dailyUsage).reduce((a, b) => a + b, 0),
        cacheHitRate: Math.round(cacheHitRate * 100) / 100,
        topCostDrivers: topDrivers,
        optimizationSuggestions: suggestions
      },
      timestamp: new Date().toISOString(),
      status: 'success'
    };

    if (format === 'export') {
      const exportData = costMonitor.exportMetrics();
      
      return new NextResponse(exportData, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="ai-cost-analysis-${new Date().toISOString().split('T')[0]}.json"`
        }
      });
    }

    return NextResponse.json(dashboard);
    
  } catch (error) {
    console.error('Cost dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to generate cost dashboard' },
      { status: 500 }
    );
  }
}