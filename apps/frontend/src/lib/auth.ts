import { api } from './api';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    permissions?: string[];
    vendorId?: string;
  };
}

interface VendorFields {
  businessName: string;
  category: string;
  contactEmail: string;
  contactPhone: string;
  address: Record<string, any>;
  location: Record<string, any>;
  description?: string;
  subCategory?: string;
  website?: string;
  coverImage?: string;
}

interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string;
  vendor?: VendorFields;
}

export async function loginUser(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
  return data;
}

export async function registerUser(dto: RegisterDto): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/register', dto);
  return data;
}

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const { data } = await api.post<{ accessToken: string; refreshToken: string }>('/auth/refresh', { refreshToken });
  return data;
}

export async function getProfile() {
  const { data } = await api.get('/auth/profile');
  return data;
}
