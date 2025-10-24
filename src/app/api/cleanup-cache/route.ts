/**
 * Cache cleanup endpoint to prevent memory bloat
 * Automatically called by Vercel cron job daily
 */
import { NextRequest, NextResponse } from 'next/server';
import { aiCache } from '@/lib/ai-cache';

export async function GET(request: NextRequest) {
  try {
    const stats = aiCache.getStats();
    
    // Clear expired entries
    aiCache.clear();
    
    console.log('🧹 Cache cleanup completed:', stats);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Cache cleanup completed',
      previousStats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cache cleanup failed:', error);
    return NextResponse.json(
      { success: false, error: 'Cache cleanup failed' },
      { status: 500 }
    );
  }
}