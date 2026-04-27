import { Controller, Post, Body, Req } from '@nestjs/common';
import { Request } from 'express';
import { TrackingService } from './tracking.service';

@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post('activity')
  async trackActivity(
    @Body() body: {
      userId: string;
      sessionId: string;
      type: any;
      metadata?: Record<string, any>;
    },
    @Req() req: Request,
  ) {
    await this.trackingService.trackActivity({
      userId: body.userId,
      sessionId: body.sessionId,
      type: body.type,
      metadata: {
        ...body.metadata,
        pageUrl: body.metadata?.pageUrl || req.headers.referer || '',
        userAgent: req.headers['user-agent'] || '',
        ipAddress: (req as any).ip,
      },
    });
    return { status: 'recorded' };
  }

  @Post('search')
  async trackSearch(
    @Body() body: {
      userId: string;
      sessionId: string;
      searchId: string;
      query: string;
      filters?: Record<string, any>;
      resultCount?: number;
    },
  ) {
    await this.trackingService.trackSearch(body);
    return { status: 'recorded' };
  }

  @Post('feedback')
  async trackFeedback(
    @Body() body: {
      userId: string;
      sessionId: string;
      recommendationId: string;
      modelId: string;
      modelVersion: string;
      type: 'impression' | 'click' | 'conversion' | 'dismiss';
      placement: { page: string; widget: string; position?: number };
      items: any[];
    },
  ) {
    await this.trackingService.trackRecommendationFeedback(body);
    return { status: 'recorded' };
  }

  @Post('location')
  async trackLocation(
    @Body() body: {
      userId: string;
      sessionId: string;
      type: 'location_search' | 'nearby_search' | 'map_pan' | 'map_zoom';
      location: { latitude: number; longitude: number; city?: string };
      metadata?: Record<string, any>;
    },
  ) {
    await this.trackingService.trackLocation(body);
    return { status: 'recorded' };
  }
}
