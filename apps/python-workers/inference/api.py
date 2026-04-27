#!/usr/bin/env python3
"""
FastAPI inference service for event recommendations.

Endpoints:
  GET  /health                          — Liveness check
  GET  /recommendations                 — Personalized recommendations
  GET  /similar-events/{event_id}       — Similar events (embedding-based)
  GET  /nearby-events                   — Location-only recommendations
  GET  /trending-events                 — Non-personalized trending
  POST /feedback                        — Record recommendation feedback
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from search_ranker import SearchRanker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("inference-api")

# ── Global state ──────────────────────────────────────────────────────

ranker: Optional[SearchRanker] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global ranker
    model_path = os.getenv("MODEL_PATH")
    ranker = SearchRanker(model_path)
    logger.info("SearchRanker initialized")
    yield
    logger.info("Shutting down")


app = FastAPI(
    title="Polydom Recommendation Service",
    description="Real-time event recommendations using collaborative + content-based models",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request/Response models ───────────────────────────────────────────

class RecommendationRequest(BaseModel):
    user_id: str
    lat: Optional[float] = None
    lon: Optional[float] = None
    radius_km: float = 50.0
    categories: Optional[List[str]] = None
    genres: Optional[List[str]] = None
    max_price: Optional[float] = None
    top_k: int = Field(default=20, ge=1, le=100)


class RecommendationItem(BaseModel):
    event_id: str
    title: str
    category: str
    genres: List[str]
    relevance_score: float
    distance_km: Optional[float] = None
    explanation: Dict[str, float] = {}


class RecommendationResponse(BaseModel):
    recommendation_id: str
    user_id: str
    model_version: str
    items: List[RecommendationItem]
    generated_at: str


class FeedbackRequest(BaseModel):
    recommendation_id: str
    user_id: str
    session_id: str
    event_id: str
    interaction_type: str  # 'click', 'bookmark', 'book', 'dismiss', 'share'
    position: int
    score: float
    dwell_time_ms: Optional[int] = None


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    uptime_seconds: float


start_time = datetime.now(timezone.utc)


# ── Endpoints ─────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health():
    """Liveness check."""
    return HealthResponse(
        status="healthy",
        model_loaded=ranker is not None and ranker.model is not None,
        uptime_seconds=(datetime.now(timezone.utc) - start_time).total_seconds(),
    )


@app.get("/recommendations", response_model=RecommendationResponse)
async def get_recommendations(
    user_id: str = Query(..., description="User ID"),
    lat: Optional[float] = Query(None, description="User latitude"),
    lon: Optional[float] = Query(None, description="User longitude"),
    radius_km: float = Query(50.0, ge=1, le=500, description="Search radius in km"),
    categories: Optional[str] = Query(None, description="Comma-separated categories"),
    genres: Optional[str] = Query(None, description="Comma-separated genres"),
    max_price: Optional[float] = Query(None, description="Maximum ticket price"),
    top_k: int = Query(20, ge=1, le=100, description="Number of results"),
):
    """
    Get personalized event recommendations.

    Combines collaborative filtering (embeddings), content-based features
    (category/genre affinity), location proximity, and engagement signals.
    """
    if ranker is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    user_location = (lat, lon) if lat is not None and lon is not None else None
    cat_list = categories.split(",") if categories else None
    genre_list = genres.split(",") if genres else None

    # Candidate generation (production: ANN from Elasticsearch + geo-filter)
    candidates = await _generate_candidates(
        user_id=user_id,
        user_location=user_location,
        radius_km=radius_km,
        categories=cat_list,
        genres=genre_list,
        max_price=max_price,
        limit=200,
    )

    # Rank
    ranked = ranker.rank(
        user_id=user_id,
        candidates=candidates,
        user_location=user_location,
        top_k=top_k,
        diversity_lambda=0.3,
    )

    recommendation_id = f"rec_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{user_id}"

    return RecommendationResponse(
        recommendation_id=recommendation_id,
        user_id=user_id,
        model_version=os.getenv("MODEL_VERSION", "latest"),
        items=[
            RecommendationItem(
                event_id=r.get("id", ""),
                title=r.get("title", "Unknown"),
                category=r.get("category", ""),
                genres=r.get("genres", []),
                relevance_score=r.get("relevance_score", 0.0),
                distance_km=r.get("distance_km"),
                explanation=r.get("ranking_features", {}),
            )
            for r in ranked
        ],
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/similar-events/{event_id}", response_model=RecommendationResponse)
async def get_similar_events(
    event_id: str,
    user_id: str = Query("anonymous"),
    top_k: int = Query(10, ge=1, le=50),
):
    """
    Get events similar to a given event.

    Uses event embeddings from the two-tower model for content-based similarity.
    """
    if ranker is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    candidates = await _get_similar_event_candidates(event_id, top_k=top_k * 5)
    ranked = ranker.rank(user_id, candidates, top_k=top_k)

    return RecommendationResponse(
        recommendation_id=f"sim_{event_id}",
        user_id=user_id,
        model_version=os.getenv("MODEL_VERSION", "latest"),
        items=[
            RecommendationItem(
                event_id=r.get("id", ""),
                title=r.get("title", "Unknown"),
                category=r.get("category", ""),
                genres=r.get("genres", []),
                relevance_score=r.get("relevance_score", 0.0),
            )
            for r in ranked
        ],
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/nearby-events", response_model=RecommendationResponse)
async def get_nearby_events(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    radius_km: float = Query(20.0, ge=1, le=200),
    user_id: str = Query("anonymous"),
    top_k: int = Query(20, ge=1, le=100),
):
    """
    Get events near a location, ranked by popularity + user preference.
    """
    if ranker is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    candidates = await _generate_candidates(
        user_id=user_id,
        user_location=(lat, lon),
        radius_km=radius_km,
        limit=200,
    )
    ranked = ranker.rank(user_id, candidates, user_location=(lat, lon), top_k=top_k)

    return RecommendationResponse(
        recommendation_id=f"nearby_{lat:.3f}_{lon:.3f}",
        user_id=user_id,
        model_version=os.getenv("MODEL_VERSION", "latest"),
        items=[
            RecommendationItem(
                event_id=r.get("id", ""),
                title=r.get("title", "Unknown"),
                category=r.get("category", ""),
                genres=r.get("genres", []),
                relevance_score=r.get("relevance_score", 0.0),
                distance_km=r.get("distance_km"),
            )
            for r in ranked
        ],
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/trending-events", response_model=RecommendationResponse)
async def get_trending_events(
    city: Optional[str] = Query(None),
    top_k: int = Query(20, ge=1, le=100),
):
    """Get non-personalized trending events (fallback for cold-start users)."""
    candidates = await _get_trending_candidates(city, limit=top_k * 3)

    response_items = []
    for i, c in enumerate(candidates[:top_k]):
        response_items.append(RecommendationItem(
            event_id=c.get("id", ""),
            title=c.get("title", "Unknown"),
            category=c.get("category", ""),
            genres=c.get("genres", []),
            relevance_score=float(top_k - i) / top_k,  # simple rank proxy
        ))

    return RecommendationResponse(
        recommendation_id=f"trending_{city or 'all'}",
        user_id="anonymous",
        model_version=os.getenv("MODEL_VERSION", "latest"),
        items=response_items,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


@app.post("/feedback")
async def record_feedback(feedback: FeedbackRequest):
    """
    Record user interaction with a recommendation.

    This closes the feedback loop: impression → click → conversion.
    Data is written to Kafka topic 'recommendation-feedback' for batch retraining.
    """
    logger.info(
        "Feedback: user=%s, rec=%s, event=%s, type=%s, position=%d",
        feedback.user_id,
        feedback.recommendation_id,
        feedback.event_id,
        feedback.interaction_type,
        feedback.position,
    )

    # In production: produce to Kafka topic 'recommendation-feedback'
    # producer.send('recommendation-feedback', feedback.model_dump())

    if ranker:
        ranker.update_model([feedback.model_dump()])

    return {"status": "recorded", "timestamp": datetime.now(timezone.utc).isoformat()}


# ── Candidate generation (production: Elasticsearch + embedding ANN) ──

async def _generate_candidates(
    user_id: str,
    user_location: Optional[Tuple[float, float]],
    radius_km: float,
    categories: Optional[List[str]] = None,
    genres: Optional[List[str]] = None,
    max_price: Optional[float] = None,
    limit: int = 200,
) -> List[Dict[str, Any]]:
    """
    Generate candidate events for ranking.

    Production implementation:
      1. ANN search on event embeddings in Elasticsearch (k=500)
      2. Geo-distance filter (elasticsearch geo_distance query)
      3. Category/genre pre-filter (elasticsearch terms query)
      4. Price filter (elasticsearch range query)

    For dev: returns structured placeholders.
    """
    # In production: Elasticsearch query with:
    #   - knn on event_embedding field
    #   - geo_distance filter on event_location
    #   - terms filter on category/genres
    #   - range filter on price
    return []


async def _get_similar_event_candidates(
    event_id: str,
    top_k: int = 50,
) -> List[Dict[str, Any]]:
    """Find similar events via embedding cosine similarity."""
    # In production: Elasticsearch more_like_this or ANN on event_embedding
    # GET /events/_search { "knn": { "field": "event_embedding", "query_vector": [...], "k": 50 } }
    return []


async def _get_trending_candidates(
    city: Optional[str] = None,
    limit: int = 60,
) -> List[Dict[str, Any]]:
    """Get trending events by recent booking velocity."""
    # In production: Elasticsearch aggregation on booking count, filtered by city
    # Sort by: booking_count (last 7 days) DESC, event_start ASC
    return []


# ── Entry point ───────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("api:app", host=host, port=port, reload=True, log_level="info")
