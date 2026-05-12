-- Truncate all tables across all service databases
-- DESTRUCTIVE — wipes all records but keeps schemas and extensions
\c auth_db
TRUNCATE users, user_activities, refresh_tokens CASCADE;

\c user_db
TRUNCATE users, user_activities, groups, group_members CASCADE;

\c vendor_db
TRUNCATE vendors, venues, time_slots CASCADE;

\c event_db
TRUNCATE events CASCADE;

\c booking_db
TRUNCATE bookings, payments, booking_activities CASCADE;

\c agent_db
TRUNCATE investigation_sessions, documents, document_chunks CASCADE;

\c vector_db
TRUNCATE event_embeddings, user_embeddings CASCADE;
