import { api } from './api';

interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string;
}

export async function loginUser(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
  return data;
}

export async function registerUser(dto: RegisterDto): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/register', {
    email: dto.email,
    password: dto.password,
    firstName: dto.firstName,
    lastName: dto.lastName,
    role: dto.role || 'USER',
  });
  return data;
}

export async function getProfile() {
  const { data } = await api.get('/auth/profile');
  return data;
}
