# Tracking Events Catalog

All user behavior events tracked from the frontend, flowing through API Gateway → Kafka → Python ML pipeline.

## Architecture

```
Frontend (useAnalytics hook) → API Gateway (TrackingController) → Kafka → Python Consumers → Feature Engineering
```

## Event Topics

### 1. user-activities (topic: `user-activities`, partitions: 6)

Core user behavior signals. Partitioned by `userId`.

| Event Type | Hook Function | Description | ML Feature Group |
|---|---|---|---|
| `page_view` | `trackPageView()` | User navigated to a page | Temporal, Engagement |
| `event_view` | `trackEventView(eventId, category?, genres?)` | User viewed event detail page | Category, Engagement |
| `event_save` | `trackEventSave(eventId, category?)` | User saved/favorited an event | Category, Collaborative, Labels (positive) |
| `event_share` | `trackEventShare(eventId, method)` | User shared event via social/link | Engagement |
| `click` | `trackClick(eventId, position, sourceList)` | User clicked on event card in list | Engagement, Category |
| `category_browse` | `trackCategoryBrowse(category)` | User browsed events by category | Category, Interest Similarity |
| `location_browse` | `trackLocationBrowse(lat, lon, radiusKm)` | User searched by location | Location |
| `vendor_view` | `trackVendorView(vendorId, category?)` | User viewed vendor profile | Category, Engagement |
| `vendor_follow` | `trackVendorFollow(vendorId)` | User followed a vendor | Collaborative |
| `session_start` | _(auto, on first activity)_ | New user session started | Temporal |
| `session_end` | _(auto, on session timeout)_ | User session ended | Temporal |
| `notification_interaction` | _(future)_ | User clicked push/email notification | Engagement, Temporal |

### 2. event-lifecycle (topic: `event-lifecycle`, partitions: 6)

Events about event creation/updates. Partitioned by `eventId`.

| Event Type | Source | Description |
|---|---|---|
| `event_created` | Event Service | New event created by vendor |
| `event_updated` | Event Service | Event details modified |
| `event_published` | Event Service | Event made publicly visible |
| `event_cancelled` | Event Service | Event cancelled by vendor |
| `event_completed` | Event Service | Event has taken place |
| `event_sold_out` | Event Service | All seats/tickets booked |
| `event_rescheduled` | Event Service | Event time/location changed |

### 3. booking-events (topic: `booking-events`, partitions: 6)

Booking funnel events. Partitioned by `userId`.

| Event Type | Source | Weight in ML |
|---|---|---|
| `booking_initiated` | Booking Service | 3.0 (intent signal) |
| `booking_confirmed` | Booking Service | 4.0 (strong positive label) |
| `booking_cancelled` | Booking Service | Implicit negative |
| `booking_attended` | Booking Service | 5.0 (strongest positive label) |
| `booking_no_show` | Booking Service | Implicit negative |
| `booking_refunded` | Booking Service | Implicit negative |

### 4. search-events (topic: `search-events`, partitions: 6)

Search intent signals. Partitioned by `userId`.

| Event Type | Hook Function | Description |
|---|---|---|
| `search_performed` | `trackSearchEvent({query, filters?, resultCount?})` | User executed search |
| `search_result_clicked` | _(auto, API Gateway AnalyticsInterceptor)_ | User clicked search result |
| `search_abandoned` | _(auto, if no result clicked within session)_ | Search with no engagement |

### 5. recommendation-feedback (topic: `recommendation-feedback`, partitions: 6)

Feedback loop for ML model improvement. Partitioned by `userId`.

| Event Type | Hook Function | Description |
|---|---|---|
| `impression` | `trackRecFeedback({type: 'impression'})` | Recommendation shown to user |
| `click` | `trackRecFeedback({type: 'click'})` | User clicked recommendation |
| `conversion` | `trackRecFeedback({type: 'conversion'})` | User booked from recommendation |
| `dismiss` | `trackRecFeedback({type: 'dismiss'})` | User dismissed recommendation |

### 6. location-context (topic: `location-context`, partitions: 6)

Map and location interaction signals. Partitioned by `userId`.

| Event Type | Hook Function | Description |
|---|---|---|
| `location_search` | `trackMapInteraction({type: 'location_search'})` | User searched by location |
| `nearby_search` | `trackMapInteraction({type: 'nearby_search'})` | User searched "near me" |
| `map_pan` | `trackMapInteraction({type: 'map_pan'})` | User panned the map |
| `map_zoom` | `trackMapInteraction({type: 'map_zoom'})` | User zoomed map in/out |
| `location_saved` | _(future)_ | User saved a location |
| `geofence_enter` | _(future, mobile)_ | User entered area near events |
| `geofence_exit` | _(future, mobile)_ | User left event area |

## Adding New Events

1. **Define the event type** in the appropriate schema:
   - TS: `libs/kafka-client/src/schemas/<topic>.schema.ts`
   - Python: `apps/python-workers/schemas/<topic>.py`

2. **Add tracking function** to `useAnalytics.ts` if it's a client-side event

3. **Produce the event** from the NestJS service (API Gateway, Event Service, etc.)

4. **Consume the event** in the Python feature engineers (add to `fit()` method of relevant engineer)

5. **Document here** with ML feature group mapping

## Feature Group Mapping Summary

| Feature Engineer | Topics Consumed | Output Dims |
|---|---|---|
| LocationFeatureEngineer | user-activities, location-context, search-events, booking-events, event-lifecycle | 20 |
| CategoryFeatureEngineer | user-activities, booking-events, search-events, event-lifecycle, recommendation-feedback | 25 |
| CollaborativeFeatureEngineer | booking-events, user-activities, recommendation-feedback | 33 |
| TemporalFeatureEngineer | user-activities, booking-events, search-events | 12 |
| EngagementFeatureEngineer | user-activities, recommendation-feedback | 15 |
| InterestSimilarityFeatureEngineer | user-activities, event-lifecycle, booking-events | 18 |
| ParticipantCooccurrenceFeatureEngineer | booking-events, user-activities | 16 |
| **Total** | | **139** |
