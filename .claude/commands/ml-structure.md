# /ml-structure

## Machine Learning Architecture — Current Implementation

### Purpose

This platform provides personalized event recommendations and search ranking powered by a Python ML stack. The system learns from user behavior streams (views, clicks, bookings, searches) to train ranking models and embedding models, then serves real-time predictions via a FastAPI inference API.

---

## Directory Structure

```
apps/python-workers/
  Dockerfile                          # python:3.11-slim, shared image for all 3 services
  requirements.txt                    # All Python dependencies

  schemas/                            # Pydantic v2 models for Kafka message validation
    __init__.py
    user_activity.py                  # Topic: user-activities (page_view, event_view, click, etc.)
    event_lifecycle.py                # Topic: event-lifecycle (created, published, cancelled, etc.)
    booking_events.py                 # Topic: booking-events (initiated, confirmed, cancelled, etc.)
    search_events.py                  # Topic: search-events (performed, result_clicked, abandoned)
    recommendation_feedback.py        # Topic: recommendation-feedback (impression, click, conversion, dismiss)
    location_context.py               # Topic: location-context (search, nearby, map_pan, geofence)

  kafka-consumers/
    user_activity.py                  # Real-time Kafka consumer, updates Redis feature store

  inference/
    api.py                            # FastAPI app (7 endpoints on port 8000)
    candidate_generator.py            # pgvector ANN search + heuristic fallback
    search_ranker.py                  # LightGBM/XGBoost ranker with MMR diversity
    search_personalizer.py            # Blends Elasticsearch text score with personalization
    session_vector.py                 # Real-time session vector from recent clicks (EMA)

  ml-training/
    data_pipeline.py                  # Orchestrator: Extract → Transform → Load → Train
    feature_engineering.py            # 7 feature engineers + Redis FeatureStore (~1768 lines)
    pgvector_loader.py                # Batch loads embeddings to pgvector with HNSW index

    trainers/
      __init__.py
      ranking_trainer.py              # LightGBM LambdaMART / XGBoost rank:ndcg
      embedding_trainer.py            # SVD baseline + optional PyTorch TwoTower (InfoNCE)
      evaluation.py                   # NDCG, recall, precision, MRR, MAP at multiple cutoffs

  docs/
    ARCHITECTURE.md                   # (may contain aspirational content)
    TRACKING_EVENTS.md                # (may contain aspirational content)
```

---

## Data Flow

```
Frontend → API Gateway → Kafka (6 topics, 6 partitions each)
                              │
                              ▼
                    Kafka Consumer (user_activity.py)
                              │
                    ┌─────────┼─────────┐
                    │         │         │
                    ▼         ▼         ▼
              Redis FS   Cache inval.  (placeholder for search events)
              (clicks)   (booking→inval
                          inference vec)

                    ┌────────────────────────┐
                    │  ML Training Pipeline   │  CronJob daily @ 4AM
                    │  data_pipeline.py       │
                    │                         │
                    │  Extract: PostgreSQL    │  Direct DB queries:
                    │    - events             │    event_db.public.events
                    │    - user activities    │    user_db.public.user_activities
                    │    - bookings           │    user_db.public.users
                    │                         │
                    │  Transform: 7 feature   │  139-dim feature vector:
                    │    engineers            │    Location(20) + Category(25)
                    │    - location           │    + Collaborative(33) + Temporal(12)
                    │    - category           │    + Engagement(15) +
                    │    - collaborative      │      InterestSimilarity(18)
                    │    - temporal           │    + Participant(16)
                    │    - engagement         │
                    │    - interest_similarity│
                    │    - participant        │
                    │                         │
                    │  Load: Redis + .npy     │
                    │                         │
                    │  Train:                 │
                    │    RankingTrainer       │  LightGBM LambdaMART (500 trees)
                    │    EmbeddingTrainer     │  TruncatedSVD (64-dim)
                    │                         │     or TwoTower NN if
                    │                         │     USE_NEURAL_EMBEDDINGS=1
                    │                         │
                    │  Export:                │
                    │    Parquet embeddings   │  event_vectors.parquet
                    │    Event catalog JSON   │  user_vectors.parquet
                    │    Model pickle         │  event_catalog.json
                    │                         │    latest_model.txt
                    └────────────┬────────────┘
                                 │
                    pgvector_loader.py
                    (BULK_LOAD_PGVECTOR=1)
                                 │
                                 ▼
                    PostgreSQL + pgvector
                    (HNSW index, cosine distance)
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────┐
│  Inference API (FastAPI, 3 replicas, port 8000)          │
│                                                          │
│  GET  /health                                            │
│  GET  /recommendations  ← candidates + rank + MMR        │
│  GET  /similar-events/{id}                               │
│  GET  /nearby-events                                     │
│  GET  /trending-events                                   │
│  POST /feedback          → produces Kafka feedback event │
│  POST /search/personalize  ← re-ranks ES results + blend │
│  POST /inference-vector  ← session vector from clicks    │
│                                                          │
│  Pipeline:                                               │
│    CandidateGenerator (pgvector ANN + metadata filters)  │
│    → SearchRanker (model predict + MMR diversity)        │
│    → Response with scores + explanation features         │
└──────────────────────────────────────────────────────────┘
```

---

## Service Entry Points

| Service | Entry Point | Platform | Replicas | Resources |
|---------|-------------|----------|----------|-----------|
| Kafka Consumer | `python -m kafka-consumers.user_activity` | Deployment | 2 | 256Mi/250m req, 512Mi/500m limit |
| Inference API | `uvicorn inference.api:app --host 0.0.0.0 --port 8000` | Deployment + HPA | 3 (2–8) | 512Mi/500m req, 2Gi/2CPU limit |
| ML Training | `python -m ml-training.data_pipeline` | CronJob (daily 4AM) | 1 | 1Gi/1CPU req, 4Gi/4CPU limit |

All three use the same Docker image (`polydom/python-workers:latest`) with different entrypoint overrides.

---

## Kafka Topics

| Topic | Partitions | Purpose |
|-------|-----------|---------|
| `user-activities` | 6 | Page views, event views, clicks, saves, shares, category/location browses, vendor interactions, session events |
| `event-lifecycle` | 6 | Event CRUD lifecycle events (created, updated, published, cancelled, completed, sold_out, rescheduled) |
| `booking-events` | 6 | Booking flow events (initiated, confirmed, cancelled, attended, no_show, refunded) |
| `search-events` | 6 | Search queries, result clicks, abandoned searches |
| `recommendation-feedback` | 6 | Rec impressions, clicks, conversions, dismissals |
| `location-context` | 6 | Location searches, nearby queries, map interactions, geofence events |

---

## Feature Engineering (7 engineers, 139 total dimensions)

### 1. LocationFeatureEngineer (20 dims)
Home lat/lon centroid, event lat/lon, Haversine distances (from home + current), typical radius, unique cities/neighborhoods, location entropy, lat/lon std, city popularity percentile (weighted by bookings 2x), venue stats (total bookings, unique users, repeat rate), same-city indicator, within-range indicator.

### 2. CategoryFeatureEngineer (25 dims)
9 categories: CONCERT, WORKSHOP, JAM_SESSION, OPEN_MIC, FESTIVAL, PRIVATE_PARTY, CORPORATE_EVENT, CLASS, OTHER. Genre vocabulary (top 50). User genre/category affinity vectors (weighted: booking_attended=8.0, booking_confirmed=5.0, event_save=4.0, click=1.5, event_view=1.0). Genre Jaccard, overlap, category match, co-occurrence score. User category distribution (6 dims), event category one-hot (6 dims).

### 3. CollaborativeFeatureEngineer (33 dims = 16+16+1)
User-event interaction matrix with weighted interactions. ALS factorization (10 iterations) into 16 user factors + 16 event factors + global/user/event bias. Predicted affinity = bias + dot_product.

### 4. TemporalFeatureEngineer (12 dims)
24-hour activity histogram, 7-day-of-week histogram per user. Average lead time (days before event). Peak hour, preferred DOW, weekend ratio, avg lead, day-part bins (night/morning/afternoon/evening), hour diversity.

### 5. EngagementFeatureEngineer (15 dims)
Per-user: total_activities, view→click rate, click→book rate, view→book rate, avg dwell ms, avg session duration, search frequency. Rec stats: impressions, CTR, conversion rate, dismissal rate. Event-level CTR and conversion rate. Recency placeholder, power-user binary.

### 6. InterestSimilarityFeatureEngineer (18 dims)
Tag vocabulary (top 50), tag IDF weights. User interest vectors (weighted by interaction type), event tag vectors (L2-normalized). Jaccard, Dice, overlap_count, TF-IDF weighted score. User/event profile projections (5 dims each). Freshness, overlap binary.

### 7. ParticipantCooccurrenceFeatureEngineer (16 dims)
User-event bipartite graph from confirmed/attended bookings. Co-attendee graph (overlap = shared events). Coattendee count (raw + log), avg events, cohort category diversity, Jaccard mean, max overlap, n_common_events, category/genre affinity, event popularity, embedding projections.

---

## Model Training

### Ranking Model
- **Default**: LightGBM LambdaMART
  - objective=`lambdarank`, metric=ndcg@[5,10,20]
  - 127 leaves, LR=0.05, 500 estimators
  - Feature/bagging fraction 0.8, L1/L2=0.1
  - Early stopping 50 rounds
- **Fallback**: XGBoost rank:ndcg (max_depth=8, LR=0.05)
- **Fallback**: Random scoring (no model loaded)
- Saved as pickle with feature_names and hyperparameters
- Filename includes NDCG score, `latest_model.txt` pointer updated

### Embedding Model
- **Primary**: TruncatedSVD (64-dim) on sparse user-event interaction matrix
- **Optional**: PyTorch TwoTowerModel with InfoNCE contrastive loss
  - UserTower: BatchNorm1d → [256, 128] → L2-normalized output (64-dim)
  - EventTower: Same architecture
  - InfoNCE loss with temperature=0.07
  - AdamW optimizer, cosine annealing LR, gradient clipping (max_norm=5.0)
  - In-batch negatives + explicit negatives
  - CUDA support if available
  - Enabled via `USE_NEURAL_EMBEDDINGS=1` (default: 0 in CronJob)

### Evaluation Metrics
NDCG@[5,10,20,50], Recall@K, Precision@K, MRR, MAP. User-level and global aggregation. 80/20 train/test split.

---

## Inference Pipeline

### Candidate Generation
1. **pgvector path** (primary): Cosine distance (`<=>`) query with SQL WHERE filters on JSONB metadata fields (category, genre, price, geo bounding-box). Exact Haversine post-filter. HNSW index (m=16, ef_construction=200).
2. **Heuristic fallback** (no pgvector): In-memory scoring by `fill_ratio * 0.5 + time_score * 0.3 + 0.2` with category/genre/price/distance filters.

### Feature Extraction (at inference time)
`InferenceFeatureExtractor` mirrors the 7 offline feature engineers but operates on in-memory cached user/event profiles (no DB queries at inference time). Same 139-dim output.

### Ranking
Model predict (LightGBM Booster / XGBoost DMatrix) → MMR re-ranking for category diversity → top-K with explanation features (distance, genre similarity, category match, embedding affinity, interest Jaccard, coattendee info).

### Search Personalization
Re-ranks raw Elasticsearch results: `alpha * text_score + (1-alpha) * personalization_score` (default alpha=0.4). Same MMR diversity step.

### Session Vectors
Real-time computation from recent event clicks using exponential moving average: each event embedding weighted by `decay^i` where i=position from most recent. L2-normalized. Blends with batch user embedding if available. 30-min Redis TTL.

---

## Infrastructure

### Redis Feature Store
Key patterns:
- `features:user:{userId}` — HSET of user features (numpy arrays as bytes)
- `features:event:{eventId}` — HSET of event features
- `inference_vector:{userId}` — Cached session vector (30-min TTL)
- `recent_clicks:{userId}` — LPUSH/LTRIM list of recent event IDs

### PostgreSQL + pgvector
- Image: `pgvector/pgvector:pg15`
- Tables: `event_embeddings` (event_id, embedding vector(64)), `user_embeddings` (user_id, embedding vector(64))
- Index: HNSW with vector_cosine_ops (m=16, ef_construction=200)
- Zero-downtime reload: DROP INDEX → TRUNCATE → batch INSERT → CREATE INDEX in a transaction

### PVC
- `training-data-pvc`: 50Gi, ReadWriteMany
- Shared between ml-training CronJob (writes models) and inference Deployment (reads models)
- Requires NFS/EFS/Filestore provisioner for RWX support

### Model Artifacts
Stored on the shared PVC at training data path:
- `model_ndcg_*.pkl` — pickled LightGBM/XGBoost model
- `latest_model.txt` — pointer to current model file
- `model_metadata.json` — metrics, input shape, hyperparameters
- `event_vectors.parquet` / `user_vectors.parquet` — embedding exports
- `event_catalog.json` — published event metadata for candidate generator
- `embeddings_latest_*.pkl` — pickled embedding dicts
- `latest_embeddings.txt` — pointer to current embeddings

---

## Deployment

### Kubernetes (separate kustomization at `kubernetes/python-workers/`)
- NOT included in base kustomization — deployed independently
- NOT included in Skaffold dev loop
- NOT included in production/staging overlays

### Docker Compose (for local dev)
All three services (`kafka-consumers`, `ml-training`, `inference`) defined in `docker-compose.yml` with shared `training_data` volume.

### CI/CD
GitHub Actions (`deploy.yaml`, `pr-check.yaml`) have special python-workers detection logic but skip python-workers during image tag updates and rollout verification.

---

## What is NOT yet implemented (stubs/placeholders)

- `search_events` handler in Kafka consumer is a no-op placeholder
- `feedback` endpoint produces to Kafka but does not trigger online model updates
- Neural embeddings (`USE_NEURAL_EMBEDDINGS`) disabled in production CronJob (set to 0)
- Skaffold integration for python-workers does not exist
- No Helm charts exist
- `recommenders/`, `activity_analyzer.py`, `booking_analytics.py`, `vendor_performance.py` mentioned in README do not exist
- Most Kakfa streaming topics (search-events, recommendation-feedback, location-context) return empty DataFrames in the training pipeline — they have schemas defined but the extract phase only has real queries for events, user activities, and bookings
- TensorFlow, PySpark, and Apache Airflow are in `requirements.txt` but not imported anywhere

---

## Environment Variables

| Variable | Used By | Default |
|----------|---------|---------|
| `MODEL_PATH` | Inference | auto-discovered from `latest_model.txt` |
| `EMBEDDINGS_PATH` | Inference | auto-discovered from `latest_embeddings.txt` |
| `EVENT_CATALOG_PATH` | Inference | `event_catalog.json` on PVC |
| `VECTOR_DATABASE_URL` | Inference, Training | `postgresql://.../vector_db` |
| `SOURCE_DATABASE_URL` | Training | `postgresql://.../eventbooking` |
| `FEATURE_STORE_URL` | All | `redis://localhost:6379` |
| `KAFKA_BROKERS` | Consumer, Inference | from ConfigMap |
| `SEARCH_PERSONALIZATION_ALPHA` | Inference | `0.4` |
| `PIPELINE_MODE` | Training | `incremental` |
| `PIPELINE_WINDOW_DAYS` | Training | `7` |
| `USE_NEURAL_EMBEDDINGS` | Training | `0` (CronJob), `1` (ConfigMap) |
| `BULK_LOAD_PGVECTOR` | Training | `1` |
| `EXPORT_PARQUET` | Training | `1` |
| `EXPORT_EVENT_CATALOG` | Training | `1` |
| `TRAINING_DATA_PATH` | Training | `/data/training` |

---

## Key Dependencies

| Package | Actually Used? | Purpose |
|---------|---------------|---------|
| lightgbm | YES | Ranking model (LambdaMART) |
| xgboost | YES (fallback) | Ranking model (rank:ndcg) |
| torch | YES (optional) | TwoTower embedding neural network |
| scikit-learn | YES | TruncatedSVD, train_test_split |
| numpy | YES | Core array operations throughout |
| pandas | YES | Data extraction and transformation |
| scipy | YES | Sparse matrix for SVD |
| confluent-kafka | YES | Kafka consumer + producer |
| fastapi + uvicorn | YES | Inference API server |
| redis | YES | Feature store, caching, recent clicks |
| pydantic | YES | Schema validation |
| psycopg2 | YES | PostgreSQL queries (training pipeline) |
| psycopg2-binary | YES | pgvector queries (candidate generator) |
| pyarrow | YES (conditional) | Parquet export |
| prometheus-client | NO (imported but unused) | Metrics (probably intended for FastAPI metrics endpoint) |
| tensorflow | NO (in requirements but never imported) | Not used |
| pyspark | NO (in requirements but never imported) | Not used |
| apache-airflow | NO (in requirements but never imported) | Not used |
| avro-python3 | NO (in requirements but never imported) | Not used (JSON serialization is used instead) |
| python-dotenv | Not imported | Likely loaded by uvicorn/FastAPI startup |
| requests | Not imported | Not used in current code |
