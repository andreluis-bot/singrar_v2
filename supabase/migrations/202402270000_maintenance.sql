-- Migration: Maintenance Records
CREATE TABLE IF NOT EXISTS public.maintenance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    engine_hours FLOAT DEFAULT 0,
    cost FLOAT DEFAULT 0,
    mechanic TEXT,
    photo_url TEXT,
    next_due_hours FLOAT,
    next_due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own maintenance"
    ON public.maintenance_records
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Planned Routes (Missing in some environments)
CREATE TABLE IF NOT EXISTS public.planned_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    points JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.planned_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own planned routes"
    ON public.planned_routes
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
