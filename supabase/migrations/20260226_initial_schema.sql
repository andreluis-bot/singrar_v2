-- Migração Inicial SeaTrack Pro v2

-- 1. Profiles (extensão do auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  nickname text,
  avatar_url text,
  vessel_name text,
  vessel_type text,
  engine text,
  registration text,
  home_port text,
  is_public boolean default true,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS para Profiles
alter table public.profiles enable row level security;
create policy "Perfis são públicos" on public.profiles for select using (true);
create policy "Usuários podem editar próprio perfil" on public.profiles for update using (auth.uid() = id);
create policy "Inserção automática via trigger" on public.profiles for insert with check (auth.uid() = id);

-- 2. Emergencies (Log de SOS)
create table if not exists public.emergencies (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  lat double precision not null,
  lng double precision not null,
  type text default 'sos',
  status text default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS para Emergencies
alter table public.emergencies enable row level security;
create policy "SOS são visíveis para todos" on public.emergencies for select using (true);
create policy "Usuários podem criar próprio SOS" on public.emergencies for insert with check (auth.uid() = user_id);

-- 3. Community Markers
create table if not exists public.community_markers (
  id uuid default gen_random_uuid() primary key,
  lat double precision not null,
  lng double precision not null,
  type text not null, -- 'hazard', 'ramp', 'gas', etc.
  name text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  created_by uuid references auth.users
);

-- RLS para Markers
alter table public.community_markers enable row level security;
create policy "Markers são públicos" on public.community_markers for select using (true);
create policy "Usuários autenticados criam markers" on public.community_markers for insert with check (auth.role() = 'authenticated');

-- 4. Marcadores de Heading (opcional, mas bom pra cache)
create table if not exists public.vessel_positions (
  id uuid references auth.users on delete cascade primary key,
  lat double precision not null,
  lng double precision not null,
  heading double precision,
  speed double precision,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable Realtime
alter publication supabase_realtime add table public.emergencies;
alter publication supabase_realtime add table public.community_markers;
alter publication supabase_realtime add table public.vessel_positions;
