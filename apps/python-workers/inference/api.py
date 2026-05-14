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
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from search_ranker import SearchRanker
from candidate_generator import CandidateGenerator
from search_personalizer import SearchPersonalizer
from session_vector import SessionVectorComputer

# FeatureStore for Redis-backed session state
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ml-training"))
from feature_engineering import FeatureStore

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("inference-api")

# ── Global state ──────────────────────────────────────────────────────

ranker: Optional[SearchRanker] = None
candidate_generator: Optional[CandidateGenerator] = None
personalizer: Optional[SearchPersonalizer] = None
session_computer: Optional[SessionVectorComputer] = None
feature_store: Optional[FeatureStore] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global ranker, candidate_generator, personalizer, session_computer, feature_store
    model_path = os.getenv("MODEL_PATH")
    event_catalog_path = os.getenv("EVENT_CATALOG_PATH")

    ranker = SearchRanker(model_path)
    candidate_generator = CandidateGenerator(
        db_url=os.getenv("VECTOR_DATABASE_URL"),
        event_catalog_path=event_catalog_path,
    )
    personalizer = SearchPersonalizer(
        ranker=ranker,
        alpha=float(os.getenv("SEARCH_PERSONALIZATION_ALPHA", "0.4")),
    )
    session_computer = SessionVectorComputer()
    feature_store = FeatureStore(
        redis_url=os.getenv("FEATURE_STORE_URL", "redis://localhost:6379"),
    )
    logger.info("SearchRanker, CandidateGenerator, SearchPersonalizer, and FeatureStore initialized")
    yield
    if candidate_generator:
        candidate_generator.close()
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


class SearchResultItem(BaseModel):
    id: str
    title: str = ""
    category: str = ""
    genres: List[str] = Field(default_factory=list)
    _score: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    price: Optional[float] = None


class SearchPersonalizeRequest(BaseModel):
    user_id: str
    results: List[SearchResultItem]
    lat: Optional[float] = None
    lon: Optional[float] = None
    alpha: float = Field(default=0.4, ge=0.0, le=1.0)
    top_k: int = Field(default=20, ge=1, le=100)


class SearchPersonalizeResponse(BaseModel):
    user_id: str
    model_version: str
    items: List[RecommendationItem]
    generated_at: str


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


@app.post("/search/personalize", response_model=SearchPersonalizeResponse)
async def personalize_search(request: SearchPersonalizeRequest):
    """
    Re-rank raw search results with personalization.

    Accepts search results from Elasticsearch (via NestJS search service),
    scores each with user-specific relevance features, and blends with
    the original text relevance scores.

    The `alpha` parameter controls the trade-off:
      alpha = 1.0 → pure text relevance (original order)
      alpha = 0.0 → pure personalization
      alpha = 0.4 → balanced (default)
    """
    if personalizer is None:
        raise HTTPException(status_code=503, detail="Search personalizer not initialized")

    user_location = (request.lat, request.lon) if request.lat is not None and request.lon is not None else None

    results = [r.model_dump() for r in request.results]
    personalized = personalizer.personalize(
        user_id=request.user_id,
        search_results=results,
        user_location=user_location,
        top_k=request.top_k,
        alpha_override=request.alpha,
    )

    return SearchPersonalizeResponse(
        user_id=request.user_id,
        model_version=os.getenv("MODEL_VERSION", "latest"),
        items=[
            RecommendationItem(
                event_id=r.get("id", ""),
                title=r.get("title", "Unknown"),
                category=r.get("category", ""),
                genres=r.get("genres", []),
                relevance_score=r.get("blended_score", r.get("relevance_score", 0.0)),
                distance_km=r.get("distance_km"),
                explanation=r.get("ranking_features", {}),
            )
            for r in personalized
        ],
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


class InferenceVectorRequest(BaseModel):
    user_id: str
    recent_event_ids: List[str] = Field(default_factory=list, max_length=20)
    alpha: Optional[float] = Field(default=0.7, ge=0.0, le=1.0)


class InferenceVectorResponse(BaseModel):
    user_id: str
    vector: List[float]
    dimension: int
    source: str  # "session", "blended", "batch"
    ttl_seconds: int = 1800


class TrainRequest(BaseModel):
    mode: str = Field(default="incremental", pattern="^(full|incremental)$")
    window_days: int = Field(default=7, ge=1, le=365)


class TrainResponse(BaseModel):
    status: str
    task_id: str
    poll_url: str


class TrainStatusResponse(BaseModel):
    task_id: str
    state: str
    progress: dict = {}


@app.post("/api/v1/train", response_model=TrainResponse, status_code=202)
async def trigger_training(payload: TrainRequest):
    """
    Submit an on-demand ML training job.

    The job is dispatched to a Celery worker via Redis and runs in an
    isolated OS process — training never blocks the inference API.
    """
    from tasks import execute_training

    task = execute_training.delay(payload.mode, payload.window_days)
    return TrainResponse(
        status="accepted",
        task_id=task.id,
        poll_url=f"/api/v1/train/status/{task.id}",
    )


@app.get("/api/v1/train/status/{task_id}", response_model=TrainStatusResponse)
async def check_training_status(task_id: str):
    """Poll training job progress by Celery task ID."""
    from config import celery_app

    result = celery_app.AsyncResult(task_id)
    response = TrainStatusResponse(
        task_id=task_id,
        state=result.state,
    )
    if result.state == "IN_PROGRESS" and result.info:
        response.progress = result.info if isinstance(result.info, dict) else {}
    elif result.state == "SUCCESS":
        response.progress = result.result if isinstance(result.result, dict) else {}
    elif result.state == "FAILURE":
        response.progress = {"error": str(result.info)}
    return response


@app.post("/inference-vector", response_model=InferenceVectorResponse)
async def compute_inference_vector(request: InferenceVectorRequest):
    """
    Compute a real-time session inference vector from recent event clicks.

    Flow:
    1. If recent_event_ids are provided, use them directly.
    2. Otherwise, look up Redis `recent_clicks:{userId}` for real-time click data.
    3. Fetch event embeddings from pgvector for those event IDs.
    4. Compute session vector via exponential moving average pooling.
    5. Cache the result in Redis `inference_vector:{userId}` with TTL 30 min.
    6. If no clicks available, fall back to the batch user embedding from pgvector.
    """
    if candidate_generator is None:
        raise HTTPException(status_code=503, detail="Candidate generator not initialized")

    event_ids = list(request.recent_event_ids)

    # If caller didn't provide event IDs, check Redis for recent clicks
    if not event_ids and feature_store is not None:
        event_ids = feature_store.get_recent_clicks(request.user_id)
        if event_ids:
            logger.info("Using %d event IDs from Redis recent_clicks for user %s",
                        len(event_ids), request.user_id)

    # Fetch event embeddings from pgvector
    event_embs = {}
    if event_ids:
        event_embs = candidate_generator.get_event_embeddings_batch(event_ids)

    # Try to get batch user embedding for blend
    user_emb = candidate_generator.get_user_embedding(request.user_id)
    user_embeddings = {request.user_id: user_emb} if user_emb is not None else {}

    if event_embs:
        # Compute session vector from event embeddings
        computer = SessionVectorComputer(
            event_embeddings=event_embs,
            user_embeddings=user_embeddings,
            alpha=request.alpha if user_emb is not None else 1.0,
        )
        session_vec = computer.compute(request.user_id, event_ids)
        if session_vec is not None:
            # Cache in Redis for future requests
            if feature_store is not None:
                feature_store.cache_inference_vector(request.user_id, session_vec, ttl=1800)

            source = "blended" if (user_emb is not None and request.alpha < 1.0) else "session"
            return InferenceVectorResponse(
                user_id=request.user_id,
                vector=session_vec.tolist(),
                dimension=len(session_vec),
                source=source,
                ttl_seconds=1800,
            )

    # No event clicks — fall back to cached or batch user embedding
    if feature_store is not None:
        cached = feature_store.get_inference_vector(request.user_id)
        if cached is not None:
            logger.info("Returning cached inference vector for user %s", request.user_id)
            return InferenceVectorResponse(
                user_id=request.user_id,
                vector=cached.tolist(),
                dimension=len(cached),
                source="cached",
                ttl_seconds=1800,
            )

    if user_emb is not None:
        logger.info("Falling back to batch user embedding for user %s", request.user_id)
        return InferenceVectorResponse(
            user_id=request.user_id,
            vector=user_emb.tolist(),
            dimension=len(user_emb),
            source="batch",
            ttl_seconds=1800,
        )

    raise HTTPException(
        status_code=404,
        detail="No embeddings or recent clicks found for this user",
    )


# ── Candidate generation ─────────────────────────────────────────────

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

    Uses CandidateGenerator which combines embedding-based ANN retrieval
    with geo-distance, category, genre, and price filters.
    Falls back to heuristic scoring when embeddings are unavailable.

    In production, replace with Elasticsearch kNN + filters for scale.
    """
    if candidate_generator is None:
        logger.warning("CandidateGenerator not initialized")
        return []

    return candidate_generator.generate_candidates(
        user_id=user_id,
        user_location=user_location,
        radius_km=radius_km,
        categories=categories,
        genres=genres,
        max_price=max_price,
        limit=limit,
    )


async def _get_similar_event_candidates(
    event_id: str,
    top_k: int = 50,
) -> List[Dict[str, Any]]:
    """Find similar events via embedding cosine similarity or content overlap."""
    if candidate_generator is None:
        return []
    return candidate_generator.get_similar_events(event_id, top_k=top_k)


async def _get_trending_candidates(
    city: Optional[str] = None,
    limit: int = 60,
) -> List[Dict[str, Any]]:
    """Get trending events by booking velocity, optionally filtered by city."""
    if candidate_generator is None:
        return []
    return candidate_generator.get_trending(city=city, limit=limit)


# ── Entry point ───────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("api:app", host=host, port=port, reload=True, log_level="info")
