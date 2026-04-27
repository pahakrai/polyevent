import { Injectable, Logger } from '@nestjs/common';
import { BaseProducer } from '@polydom/kafka-client';
import {
  USER_ACTIVITY_TOPIC,
  UserActivityMessage,
  UserActivityType,
  SEARCH_EVENTS_TOPIC,
  SearchEventMessage,
  RECOMMENDATION_FEEDBACK_TOPIC,
  RecommendationFeedbackMessage,
  LOCATION_CONTEXT_TOPIC,
  LocationContextMessage,
} from '@polydom/kafka-client';

export interface TrackActivityParams {
  userId: string;
  sessionId: string;
  type: UserActivityType;
  metadata?: Record<string, any>;
}

export interface TrackSearchParams {
  userId: string;
  sessionId: string;
  searchId: string;
  query: string;
  filters?: Record<string, any>;
  resultCount?: number;
}

export interface TrackFeedbackParams {
  userId: string;
  sessionId: string;
  recommendationId: string;
  modelId: string;
  modelVersion: string;
  type: 'impression' | 'click' | 'conversion' | 'dismiss';
  placement: { page: string; widget: string; position?: number };
  items: any[];
}

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(private readonly kafkaProducer: BaseProducer) {}

  async trackActivity(params: TrackActivityParams): Promise<void> {
    try {
      const message: UserActivityMessage = {
        userId: params.userId,
        sessionId: params.sessionId,
        type: params.type,
        timestamp: new Date().toISOString(),
        pageUrl: params.metadata?.pageUrl || '',
        userAgent: params.metadata?.userAgent || 'api-gateway',
        metadata: params.metadata || {},
      };

      await this.kafkaProducer.send(USER_ACTIVITY_TOPIC, message, params.userId);
    } catch (error) {
      this.logger.error(`Failed to track activity: ${(error as Error).message}`);
    }
  }

  async trackSearch(params: TrackSearchParams): Promise<void> {
    try {
      const message: SearchEventMessage = {
        userId: params.userId,
        sessionId: params.sessionId,
        searchId: params.searchId,
        type: 'search_performed',
        timestamp: new Date().toISOString(),
        search: {
          query: params.query,
          normalizedQuery: params.query.toLowerCase().trim(),
          filters: {
            category: params.filters?.categories,
            genres: params.filters?.tags,
            location: params.filters?.lat
              ? {
                  latitude: params.filters.lat,
                  longitude: params.filters.lon,
                  radiusKm: params.filters.radiusKm || 20,
                }
              : undefined,
          },
          resultCount: params.resultCount || 0,
          page: params.filters?.page || 1,
        },
      };

      await this.kafkaProducer.send(SEARCH_EVENTS_TOPIC, message, params.userId);
    } catch (error) {
      this.logger.error(`Failed to track search: ${(error as Error).message}`);
    }
  }

  async trackRecommendationFeedback(params: TrackFeedbackParams): Promise<void> {
    try {
      const message: RecommendationFeedbackMessage = {
        userId: params.userId,
        sessionId: params.sessionId,
        recommendationId: params.recommendationId,
        modelId: params.modelId,
        modelVersion: params.modelVersion,
        type: params.type,
        timestamp: new Date().toISOString(),
        placement: params.placement,
        items: params.items,
      };

      await this.kafkaProducer.send(
        RECOMMENDATION_FEEDBACK_TOPIC,
        message,
        params.userId,
      );
    } catch (error) {
      this.logger.error(`Failed to track feedback: ${(error as Error).message}`);
    }
  }

  async trackLocation(params: {
    userId: string;
    sessionId: string;
    type: 'location_search' | 'nearby_search' | 'map_pan' | 'map_zoom';
    location: { latitude: number; longitude: number; city?: string };
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const message: LocationContextMessage = {
        userId: params.userId,
        sessionId: params.sessionId,
        type: params.type,
        timestamp: new Date().toISOString(),
        location: {
          latitude: params.location.latitude,
          longitude: params.location.longitude,
          city: params.location.city,
        },
        search: params.type === 'nearby_search' || params.type === 'location_search'
          ? {
              radiusKm: params.metadata?.radiusKm || 20,
              categories: params.metadata?.categories,
            }
          : undefined,
      };

      await this.kafkaProducer.send(LOCATION_CONTEXT_TOPIC, message, params.userId);
    } catch (error) {
      this.logger.error(`Failed to track location: ${(error as Error).message}`);
    }
  }
}
