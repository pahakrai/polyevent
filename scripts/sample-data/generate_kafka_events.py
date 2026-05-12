"""
Kafka Sample Event Generator for ML Pipeline Testing.

Generates realistic event streams across all 6 Kafka topics to exercise:
  - user-activities    (SEARCH, VIEW_EVENT, CLICK_EVENT, etc.)
  - event-lifecycle    (CREATED, PUBLISHED, UPDATED, etc.)
  - booking-events     (CREATED, CONFIRMED, CANCELLED, etc.)
  - search-events      (SEARCH_EXECUTED, RESULT_CLICKED, SEARCH_ABANDONED)
  - recommendation-feedback  (IMPRESSION, CLICK, DISMISS, CONVERSION)
  - location-context   (ENTER_AREA, EXIT_AREA, LOCATION_SEARCH, etc.)

Usage:
  python scripts/sample-data/generate_kafka_events.py              # Generate once
  python scripts/sample-data/generate_kafka_events.py --stream     # Stream continuously
  python scripts/sample-data/generate_kafka_events.py --count 1000 # Generate N events per topic

Requires: confluent-kafka (pip install confluent-kafka)
"""

import json
import random
import uuid
import time
import argparse
from datetime import datetime, timedelta, timezone
from typing import Any

# ============================================================
# Sample Data — must match sample-data-constants.ts IDs
# ============================================================

USER_IDS = [f"user-{i:03d}" for i in range(1, 26)]
EVENT_IDS = [f"event-{i:03d}" for i in range(1, 41)]
VENDOR_IDS = [f"vendor-{i:03d}" for i in range(1, 9)]
VENUE_IDS = [f"venue-{i:03d}" for i in range(1, 17)]
BOOKING_IDS = [f"booking-{i:03d}" for i in range(1, 21)]

CATEGORIES = ["MUSIC", "ART", "SPORTS", "ACTIVITIES", "OTHER"]
SUB_CATEGORIES = {
    "MUSIC": ["Jazz", "Rock", "Classical", "Electronic", "Blues", "Indie", "Pop", "Metal", "Acoustic"],
    "ART": ["Exhibition", "Workshop", "Photography", "Sculpture", "Painting", "Social"],
    "SPORTS": ["Basketball", "Tennis", "Climbing", "Volleyball", "Team Building"],
    "ACTIVITIES": ["Yoga", "Meditation", "Cooking", "Outdoor", "Baking", "Wine Tasting", "Retreat", "Kayaking"],
    "OTHER": ["Misc"],
}
GENRES = ["jazz", "rock", "classical", "electronic", "blues", "indie", "pop", "metal", "folk",
          "hip-hop", "ambient", "techno", "house", "punk", "soul", "opera", "bossa nova", "world music"]
CITIES = ["Helsinki", "Espoo", "Vantaa", "Tampere", "Turku", "Oulu", "Lahti", "Jyvaskyla", "Kuopio"]
SEARCH_QUERIES = [
    "jazz night", "rock concert", "art exhibition", "yoga class", "tennis lessons",
    "cooking workshop", "meditation", "basketball tournament", "music festival",
    "wine tasting", "outdoor adventure", "photography exhibition", "sculpture park",
    "climbing gym", "kayaking trip", "sourdough baking", "electronic music",
    "summer events", "weekend activities", "live music tonight", "free events",
    "workshops near me", "family activities", "date night ideas", "fitness classes",
    "cultural events", "food festivals", "concerts this month", "art classes",
    "sports leagues", "yoga retreat", "cooking class Finnish", "tennis camp",
    "bouldering beginner", "pottery class", "wine and painting", "foraging walk",
    "wellness retreat", "acoustic night", "singer-songwriter", "vinyl listening party",
]
SOURCES = ["web", "mobile", "app", "api"]

# Geo: Helsinki metropolitan area bounding box
HELSINKI_LAT, HELSINKI_LNG = 60.1699, 24.9384
LAT_RANGE = (60.14, 60.32)
LNG_RANGE = (24.62, 25.10)


def rng(seed: int = 42):
    """Seeded random for reproducibility."""
    random.seed(seed)
    return random


def random_timestamp(days_ago_max: int = 90) -> str:
    """Generate a random ISO timestamp within the last N days."""
    seconds_ago = random.randint(0, days_ago_max * 86400)
    dt = datetime.now(timezone.utc) - timedelta(seconds=seconds_ago)
    return dt.isoformat()


def random_location() -> dict:
    """Random location in Helsinki area."""
    return {
        "latitude": round(random.uniform(*LAT_RANGE), 6),
        "longitude": round(random.uniform(*LNG_RANGE), 6),
        "city": random.choice(CITIES),
        "country": "Finland",
    }


# ============================================================
# Event Generators per Topic
# ============================================================

def generate_user_activity() -> dict:
    """Generate a user-activities event."""
    event_types = ["SEARCH", "VIEW_EVENT", "CLICK_EVENT", "BOOKING_CREATED",
                   "BOOKING_CANCELLED", "REVIEW_CREATED", "LOGIN", "LOGOUT",
                   "SAVE_EVENT", "SHARE_EVENT", "FILTER_APPLIED"]
    weights = [0.25, 0.30, 0.15, 0.05, 0.02, 0.03, 0.10, 0.05, 0.03, 0.01, 0.01]
    event_type = random.choices(event_types, weights=weights)[0]

    metadata: dict[str, Any] = {
        "source": random.choice(SOURCES),
        "sessionId": str(uuid.uuid4()),
    }

    if event_type == "SEARCH":
        metadata.update({
            "query": random.choice(SEARCH_QUERIES),
            "resultCount": random.randint(0, 50),
            "filters": random.choice([None, {"category": random.choice(CATEGORIES), "date": "this_week"}]),
        })
    elif event_type in ("VIEW_EVENT", "CLICK_EVENT", "SAVE_EVENT", "SHARE_EVENT"):
        event = random.choice(EVENT_IDS)
        metadata.update({
            "eventId": event,
            "category": random.choice(CATEGORIES),
            "genres": random.sample(GENRES, k=random.randint(1, 3)),
            "location": random.choice(CITIES),
            "position": random.randint(0, 20),
        })
    elif event_type == "BOOKING_CREATED":
        metadata.update({
            "bookingId": random.choice(BOOKING_IDS),
            "eventId": random.choice(EVENT_IDS),
            "ticketCount": random.randint(1, 4),
            "totalAmount": round(random.uniform(10, 200), 2),
            "currency": "EUR",
        })
    elif event_type == "REVIEW_CREATED":
        metadata.update({
            "eventId": random.choice(EVENT_IDS),
            "rating": random.randint(1, 5),
            "text": "Great experience!" if random.random() > 0.3 else "Could be better.",
        })

    return {
        "userId": random.choice(USER_IDS),
        "sessionId": str(uuid.uuid4()),
        "eventType": event_type,
        "metadata": metadata,
        "timestamp": random_timestamp(),
    }


def generate_event_lifecycle() -> dict:
    """Generate an event-lifecycle event."""
    event_types = ["CREATED", "PUBLISHED", "UPDATED", "CANCELLED", "COMPLETED", "POSTPONED", "DELETED"]
    weights = [0.10, 0.35, 0.20, 0.10, 0.15, 0.05, 0.05]
    event_type = random.choices(event_types, weights=weights)[0]

    category = random.choice(CATEGORIES)
    event_snapshot = {
        "title": f"Sample {category} Event {random.randint(1, 999)}",
        "description": f"A sample {category.lower()} event for testing",
        "category": category,
        "subCategory": random.choice(SUB_CATEGORIES.get(category, ["Misc"])),
        "startTime": random_timestamp(days_ago_max=-30),  # Future
        "endTime": random_timestamp(days_ago_max=-30),
        "location": random_location(),
        "price": {"general": round(random.uniform(0, 100), 2), "currency": "EUR"},
        "maxAttendees": random.choice([20, 30, 50, 100, 200, 500]),
        "status": "PUBLISHED" if event_type == "PUBLISHED" else "DRAFT",
        "tags": random.sample(GENRES, k=random.randint(1, 4)),
    }

    return {
        "eventId": random.choice(EVENT_IDS),
        "vendorId": random.choice(VENDOR_IDS),
        "eventType": event_type,
        "eventSnapshot": event_snapshot,
        "timestamp": random_timestamp(),
    }


def generate_booking_event() -> dict:
    """Generate a booking-events event."""
    event_types = ["CREATED", "CONFIRMED", "CANCELLED", "ATTENDED", "NO_SHOW", "REFUNDED"]
    weights = [0.15, 0.40, 0.15, 0.20, 0.05, 0.05]
    event_type = random.choices(event_types, weights=weights)[0]

    return {
        "bookingId": random.choice(BOOKING_IDS),
        "userId": random.choice(USER_IDS),
        "eventId": random.choice(EVENT_IDS),
        "bookingType": event_type,
        "bookingDetail": {
            "ticketCount": random.randint(1, 4),
            "ticketType": random.choice(["GENERAL", "VIP", "STUDENT", "FREE"]),
            "totalAmount": round(random.uniform(0, 200), 2),
            "currency": "EUR",
            "promoCode": random.choice([None, None, None, "EARLY10", "VIP20"]),
        },
        "source": random.choice(SOURCES),
        "timestamp": random_timestamp(),
    }


def generate_search_event() -> dict:
    """Generate a search-events event."""
    event_types = ["SEARCH_EXECUTED", "RESULT_CLICKED", "SEARCH_ABANDONED"]
    weights = [0.60, 0.30, 0.10]
    event_type = random.choices(event_types, weights=weights)[0]

    search_id = str(uuid.uuid4())

    result: dict[str, Any] = {
        "userId": random.choice(USER_IDS),
        "searchId": search_id,
        "eventType": event_type,
        "timestamp": random_timestamp(),
    }

    if event_type == "SEARCH_EXECUTED":
        result["searchDetail"] = {
            "query": random.choice(SEARCH_QUERIES),
            "filters": random.choice([
                None,
                {"category": random.choice(CATEGORIES)},
                {"date": "this_week", "price": "free"},
                {"location": random.choice(CITIES), "category": random.choice(CATEGORIES)},
            ]),
            "resultCount": random.randint(0, 50),
            "page": random.randint(1, 3),
            "source": random.choice(SOURCES),
        }
    elif event_type == "RESULT_CLICKED":
        result["clickDetail"] = {
            "eventId": random.choice(EVENT_IDS),
            "position": random.randint(0, 19),
            "resultCount": random.randint(10, 50),
            "timeToClick": random.randint(1, 30),
        }
    elif event_type == "SEARCH_ABANDONED":
        result["abandonDetail"] = {
            "query": random.choice(SEARCH_QUERIES),
            "resultCount": random.randint(0, 5),
            "timeOnPage": random.randint(5, 60),
        }

    return result


def generate_recommendation_feedback() -> dict:
    """Generate a recommendation-feedback event."""
    event_types = ["IMPRESSION", "CLICK", "DISMISS", "CONVERSION"]
    weights = [0.50, 0.25, 0.15, 0.10]
    event_type = random.choices(event_types, weights=weights)[0]

    rec_id = str(uuid.uuid4())
    model_id = random.choice(["ranker_v20260510_ndcg0.7234", "svd_baseline_v1", "two_tower_v3"])

    items = []
    for i in range(random.randint(5, 20)):
        items.append({
            "eventId": random.choice(EVENT_IDS),
            "score": round(random.uniform(0, 1), 4),
            "position": i,
            "category": random.choice(CATEGORIES),
        })

    return {
        "userId": random.choice(USER_IDS),
        "recommendationId": rec_id,
        "modelId": model_id,
        "eventType": event_type,
        "placement": random.choice(["homepage", "event_detail", "search_results", "booking_confirmation"]),
        "items": items,
        "timestamp": random_timestamp(),
    }


def generate_location_context() -> dict:
    """Generate a location-context event."""
    event_types = ["ENTER_AREA", "EXIT_AREA", "LOCATION_SEARCH", "MAP_VIEW",
                   "GEOFENCE_ENTER", "GEOFENCE_EXIT", "LOCATION_UPDATE"]
    weights = [0.20, 0.15, 0.20, 0.25, 0.05, 0.05, 0.10]
    event_type = random.choices(event_types, weights=weights)[0]

    location = random_location()

    result: dict[str, Any] = {
        "userId": random.choice(USER_IDS),
        "sessionId": str(uuid.uuid4()),
        "eventType": event_type,
        "geoPoint": {
            "latitude": location["latitude"],
            "longitude": location["longitude"],
            "accuracy": random.randint(5, 100),
        },
        "timestamp": random_timestamp(),
    }

    if event_type == "LOCATION_SEARCH":
        result["locationSearch"] = {
            "query": random.choice(CITIES),
            "radius": random.choice([5, 10, 25, 50]),
        }
    elif event_type == "MAP_VIEW":
        result["mapView"] = {
            "center": {"latitude": location["latitude"], "longitude": location["longitude"]},
            "zoomLevel": random.randint(8, 16),
            "bounds": {
                "north": location["latitude"] + 0.05,
                "south": location["latitude"] - 0.05,
                "east": location["longitude"] + 0.05,
                "west": location["longitude"] - 0.05,
            },
        }
    elif event_type in ("GEOFENCE_ENTER", "GEOFENCE_EXIT"):
        result["geofence"] = {
            "geofenceId": f"geo-{random.choice(VENUE_IDS)}",
            "name": random.choice(["Venue Area", "City Center", "Event Zone"]),
        }

    return result


# ============================================================
# Topic-to-Generator Mapping
# ============================================================

TOPIC_GENERATORS = {
    "user-activities": generate_user_activity,
    "event-lifecycle": generate_event_lifecycle,
    "booking-events": generate_booking_event,
    "search-events": generate_search_event,
    "recommendation-feedback": generate_recommendation_feedback,
    "location-context": generate_location_context,
}


# ============================================================
# Kafka Producer
# ============================================================

def get_producer(brokers: str = "localhost:9092"):
    """Get a Kafka producer, or None if Kafka isn't available."""
    try:
        from confluent_kafka import Producer
        conf = {
            'bootstrap.servers': brokers,
            'client.id': 'sample-data-generator',
        }
        return Producer(conf)
    except ImportError:
        print("  [WARN] confluent-kafka not installed. Writing to stdout only.")
        return None
    except Exception as e:
        print(f"  [WARN] Cannot connect to Kafka at {brokers}: {e}")
        return None


def delivery_report(err, msg):
    if err is not None:
        print(f"  [ERROR] Delivery failed: {err}")
    else:
        print(f"  [OK] Delivered to {msg.topic()} [{msg.partition()}] @ offset {msg.offset()}")


def generate_events(args):
    """Generate events and optionally send to Kafka or write to file."""
    producer = None
    if not args.stdout_only:
        producer = get_producer(args.brokers)

    output_file = None
    if args.output:
        output_file = open(args.output, 'w', encoding='utf-8')

    topics = args.topics.split(',') if args.topics else list(TOPIC_GENERATORS.keys())
    count_per_topic = args.count
    delay = args.delay

    total_events = 0

    try:
        while True:
            for topic in topics:
                generator = TOPIC_GENERATORS[topic]
                for _ in range(count_per_topic):
                    event = generator()
                    event_json = json.dumps(event, ensure_ascii=False)

                    if producer:
                        producer.produce(
                            topic=topic,
                            key=event.get('userId', event.get('eventId', str(uuid.uuid4()))),
                            value=event_json.encode('utf-8'),
                            callback=delivery_report,
                        )

                    if output_file:
                        output_file.write(f"{topic}\t{event_json}\n")

                    if args.verbose:
                        print(f"  [{topic}] {event.get('eventType', '?')} | {event_json[:120]}...")

                    total_events += 1

            if producer:
                producer.flush()

            if not args.stream:
                break

            if args.verbose:
                print(f"\n  --- Batch complete ({total_events} total events). Waiting {delay}s... ---\n")

            time.sleep(delay)

    except KeyboardInterrupt:
        print(f"\n\nStopped. Generated {total_events} events across {len(topics)} topics.")

    finally:
        if output_file:
            output_file.close()
        if producer:
            producer.flush()

    print(f"\nDone! Generated {total_events} events total.")
    if args.output:
        print(f"Output written to: {args.output}")


def main():
    parser = argparse.ArgumentParser(
        description="Generate sample Kafka events for ML pipeline testing"
    )
    parser.add_argument("--stream", action="store_true",
                        help="Stream events continuously (default: one-shot)")
    parser.add_argument("--count", type=int, default=50,
                        help="Number of events per topic per batch (default: 50)")
    parser.add_argument("--delay", type=int, default=5,
                        help="Delay in seconds between batches when streaming (default: 5)")
    parser.add_argument("--topics", type=str, default=None,
                        help="Comma-separated topic names (default: all 6 topics)")
    parser.add_argument("--brokers", type=str, default="localhost:9092",
                        help="Kafka bootstrap servers (default: localhost:9092)")
    parser.add_argument("--output", type=str, default=None,
                        help="Write events to file (JSON lines format)")
    parser.add_argument("--stdout-only", action="store_true",
                        help="Skip Kafka connection, write to stdout only")
    parser.add_argument("--verbose", action="store_true", default=True,
                        help="Print each event (default: true)")
    parser.add_argument("--quiet", action="store_true",
                        help="Suppress event output")
    parser.add_argument("--seed", type=int, default=42,
                        help="Random seed for reproducibility (default: 42)")

    args = parser.parse_args()

    if args.quiet:
        args.verbose = False

    random.seed(args.seed)

    print("╔══════════════════════════════════════════════════════╗")
    print("║   Polydom Kafka Event Generator — Sample Data       ║")
    print("╚══════════════════════════════════════════════════════╝")
    print(f"\n  Topics:    {args.topics or 'all 6'}")
    print(f"  Per batch: {args.count} events/topic")
    print(f"  Mode:      {'streaming' if args.stream else 'one-shot'}")
    print(f"  Brokers:   {args.brokers if not args.stdout_only else 'stdout only'}")
    print(f"  Seed:      {args.seed}")
    print()

    generate_events(args)


if __name__ == "__main__":
    main()
