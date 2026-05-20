# Recommendation System Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND                                    │
│  useAnalytics hook → fire-and-forget tracking to API Gateway        │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP POST /tracking/*
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       API GATEWAY (NestJS)                           │
│  TrackingController  ←  explicit client-side events                 │
│  AnalyticsInterceptor ← auto-tracked GET routes                     │
│  TrackingService     →  Redpanda Producer (6 topics)                 │
└────────────────────────────┬────────────────────────────────────────┘
                             │ Redpanda (Kafka API-compatible)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PYTHON WORKERS (apps/python-workers/)             │
│                                                                      │
│  ┌─────────────────┐   ┌──────────────────┐   ┌──────────────────┐  │
│  │ Event Consumer  │   │  ML Training      │   │  Inference API   │  │
│  │ (all 6 topics)  │   │  Data Pipeline    │   │  (FastAPI:8000)  │  │
│  │                 │   │                    │   │                  │  │
│  │ user_activity   │──▶│ EXTRACT (events)  │   │ /recommendations │  │
│  │ .py             │   │  ↓                │   │ /similar-events  │  │
│  │                 │   │ TRANSFORM (7 FE)  │   │ /nearby-events   │  │
│  │ batch + manual  │   │  ↓                │   │ /trending-events │  │
│  │ commit          │   │ LOAD (Redis+NPY)  │   │ /feedback        │  │
│  │                 │   │  ↓                │   │ /search/         │  │
│  │                 │   │ TRAIN (LightGBM)  │   │   personalize    │  │
│  └─────────────────┘   └──────────────────┘   └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SEARCH SERVICE (NestJS)                            │
│  SearchController → SearchService                                     │
│    1. Elasticsearch (text retrieval)                                  │
│    2. Python inference /search/personalize (re-ranking)               │
│    3. Return personalized results                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Feature Engineering

7 feature engineers produce a 139-dimension vector:

| # | Engineer | Dims | Data Sources | Key Signals |
|---|----------|------|-------------|-------------|
| 1 | LocationFeatureEngineer | 20 | user-activities, location-context, search-events, booking-events, event-lifecycle | Haversine distance, home centroid, venue density, city popularity |
| 2 | CategoryFeatureEngineer | 25 | user-activities, booking-events, search-events, event-lifecycle, recommendation-feedback | Genre affinity, category co-occurrence, Jaccard similarity |
| 3 | CollaborativeFeatureEngineer | 33 (16+16+1) | booking-events, user-activities, recommendation-feedback | ALS matrix factorization, latent user/event factors, dot-product affinity |
| 4 | TemporalFeatureEngineer | 12 | user-activities, booking-events, search-events | 24h/7d histograms, peak hour, weekend ratio, lead time |
| 5 | EngagementFeatureEngineer | 15 | user-activities, recommendation-feedback | Funnel rates, dwell time, CTR, session depth |
| 6 | InterestSimilarityFeatureEngineer | 18 | user-activities, event-lifecycle, booking-events | Jaccard/Dice overlap, interest coverage, tag profiles, freshness |
| 7 | ParticipantCooccurrenceFeatureEngineer | 16 | booking-events, user-activities | Co-attendee count, Jaccard overlap, cohort affinity, recency |

## Training Pipeline

### Data Pipeline (`ml-training/data_pipeline.py`)

ETLT (Extract-Transform-Load-Train) orchestrator:

1. **EXTRACT**: Read from event topic archives (6 topics) → structured DataFrames
2. **TRANSFORM**: Run all 7 feature engineers, concatenate into 139-dim vectors, build labels
3. **LOAD**: Write to Redis Feature Store + .npy training files
4. **TRAIN**: Train LightGBM LambdaMART ranker with NDCG optimization

### Embedding Training (`ml-training/trainers/embedding_trainer.py`)

Two-tower architecture:

- **User Tower**: user_features → Dense(256) → BN → ReLU → Dropout(0.2) → Dense(128) → BN → ReLU → Dense(64) → L2_Norm
- **Event Tower**: event_features → Dense(256) → BN → ReLU → Dropout(0.2) → Dense(128) → BN → ReLU → Dense(64) → L2_Norm
- **Loss**: InfoNCE contrastive with temperature scaling, in-batch negatives + explicit negatives
- **Optimizer**: AdamW with cosine annealing LR schedule
- **Fallback**: TruncatedSVD matrix factorization (always works without PyTorch)

### Ranking Model (`ml-training/trainers/ranking_trainer.py`)

- **Primary**: LightGBM LambdaMART (listwise NDCG optimization)
- **Fallback**: XGBoost rank:ndcg
- **Hyperparameters**: 500 trees, 127 leaves, LR=0.05, L1/L2=0.1, early stopping at 50 rounds
- **Evaluation**: NDCG@5/10/20, Recall@5/10/20, Precision@5/10/20, MRR, MAP

## Inference Service

### Candidate Generation (`inference/candidate_generator.py`)

1. Score all published events via user-event embedding dot product (ANN)
2. Filter by geo-distance (Haversine)
3. Filter by category, genre, price
4. Return top-K candidates for ranking

Fallback to heuristic scoring (booking ratio + time relevance) when no embeddings.

### Ranking (`inference/search_ranker.py`)

1. Extract 139-dim feature vector per (user, candidate) pair
2. Score with LightGBM/XGBoost model
3. MMR diversity re-ranking (category-based similarity)
4. Return top-K with explanation features

### Search Personalization (`inference/search_personalizer.py`)

1. Receive raw search results with text relevance scores (from Elasticsearch)
2. Extract features + score with personalization model
3. Blend: alpha * text_score + (1-alpha) * personalization_score
4. MMR diversity re-ranking on blended scores

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check + model status |
| GET | `/recommendations` | Personalized recommendations with filters |
| GET | `/similar-events/{event_id}` | Embedding-based similar events |
| GET | `/nearby-events` | Location-only recommendations |
| GET | `/trending-events` | Non-personalized trending (cold-start) |
| POST | `/feedback` | Record recommendation feedback |
| POST | `/search/personalize` | Re-rank search results with personalization |

## Training Labels

**Positive (label=1):**
- `booking_confirmed` or `booking_attended` events
- `event_save` activity
- Recommendation `conversion` feedback

**Negative (label=0):**
- Event view without booking (implicit from impressions)
- Recommendation `dismiss` feedback

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `MODEL_PATH` | Path to trained model directory | `/data/training/models` |
| `EMBEDDINGS_PATH` | Path to embeddings pickle file | _(auto-discovered)_ |
| `EVENT_CATALOG_PATH` | JSON file with event metadata | _(none)_ |
| `KAFKA_BROKERS` | Redpanda bootstrap servers | `localhost:9092` |
| `FEATURE_STORE_URL` | Redis URL for feature store | `redis://localhost:6379` |
| `TRAINING_DATA_PATH` | Directory for training data | `/data/training` |
| `PIPELINE_MODE` | `full` or `incremental` | `incremental` |
| `PIPELINE_WINDOW_DAYS` | Days of data window | `30` |
| `USE_NEURAL_EMBEDDINGS` | Enable PyTorch two-tower training | `0` |
| `SEARCH_PERSONALIZATION_ALPHA` | Default blend ratio | `0.4` |
| `MODEL_VERSION` | Model version string | `latest` |
| `HOST` / `PORT` | Inference API bind | `0.0.0.0:8000` |

## Deployment

### Docker Compose

Three services share the same Dockerfile (`apps/python-workers/Dockerfile`):

```yaml
kafka-consumers:  python -m kafka-consumers.user_activity
ml-training:      python -m ml-training.data_pipeline       # one-shot
inference:        uvicorn inference.api:app --port 8000     # persistent
```

### Kubernetes

See `kubernetes/python-workers/` for deployment manifests.

## Model Versioning

Models are saved with versioned filenames:
```
/data/training/models/ranker_v20260510_143000_ndcg0.7234.pkl
/data/training/models/ranker_v20260510_143000_ndcg0.7234_metadata.json
/data/training/models/latest_model.txt  → pointer to latest
/data/training/models/embeddings_v20260510_143000.pkl
```

The inference service auto-discovers the latest model via `latest_model.txt`.
