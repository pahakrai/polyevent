-- Neon Database Dump: auth_db
-- Generated: 2026-05-10
-- Source: Neon project cool-heart-97084290 (polyevent), branch br-solitary-bread-an7s2n25 (production)

-- Create enum types
DO $$ BEGIN
    CREATE TYPE role AS ENUM ('USER', 'VENDOR', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id text NOT NULL DEFAULT gen_random_uuid(),
    email text NOT NULL,
    password text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    phone text,
    role role NOT NULL DEFAULT 'USER'::role,
    location json,
    preferences json,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_unique UNIQUE (email)
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS users_pkey ON public.users USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON public.users USING btree (email);

-- Insert data
INSERT INTO users (id, email, password, first_name, last_name, phone, role, location, preferences, created_at, updated_at)
VALUES (
    'f09fa9d2-d4f9-42f5-9cb7-b0078adc8e3b',
    'pahakadmin@polydom.io',
    '$2a$10$WnmXF8fMaTJeik/JTTL1NOBwxULuqE9u7O7imtYjhHcJsGEZO77d.',
    'Pahak',
    'Admin',
    NULL,
    'ADMIN',
    '{"city":"Helsinki","country":"Finland","latitude":60.1699,"longitude":24.9384}',
    '{"musicalGenres":[],"notificationSettings":{"email":true,"sms":false,"push":true,"marketingEmails":false},"searchRadius":50}',
    '2026-04-30 11:25:37.965',
    '2026-04-30 11:25:37.965'
)
ON CONFLICT (id) DO NOTHING;
