-- Create databases for each microservice
CREATE DATABASE gateway_db;
CREATE DATABASE auth_db;
CREATE DATABASE user_db;
CREATE DATABASE vendor_db;
CREATE DATABASE event_db;
CREATE DATABASE booking_db;
CREATE DATABASE notification_db;
CREATE DATABASE analytics_db;   -- PLANNED: analytics-service is a stub, DB exists for future implementation
CREATE DATABASE admin_db;
CREATE DATABASE agent_db;

-- Grant privileges to the eventbooking user
GRANT ALL PRIVILEGES ON DATABASE gateway_db TO eventbooking;
GRANT ALL PRIVILEGES ON DATABASE auth_db TO eventbooking;
GRANT ALL PRIVILEGES ON DATABASE user_db TO eventbooking;
GRANT ALL PRIVILEGES ON DATABASE vendor_db TO eventbooking;
GRANT ALL PRIVILEGES ON DATABASE event_db TO eventbooking;
GRANT ALL PRIVILEGES ON DATABASE booking_db TO eventbooking;
GRANT ALL PRIVILEGES ON DATABASE notification_db TO eventbooking;
GRANT ALL PRIVILEGES ON DATABASE analytics_db TO eventbooking;
GRANT ALL PRIVILEGES ON DATABASE admin_db TO eventbooking;
GRANT ALL PRIVILEGES ON DATABASE agent_db TO eventbooking;

CREATE DATABASE vector_db;
GRANT ALL PRIVILEGES ON DATABASE vector_db TO eventbooking;

-- Enable pgvector extension in agent_db for RAG document embeddings
\c agent_db
CREATE EXTENSION IF NOT EXISTS vector;

-- Set up vector_db for recommendation embeddings (user + event vectors)
\c vector_db
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS event_embeddings (
    event_id VARCHAR(50) PRIMARY KEY,
    embedding vector(64) NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_embeddings (
    user_id VARCHAR(50) PRIMARY KEY,
    embedding vector(64) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- HNSW index for fast cosine similarity search over event embeddings
CREATE INDEX IF NOT EXISTS idx_event_embeddings_vector
    ON event_embeddings USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 200);

-- HNSW index for user embedding lookups
CREATE INDEX IF NOT EXISTS idx_user_embeddings_vector
    ON user_embeddings USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 200);