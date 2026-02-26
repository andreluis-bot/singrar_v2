import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "./lib/supabase";

export type SpeedUnit = 'kt' | 'kmh' | 'mph';
export type NavItem = 'weather' | 'tides' | 'logbook' | 'events' | 'achievements' | 'settings';

export interface Location {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number;
}

export interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  name: string;
  icon: string;
  color: string;
  createdAt: number;
  audio?: string;
  photo?: string;
}

export interface LogEntry {
  id: string;
  lat: number;
  lng: number;
  type: "fishing" | "jetski" | "wakesurf" | "diving" | "other";
  title: string;
  notes: string;
  photo?: string;
  createdAt: number;
  // Fishing specific
  species?: string;
  weight?: number;
  length?: number;
}

export interface TrackPoint {
  lat: number;
  lng: number;
  timestamp: number;
  speed?: number;
}

export interface Track {
  id: string;
  name: string;
  points: TrackPoint[];
  color: string;
  createdAt: number;
  visible?: boolean;
}

export interface PlannedRoute {
  id: string;
  name: string;
  points: { lat: number; lng: number }[];
  createdAt: number;
}

export interface CommunityMarker {
  id: string;
  lat: number;
  lng: number;
  type: "hazard" | "ramp" | "gas" | "marina" | "hangout" | "fishing";
  name: string;
  description: string;
  createdAt: number;
  createdBy: string;
}

export interface NMEAData {
  depth: number | null;
  sog: number | null;
  stw: number | null;
  awa: number | null;
  aws: number | null;
  twa: number | null;
  tws: number | null;
}

export interface OfflineRegion {
  id: string;
  name: string;
  size: string;
  downloadedAt: number;
}

export interface NauticalEvent {
  id: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  date: number;
  type: "jetski" | "boat" | "fishing" | "social";
  organizer: string;
  attendees: string[];
  createdAt: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: number;
  condition: {
    type: "tracks_count" | "waypoints_count" | "catches_count" | "events_joined" | "distance_total";
    value: number;
  };
}

export interface AnchorAlarm {
  active: boolean;
  lat: number;
  lng: number;
  radius: number;
  triggered?: boolean;
  acknowledged?: boolean;
}

export interface OnlineUser {
  id: string;
  email?: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  updatedAt: number;
  sos?: boolean;
}

export interface AppState {
  user: any | null;
  setUser: (user: any | null) => void;
  isOfflineMode: boolean;
  setOfflineMode: (isOffline: boolean) => void;
  location: Location | null;
  setLocation: (loc: Location) => void;

  waypoints: Waypoint[];
  addWaypoint: (wp: Omit<Waypoint, "id" | "createdAt">) => void;
  removeWaypoint: (id: string) => void;
  updateWaypoint: (id: string, data: Partial<Waypoint>) => void;

  logEntries: LogEntry[];
  addLogEntry: (l: Omit<LogEntry, "id" | "createdAt">) => void;
  removeLogEntry: (id: string) => void;

  tracks: Track[];
  addTrack: (t: Omit<Track, "id" | "createdAt">) => void;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, data: Partial<Track>) => void;

  plannedRoutes: PlannedRoute[];
  addPlannedRoute: (r: Omit<PlannedRoute, "id" | "createdAt">) => void;
  removePlannedRoute: (id: string) => void;

  communityMarkers: CommunityMarker[];
  addCommunityMarker: (m: Omit<CommunityMarker, "id" | "createdAt">) => void;
  removeCommunityMarker: (id: string) => void;

  events: NauticalEvent[];
  addEvent: (e: Omit<NauticalEvent, "id" | "createdAt">) => void;
  removeEvent: (id: string) => void;
  joinEvent: (id: string, userEmail: string) => void;
  leaveEvent: (id: string, userEmail: string) => void;

  achievements: Achievement[];
  checkAchievements: () => void;

  isRecording: boolean;
  currentTrack: TrackPoint[];
  startRecording: () => void;
  stopRecording: (name: string) => void;
  addTrackPoint: (point: TrackPoint) => void;

  nmeaData: NMEAData;
  setNmeaData: (data: Partial<NMEAData>) => void;

  anchorAlarm: AnchorAlarm;
  setAnchorAlarm: (data: Partial<AnchorAlarm>) => void;

  emergency: boolean;
  setEmergency: (val: boolean) => void;

  collisionCountdown: number | null;
  setCollisionCountdown: (val: number | null) => void;

  // Alertas e Status
  weatherAlert: string | null;
  setWeatherAlert: (msg: string | null) => void;

  forecastLocation: { lat: number; lng: number } | null;
  setForecastLocation: (loc: { lat: number; lng: number } | null) => void;

  settings: {
    unitSystem: "metric" | "imperial";
    mapType: "satellite" | "street" | "nautical";
    showWeatherLayer: boolean;
    weatherLayerType?: "wind" | "rain";
    offlineMode: boolean;
    radarEnabled: boolean;
    nmea: {
      enabled: boolean;
      ip: string;
      port: string;
      useSimulator: boolean;
    };
    offlineRegions: OfflineRegion[];
  };
  updateSettings: (settings: Partial<AppState["settings"]>) => void;
  addOfflineRegion: (region: Omit<OfflineRegion, "id" | "downloadedAt">) => void;
  removeOfflineRegion: (id: string) => void;

  speedUnit: SpeedUnit;
  setSpeedUnit: (unit: SpeedUnit) => void;

  navItems: NavItem[];
  setNavItems: (items: NavItem[]) => void;

  deviceHeading: number | null;
  setDeviceHeading: (heading: number | null) => void;

  onlineUsers: Record<string, OnlineUser>;
  setOnlineUsers: (updater: Record<string, OnlineUser> | ((prev: Record<string, OnlineUser>) => Record<string, OnlineUser>)) => void;

  syncData: () => Promise<void>;

  // Perfil do Usuário
  profile: UserProfile | null;
  setProfile: (profile: Partial<UserProfile>) => void;
}

export interface UserProfile {
  id?: string;
  avatar_url?: string;
  nickname: string;
  vessel_name: string;
  vessel_type: string;
  engine: string;
  registration: string;
  home_port: string;
  is_public: boolean;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      setUser: (user) => set({ user }),
      isOfflineMode: false,
      setOfflineMode: (isOfflineMode) => set({ isOfflineMode }),
      location: null,
      setLocation: (location) => set({ location }),

      waypoints: [],
      addWaypoint: (wp) => {
        const id = crypto.randomUUID();
        const createdAt = Date.now();
        const newWp = { ...wp, id, createdAt };

        set((state) => ({
          waypoints: [...(state.waypoints || []), newWp],
        }));

        const state = get();
        if (state.user && !state.isOfflineMode) {
          supabase.from('waypoints').insert({
            id,
            user_id: state.user.id,
            lat: wp.lat,
            lng: wp.lng,
            name: wp.name,
            icon: wp.icon,
            color: wp.color,
            created_at: createdAt,
            audio: wp.audio,
            photo: wp.photo
          }).then(({ error }) => { if (error) console.error("Erro ao salvar waypoint:", error) });
        }
      },
      removeWaypoint: (id) => {
        set((state) => ({
          waypoints: (state.waypoints || []).filter((w) => w.id !== id),
        }));

        const state = get();
        if (state.user && !state.isOfflineMode) {
          supabase.from('waypoints').delete().eq('id', id)
            .then(({ error }) => { if (error) console.error("Erro ao deletar waypoint:", error) });
        }
      },
      updateWaypoint: (id, data) => {
        set((state) => ({
          waypoints: (state.waypoints || []).map((w) =>
            w.id === id ? { ...w, ...data } : w,
          ),
        }));

        const state = get();
        if (state.user && !state.isOfflineMode) {
          supabase.from('waypoints').update(data).eq('id', id)
            .then(({ error }) => { if (error) console.error("Erro ao atualizar waypoint:", error) });
        }
      },

      logEntries: [],
      addLogEntry: (l) =>
        set((state) => ({
          logEntries: [
            ...(state.logEntries || []),
            { ...l, id: crypto.randomUUID(), createdAt: Date.now() },
          ],
        })),
      removeLogEntry: (id) =>
        set((state) => ({
          logEntries: (state.logEntries || []).filter((l) => l.id !== id),
        })),

      tracks: [],
      addTrack: (t) => {
        const id = crypto.randomUUID();
        const createdAt = Date.now();
        const newTrack = { ...t, id, createdAt };

        set((state) => ({
          tracks: [...(state.tracks || []), newTrack],
        }));

        const state = get();
        if (state.user && !state.isOfflineMode) {
          supabase.from('tracks').insert({
            id,
            user_id: state.user.id,
            name: t.name,
            points: t.points,
            color: t.color,
            created_at: createdAt,
            visible: t.visible !== false
          }).then(({ error }) => { if (error) console.error("Erro ao salvar track:", error) });
        }
      },
      removeTrack: (id) => {
        set((state) => ({
          tracks: (state.tracks || []).filter((t) => t.id !== id),
        }));

        const state = get();
        if (state.user && !state.isOfflineMode) {
          supabase.from('tracks').delete().eq('id', id)
            .then(({ error }) => { if (error) console.error("Erro ao deletar track:", error) });
        }
      },
      updateTrack: (id, data) => {
        set((state) => ({
          tracks: (state.tracks || []).map((t) =>
            t.id === id ? { ...t, ...data } : t,
          ),
        }));

        const state = get();
        if (state.user && !state.isOfflineMode) {
          supabase.from('tracks').update({
            name: data.name,
            color: data.color,
            visible: data.visible
          }).eq('id', id)
            .then(({ error }) => { if (error) console.error("Erro ao atualizar track:", error) });
        }
      },

      plannedRoutes: [],
      addPlannedRoute: (r) =>
        set((state) => ({
          plannedRoutes: [
            ...(state.plannedRoutes || []),
            { ...r, id: crypto.randomUUID(), createdAt: Date.now() },
          ],
        })),
      removePlannedRoute: (id) =>
        set((state) => ({
          plannedRoutes: (state.plannedRoutes || []).filter((r) => r.id !== id),
        })),

      communityMarkers: [],
      addCommunityMarker: (m) =>
        set((state) => ({
          communityMarkers: [
            ...(state.communityMarkers || []),
            { ...m, id: crypto.randomUUID(), createdAt: Date.now() },
          ],
        })),
      removeCommunityMarker: (id) =>
        set((state) => ({
          communityMarkers: (state.communityMarkers || []).filter((m) => m.id !== id),
        })),

      events: [],
      addEvent: (e) =>
        set((state) => ({
          events: [
            ...(state.events || []),
            { ...e, id: crypto.randomUUID(), createdAt: Date.now() },
          ],
        })),
      removeEvent: (id) =>
        set((state) => ({
          events: (state.events || []).filter((e) => e.id !== id),
        })),
      joinEvent: (id, userEmail) =>
        set((state) => ({
          events: (state.events || []).map((e) =>
            e.id === id && !(e.attendees || []).includes(userEmail)
              ? { ...e, attendees: [...(e.attendees || []), userEmail] }
              : e
          ),
        })),
      leaveEvent: (id, userEmail) =>
        set((state) => ({
          events: (state.events || []).map((e) =>
            e.id === id ? { ...e, attendees: (e.attendees || []).filter((a) => a !== userEmail) } : e
          ),
        })),

      achievements: [
        { id: "first_track", title: "Explorador Iniciante", description: "Grave sua primeira rota de navegação.", icon: "🧭", condition: { type: "tracks_count", value: 1 } },
        { id: "track_master", title: "Lobo do Mar", description: "Grave 10 rotas diferentes.", icon: "🌊", condition: { type: "tracks_count", value: 10 } },
        { id: "waypoint_pro", title: "Cartógrafo", description: "Marque 5 pontos de interesse no mapa.", icon: "📍", condition: { type: "waypoints_count", value: 5 } },
        { id: "catch_first", title: "Primeira Fisgada", description: "Registre sua primeira captura no diário.", icon: "🐟", condition: { type: "catches_count", value: 1 } },
        { id: "social_butterfly", title: "Comandante Social", description: "Participe de 3 eventos náuticos.", icon: "⚓", condition: { type: "events_joined", value: 3 } },
      ],
      checkAchievements: () =>
        set((state) => {
          const userEmail = state.user?.email || "offline_user@example.com";
          const stats = {
            tracks_count: (state.tracks || []).length,
            waypoints_count: (state.waypoints || []).length,
            catches_count: (state.logEntries || []).filter(l => l.type === 'fishing').length,
            events_joined: (state.events || []).filter(e => (e.attendees || []).includes(userEmail)).length,
            distance_total: 0, // Placeholder if needed
          };

          let changed = false;
          const newAchievements = (state.achievements || []).map((ach) => {
            if (!ach.unlockedAt && stats[ach.condition.type] >= ach.condition.value) {
              changed = true;
              return { ...ach, unlockedAt: Date.now() };
            }
            return ach;
          });

          return changed ? { achievements: newAchievements } : state;
        }),

      isRecording: false,
      currentTrack: [],
      startRecording: () => set({ isRecording: true, currentTrack: [] }),
      stopRecording: (name) =>
        set((state) => {
          if ((state.currentTrack || []).length > 0) {
            const id = crypto.randomUUID();
            const createdAt = Date.now();
            const newTrack: Track = {
              id,
              name,
              points: [...(state.currentTrack || [])],
              color: "#3b82f6",
              createdAt,
              visible: true,
            };

            // Sync to Supabase
            if (state.user && !state.isOfflineMode) {
              supabase.from('tracks').insert({
                id,
                user_id: state.user.id,
                name: newTrack.name,
                points: newTrack.points,
                color: newTrack.color,
                created_at: createdAt,
                visible: true
              }).then(({ error }) => { if (error) console.error("Erro ao salvar track gravada:", error) });
            }

            return {
              isRecording: false,
              currentTrack: [],
              tracks: [...(state.tracks || []), newTrack],
            };
          }
          return { isRecording: false, currentTrack: [] };
        }),
      addTrackPoint: (point) =>
        set((state) => ({
          currentTrack: state.isRecording
            ? [...(state.currentTrack || []), point]
            : (state.currentTrack || []),
        })),

      nmeaData: {
        depth: null,
        sog: null,
        stw: null,
        awa: null,
        aws: null,
        twa: null,
        tws: null,
      },
      setNmeaData: (data) =>
        set((state) => ({
          nmeaData: { ...state.nmeaData, ...data },
        })),

      anchorAlarm: {
        active: false,
        lat: 0,
        lng: 0,
        radius: 50,
        triggered: false,
        acknowledged: false,
      },
      setAnchorAlarm: (data) =>
        set((state) => ({
          anchorAlarm: { ...state.anchorAlarm, ...data },
        })),

      emergency: false,
      setEmergency: (val) => set({ emergency: val }),

      collisionCountdown: null,
      setCollisionCountdown: (val) => set({ collisionCountdown: val }),

      // Alertas
      weatherAlert: null,
      setWeatherAlert: (msg) => set({ weatherAlert: msg }),

      forecastLocation: null,
      setForecastLocation: (loc) => set({ forecastLocation: loc }),

      // Perfil
      profile: null,
      setProfile: (update) => set((s) => ({ profile: { ...(s.profile || {}), ...update } as UserProfile })),

      settings: {
        unitSystem: "metric",
        mapType: "nautical",
        showWeatherLayer: false,
        weatherLayerType: "wind",
        offlineMode: false,
        radarEnabled: true,
        nmea: {
          enabled: false,
          ip: "192.168.1.100",
          port: "10110",
          useSimulator: true,
        },
        offlineRegions: [],
      },
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
      addOfflineRegion: (region) =>
        set((state) => ({
          settings: {
            ...state.settings,
            offlineRegions: [
              ...(state.settings.offlineRegions || []),
              { ...region, id: crypto.randomUUID(), downloadedAt: Date.now() },
            ],
          },
        })),
      removeOfflineRegion: (id) =>
        set((state) => ({
          settings: {
            ...state.settings,
            offlineRegions: (state.settings.offlineRegions || []).filter((r) => r.id !== id),
          },
        })),

      speedUnit: 'kt',
      setSpeedUnit: (unit) => set({ speedUnit: unit }),

      navItems: ['weather', 'tides', 'logbook'],
      setNavItems: (items) => set({ navItems: items }),

      deviceHeading: null,
      setDeviceHeading: (heading) => set({ deviceHeading: heading }),

      onlineUsers: {},
      setOnlineUsers: (updater) => set((state) => ({
        onlineUsers: typeof updater === 'function' ? updater(state.onlineUsers) : updater
      })),

      syncData: async () => {
        const state = get();
        if (!state.user || state.isOfflineMode) return;

        try {
          const [wpRes, trRes] = await Promise.all([
            supabase.from('waypoints').select('*'),
            supabase.from('tracks').select('*')
          ]);

          if (wpRes.data) {
            const syncedWaypoints = wpRes.data.map(w => ({
              id: w.id,
              lat: w.lat,
              lng: w.lng,
              name: w.name,
              icon: w.icon,
              color: w.color,
              createdAt: w.created_at,
              audio: w.audio,
              photo: w.photo
            }));
            set({ waypoints: syncedWaypoints });
          }

          if (trRes.data) {
            const syncedTracks = trRes.data.map(t => ({
              id: t.id,
              name: t.name,
              points: t.points,
              color: t.color,
              createdAt: t.created_at,
              visible: t.visible
            }));
            set({ tracks: syncedTracks });
          }
        } catch (err) {
          console.error("Erro ao sincronizar dados:", err);
        }
      },
    }),
    {
      name: "marine-nav-storage",
      partialize: (state) => ({
        waypoints: state.waypoints,
        logEntries: state.logEntries,
        tracks: state.tracks,
        plannedRoutes: state.plannedRoutes,
        communityMarkers: state.communityMarkers,
        events: state.events,
        achievements: state.achievements,
        settings: state.settings,
        anchorAlarm: state.anchorAlarm,
        speedUnit: state.speedUnit,
        navItems: state.navItems,
        isOfflineMode: state.isOfflineMode,
      }),
    },
  ),
);
