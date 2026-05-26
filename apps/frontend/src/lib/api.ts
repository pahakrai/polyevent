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
