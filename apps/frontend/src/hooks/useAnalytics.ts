'use client';

import { useCallback, useRef } from 'react';
import { useSession } from './useSession';
import { trackActivity, trackSearch, trackFeedback, trackLocation } from '@/lib/api';

/**
 * Hook for tracking user behavior events.
 *
 * All tracking is fire-and-forget — it never blocks the UI.
 *
 * Usage:
 *   const { trackEventView, trackSearch, trackCategoryBrowse } = useAnalytics();
 *
 *   // When user opens an event detail page
 *   useEffect(() => { trackEventView(eventId, eventCategory, eventGenres); }, []);
 *
 *   // When user searches
 *   trackSearch({ query: "jazz", categories: ["CONCERT"], lat: 40.7, lon: -74.0 });
 */
export function useAnalytics() {
  const { userId, sessionId } = useSession();
  const pageEnterTime = useRef(Date.now());

  const track = useCallback(
    (type: string, metadata?: Record<string, any>) => {
      trackActivity({ userId, sessionId, type, metadata });
    },
    [userId, sessionId],
  );

  const trackEventView = useCallback(
    (eventId: string, category?: string, genres?: string[]) => {
      track('event_view', {
        eventId,
        eventCategory: category,
        eventGenres: genres,
        pageUrl: typeof window !== 'undefined' ? window.location.href : '',
      });
    },
    [track],
  );

  const trackEventSave = useCallback(
    (eventId: string, category?: string) => {
      track('event_save', { eventId, eventCategory: category });
    },
    [track],
  );

  const trackEventShare = useCallback(
    (eventId: string, method: string) => {
      track('event_share', { eventId, shareMethod: method });
    },
    [track],
  );

  const trackCategoryBrowse = useCallback(
    (category: string) => {
      track('category_browse', {
        category,
        pageUrl: typeof window !== 'undefined' ? window.location.href : '',
      });
    },
    [track],
  );

  const trackLocationBrowse = useCallback(
    (lat: number, lon: number, radiusKm: number) => {
      track('location_browse', {
        location: { latitude: lat, longitude: lon, radiusKm },
        pageUrl: typeof window !== 'undefined' ? window.location.href : '',
      });
    },
    [track],
  );

  const trackClick = useCallback(
    (eventId: string, position: number, sourceList: string) => {
      track('click', {
        eventId,
        clickTarget: 'event_card',
        clickPosition: position,
        sourceList,
      });
    },
    [track],
  );

  const trackPageView = useCallback(() => {
    track('page_view', {
      pageUrl: typeof window !== 'undefined' ? window.location.href : '',
    });
  }, [track]);

  const trackSearchEvent = useCallback(
    (params: {
      query: string;
      filters?: Record<string, any>;
      resultCount?: number;
    }) => {
      trackSearch({
        userId,
        sessionId,
        searchId: `search_${Date.now()}_${userId}`,
        query: params.query,
        filters: params.filters,
        resultCount: params.resultCount,
      });
    },
    [userId, sessionId],
  );

  const trackRecFeedback = useCallback(
    (params: {
      recommendationId: string;
      modelId: string;
      modelVersion: string;
      type: 'impression' | 'click' | 'conversion' | 'dismiss';
      placement: { page: string; widget: string; position?: number };
      items: any[];
    }) => {
      trackFeedback({ userId, sessionId, ...params });
    },
    [userId, sessionId],
  );

  const trackMapInteraction = useCallback(
    (params: {
      type: 'location_search' | 'nearby_search' | 'map_pan' | 'map_zoom';
      lat: number;
      lon: number;
      radiusKm?: number;
    }) => {
      trackLocation({
        userId,
        sessionId,
        type: params.type,
        location: { latitude: params.lat, longitude: params.lon },
        metadata: { radiusKm: params.radiusKm },
      });
    },
    [userId, sessionId],
  );

  return {
    userId,
    sessionId,
    trackEventView,
    trackEventSave,
    trackEventShare,
    trackCategoryBrowse,
    trackLocationBrowse,
    trackClick,
    trackPageView,
    trackSearchEvent,
    trackRecFeedback,
    trackMapInteraction,
  };
}
