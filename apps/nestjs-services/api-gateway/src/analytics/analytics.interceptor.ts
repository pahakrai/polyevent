import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TrackingService } from '../tracking/tracking.service';

/**
 * Automatically produces Kafka events for tracked API routes.
 *
 * Maps route patterns to user-activity event types:
 *   GET  /events/search        → search
 *   GET  /events/:id           → event_view
 *   GET  /events/category/:cat → category_browse
 *   GET  /events/nearby        → location_browse
 *
 * The interceptor fires AFTER the handler completes (via tap),
 * so resultCount and other response-derived metadata is available.
 */
@Injectable()
export class AnalyticsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AnalyticsInterceptor.name);

  constructor(private readonly trackingService: TrackingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const path = request.url?.split('?')[0] || '';
    const method = request.method;

    return next.handle().pipe(
      tap((responseBody) => {
        try {
          this.trackIfRelevant(method, path, request, responseBody);
        } catch (error) {
          this.logger.warn(`Analytics interceptor error: ${(error as Error).message}`);
        }
      }),
    );
  }

  private trackIfRelevant(
    method: string,
    path: string,
    request: any,
    responseBody: any,
  ): void {
    const userId = request.headers['x-user-id'] || 'anonymous';
    const sessionId = request.headers['x-session-id'] || 'unknown';

    // Search events — GET /events/search?query=...
    if (method === 'GET' && path.includes('/events/search') && request.query?.query) {
      const query = request.query.query;
      this.trackingService.trackSearch({
        userId,
        sessionId,
        searchId: `search_${Date.now()}_${userId}`,
        query,
        filters: {
          categories: request.query.categories?.split(','),
          tags: request.query.tags?.split(','),
          lat: request.query.lat ? parseFloat(request.query.lat) : undefined,
          lon: request.query.lon ? parseFloat(request.query.lon) : undefined,
          radiusKm: request.query.radiusKm ? parseInt(request.query.radiusKm) : undefined,
          page: request.query.page ? parseInt(request.query.page) : undefined,
        },
        resultCount: responseBody?.total || responseBody?.data?.length || 0,
      });
      return;
    }

    // Event detail view — GET /events/:id (matches /events/<non-search-uuid>)
    if (method === 'GET' && /^\/events\/[a-zA-Z0-9-]+$/.test(path)) {
      const eventId = path.split('/').pop()!;
      this.trackingService.trackActivity({
        userId,
        sessionId,
        type: 'event_view',
        metadata: {
          eventId,
          pageUrl: request.url,
          userAgent: request.headers['user-agent'],
        },
      });
      return;
    }

    // Category browse — GET /events/category/:name
    if (method === 'GET' && path.includes('/events/category/')) {
      const category = path.split('/events/category/')[1];
      this.trackingService.trackActivity({
        userId,
        sessionId,
        type: 'category_browse',
        metadata: { category, pageUrl: request.url },
      });
      return;
    }

    // Nearby/location browse — GET /events/nearby?lat=&lon=
    if (method === 'GET' && path.includes('/events/nearby')) {
      this.trackingService.trackLocation({
        userId,
        sessionId,
        type: 'nearby_search',
        location: {
          latitude: parseFloat(request.query.lat || '0'),
          longitude: parseFloat(request.query.lon || '0'),
        },
        metadata: {
          radiusKm: parseInt(request.query.radiusKm || '20'),
        },
      });
      return;
    }

    // Recommendation feedback — POST /tracking/feedback is handled by the controller directly
  }
}
