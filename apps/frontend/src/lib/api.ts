import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor ────────────────────────────────────────────────

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const userId = localStorage.getItem('userId') || 'anonymous';
    const sessionId = sessionStorage.getItem('sessionId') || generateSessionId();
    config.headers['x-user-id'] = userId;
    config.headers['x-session-id'] = sessionId;

    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

function generateSessionId(): string {
  const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  sessionStorage.setItem('sessionId', id);
  return id;
}

// ── Token refresh ──────────────────────────────────────────────────────

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => {
    if (error || !token) {
      p.reject(error);
    } else {
      p.resolve(token);
    }
  });
  failedQueue = [];
}

async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  try {
    const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
    const newAccessToken = data.accessToken;
    const newRefreshToken = data.refreshToken;

    localStorage.setItem('authToken', newAccessToken);
    localStorage.setItem('refreshToken', newRefreshToken);

    try {
      const { useAuthStore } = await import('@/stores/auth-store');
      useAuthStore.getState().setTokens(newAccessToken, newRefreshToken);
    } catch {
      // Store import may fail during SSR
    }

    return newAccessToken;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (originalRequest?.url === '/auth/refresh') {
      return Promise.reject(error);
    }

    if (error?.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers['Authorization'] = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const newToken = await tryRefreshToken();

      if (newToken) {
        processQueue(null, newToken);
        isRefreshing = false;
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return api(originalRequest);
      }

      processQueue(new Error('Refresh failed'), null);
      isRefreshing = false;

      if (typeof window !== 'undefined') {
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userId');
        window.location.href = '/login';
      }

      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);


// ── Jam Sessions ───────────────────────────────────────────────────────

export interface JamSession {
  id: string;
  title: string;
  description: string;
  category: string;
  startTime: string;
  endTime: string;
  location: any;
  instrumentsWanted: string[];
  hostId: string;
  rsvpCount: number;
  maxAttendees?: number;
  tags: string[];
  status: string;
  groupId?: string;
  createdAt: string;
  updatedAt: string;
}

export async function createJamSession(payload: {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  location: any;
  instrumentsWanted: string[];
  genres?: string[];
  maxParticipants?: number;
  groupId?: string;
}): Promise<JamSession> {
  const { data } = await api.post('/events/jam-sessions', payload);
  return data;
}

export async function findJamSessions(params: {
  instrumentsWanted?: string[];
  genres?: string[];
  lat?: number;
  lon?: number;
  radiusKm?: number;
  groupId?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: JamSession[]; total: number }> {
  const queryParams: Record<string, any> = {};
  if (params.instrumentsWanted?.length) queryParams.instrumentsWanted = params.instrumentsWanted.join(',');
  if (params.genres?.length) queryParams.genres = params.genres.join(',');
  if (params.lat != null) queryParams.lat = params.lat;
  if (params.lon != null) queryParams.lon = params.lon;
  if (params.radiusKm != null) queryParams.radiusKm = params.radiusKm;
  if (params.groupId) queryParams.groupId = params.groupId;
  if (params.page != null) queryParams.page = params.page;
  if (params.limit != null) queryParams.limit = params.limit;

  const { data } = await api.get('/events/jam-sessions', { params: queryParams });
  return data;
}

export async function rsvpToJam(eventId: string): Promise<{ invitation: any; event: JamSession }> {
  const { data } = await api.post(`/events/${eventId}/rsvp`);
  return data;
}

export async function cancelRsvp(eventId: string): Promise<void> {
  await api.delete(`/events/${eventId}/rsvp`);
}

export async function getAttendees(eventId: string): Promise<any[]> {
  const { data } = await api.get(`/events/${eventId}/attendees`);
  return data;
}


// ── Groups ──────────────────────────────────────────────────────────────

export interface GroupData {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  interests: string[];
  memberCount?: number;
  isPrivate: boolean;
  createdAt: string;
}

export interface GroupPost {
  id: string;
  groupId: string;
  userId: string;
  type: string;
  title?: string;
  content: string;
  eventId?: string;
  instrumentsWanted: string[];
  createdAt: string;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  userId: string;
  content: string;
  createdAt: string;
}

export async function getGroup(id: string): Promise<any> {
  const { data } = await api.get(`/groups/${id}`);
  return data;
}

export async function listGroupPosts(
  groupId: string,
  page = 1,
  limit = 20,
): Promise<{ data: GroupPost[]; total: number }> {
  const { data } = await api.get(`/groups/${groupId}/posts`, { params: { page, limit } });
  return data;
}

export async function createGroupPost(
  groupId: string,
  payload: { type?: string; title?: string; content: string; eventId?: string; instrumentsWanted?: string[] },
): Promise<GroupPost> {
  const { data } = await api.post(`/groups/${groupId}/posts`, payload);
  return data;
}

export async function sendGroupMessage(groupId: string, content: string): Promise<GroupMessage> {
  const { data } = await api.post(`/groups/${groupId}/messages`, { content });
  return data;
}

export async function getGroupMessages(
  groupId: string,
  after?: string,
  limit = 50,
): Promise<{ data: GroupMessage[]; hasMore: boolean }> {
  const { data } = await api.get(`/groups/${groupId}/messages`, { params: { after, limit } });
  return data;
}

export async function suggestGroups(): Promise<{ data: (GroupData & { matchScore: number })[] }> {
  const { data } = await api.get('/groups/discover');
  return data;
}

// ── Musicians ──────────────────────────────────────────────────────────

export interface MusicianProfile {
  id: string;
  userId: string;
  instruments: string[];
  skillLevel: string;
  genres: string[];
  intent: string;
  lookingFor: string[];
  bio?: string;
  influences: string[];
  availableDays: string[];
  createdAt: string;
  updatedAt: string;
}

export async function getMusicianProfile(userId: string): Promise<MusicianProfile | null> {
  const { data } = await api.get(`/users/${userId}/musician-profile`);
  return data ?? null;
}

export async function upsertMusicianProfile(
  fields: Partial<MusicianProfile>,
): Promise<MusicianProfile> {
  const { data } = await api.put('/users/profile/musician', fields);
  return data;
}

export async function browseMusicians(params: {
  instruments?: string[];
  genres?: string[];
  skill?: string;
  intent?: string;
  lat?: number;
  lon?: number;
  radiusKm?: number;
  page?: number;
  limit?: number;
}): Promise<{ data: MusicianProfile[]; total: number }> {
  const queryParams: Record<string, any> = {};
  if (params.instruments?.length) queryParams.instruments = params.instruments.join(',');
  if (params.genres?.length) queryParams.genres = params.genres.join(',');
  if (params.skill) queryParams.skill = params.skill;
  if (params.intent) queryParams.intent = params.intent;
  if (params.lat != null) queryParams.lat = params.lat;
  if (params.lon != null) queryParams.lon = params.lon;
  if (params.radiusKm != null) queryParams.radiusKm = params.radiusKm;
  if (params.page != null) queryParams.page = params.page;
  if (params.limit != null) queryParams.limit = params.limit;

  const { data } = await api.get('/users/musicians', { params: queryParams });
  return data;
}

export async function discoverForYou(): Promise<{
  musicians: MusicianProfile[];
  totalMusicians: number;
}> {
  const { data } = await api.get('/users/discover/for-you');
  return data;
}

// ── Events ─────────────────────────────────────────────────────────────

export async function searchEvents(params: {
  query?: string;
  categories?: string[];
  lat?: number;
  lon?: number;
  radiusKm?: number;
  page?: number;
  limit?: number;
}) {
  const { data } = await api.get('/events/search', { params });
  return data;
}

export async function getEvent(id: string) {
  const { data } = await api.get(`/events/${id}`);
  return data;
}

export async function getEventsByCategory(category: string, page = 1, limit = 20) {
  const { data } = await api.get(`/events/category/${category}`, {
    params: { page, limit },
  });
  return data;
}

export async function getNearbyEvents(lat: number, lon: number, radiusKm = 20) {
  const { data } = await api.get('/events/nearby', {
    params: { lat, lon, radiusKm },
  });
  return data;
}

export async function getAllEvents(page = 1, limit = 20) {
  const { data } = await api.get('/events', { params: { page, limit } });
  return data;
}

export async function createEvent(payload: {
  title: string;
  description: string;
  category: string;
  subCategory?: string;
  startTime: string;
  endTime: string;
  location: {
    venueName?: string;
    name?: string;
    address?: string;
    city?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  price: {
    price?: number;
    minPrice?: number;
    maxPrice?: number;
    currency?: string;
  };
  maxAttendees?: number;
  tags?: string[];
  images?: string[];
  ageRestriction?: number;
  groupId?: string;
  vendorId?: string;
  venueId?: string;
  timeSlotId?: string;
}) {
  const { data } = await api.post('/events', payload);
  return data;
}

// ── Vendor booking ─────────────────────────────────────────────────────

export async function confirmVendor(eventId: string) {
  const { data } = await api.post(`/events/${eventId}/confirm-vendor`);
  return data;
}

export async function releaseVendor(eventId: string) {
  const { data } = await api.post(`/events/${eventId}/release-vendor`);
  return data;
}

export async function rebookVendor(eventId: string) {
  const { data } = await api.post(`/events/${eventId}/rebook-vendor`);
  return data;
}

// ── Invitations ────────────────────────────────────────────────────────

export async function inviteUser(eventId: string, userId: string, inviterId: string) {
  const { data } = await api.post(`/events/${eventId}/invite`, { userId, inviterId });
  return data;
}

export async function acceptInvite(invitationId: string) {
  const { data } = await api.post(`/events/invitations/${invitationId}/accept`);
  return data;
}

export async function rejectInvite(invitationId: string) {
  const { data } = await api.post(`/events/invitations/${invitationId}/reject`);
  return data;
}

export async function requestJoin(eventId: string, userId: string) {
  const { data } = await api.post(`/events/${eventId}/join-request`, { userId });
  return data;
}

export async function respondToRequest(invitationId: string, accept: boolean) {
  const { data } = await api.post(`/events/invitations/${invitationId}/respond`, { accept });
  return data;
}

export async function listInvitations(eventId: string) {
  const { data } = await api.get(`/events/${eventId}/invitations`);
  return data;
}

// ── Quota ──────────────────────────────────────────────────────────────

export async function disableInvites(eventId: string) {
  const { data } = await api.post(`/events/${eventId}/disable-invites`);
  return data;
}

export async function enableInvites(eventId: string) {
  const { data } = await api.post(`/events/${eventId}/enable-invites`);
  return data;
}

// ── Tracking ───────────────────────────────────────────────────────────

export async function trackActivity(params: {
  userId: string;
  sessionId: string;
  type: string;
  metadata?: Record<string, any>;
}) {
  try {
    await api.post('/tracking/activity', params);
  } catch {
    // Fire-and-forget
  }
}

export async function trackSearch(params: {
  userId: string;
  sessionId: string;
  searchId: string;
  query: string;
  filters?: Record<string, any>;
  resultCount?: number;
}) {
  try {
    await api.post('/tracking/search', params);
  } catch {
    // Fire-and-forget
  }
}

export async function trackFeedback(params: {
  userId: string;
  sessionId: string;
  recommendationId: string;
  modelId: string;
  modelVersion: string;
  type: 'impression' | 'click' | 'conversion' | 'dismiss';
  placement: { page: string; widget: string; position?: number };
  items: any[];
}) {
  try {
    await api.post('/tracking/feedback', params);
  } catch {
    // Fire-and-forget
  }
}

export async function trackLocation(params: {
  userId: string;
  sessionId: string;
  type: 'location_search' | 'nearby_search' | 'map_pan' | 'map_zoom';
  location: { latitude: number; longitude: number; city?: string };
  metadata?: Record<string, any>;
}) {
  try {
    await api.post('/tracking/location', params);
  } catch {
    // Fire-and-forget
  }
}

// ── Payment / Booking ──────────────────────────────────────────────────

const BOOKING_API = process.env.NEXT_PUBLIC_BOOKING_API_URL || 'http://localhost:3007';

export const bookingApi = axios.create({
  baseURL: BOOKING_API,
  headers: { 'Content-Type': 'application/json' },
});

export async function createBooking(payload: {
  userId: string;
  eventId: string;
  vendorId: string;
  amountCents: number;
  currency: string;
  ticketCount?: number;
}) {
  const { data } = await bookingApi.post('/payments/create-booking', payload);
  return data;
}

export async function confirmBooking(bookingId: string) {
  const { data } = await bookingApi.post(`/payments/bookings/${bookingId}/confirm`);
  return data;
}