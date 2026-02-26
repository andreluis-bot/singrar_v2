-- Supabase Schema for Singrar
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Vessels Table (Linked to Auth Users)
CREATE TABLE vessels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  registration_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE vessels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own vessels" ON vessels FOR ALL USING (auth.uid() = user_id);

-- 2. Positions Table (For Real-time Tracking and Route History)
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vessel_id UUID REFERENCES vessels(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  emergency BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their positions" ON positions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM vessels WHERE id = vessel_id AND user_id = auth.uid())
);
CREATE POLICY "Users can view their positions" ON positions FOR SELECT USING (
  EXISTS (SELECT 1 FROM vessels WHERE id = vessel_id AND user_id = auth.uid())
);

-- 3. Planned Routes (Cloud Sync)
CREATE TABLE planned_routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  points JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE planned_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their routes" ON planned_routes FOR ALL USING (auth.uid() = user_id);

-- 4. Tracking Links (Public Sharing)
CREATE TABLE sharing_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vessel_id UUID REFERENCES vessels(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Public read if active and token matches)
ALTER TABLE sharing_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active sharing links" ON sharing_links FOR SELECT USING (active = TRUE AND (expires_at IS NULL OR expires_at > NOW()));
CREATE POLICY "Users can manage their links" ON sharing_links FOR ALL USING (
  EXISTS (SELECT 1 FROM vessels WHERE id = vessel_id AND user_id = auth.uid())
);

-- Functions & Triggers for updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_vessels_updated_at BEFORE UPDATE ON vessels FOR EACH ROW EXECUTE FUNCTION set_updated_at();
