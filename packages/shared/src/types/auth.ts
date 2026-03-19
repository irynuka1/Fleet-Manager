export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  COUNTRY_MANAGER = 'COUNTRY_MANAGER',
  AGENCY_MANAGER = 'AGENCY_MANAGER',
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  agencyId: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  agencyId: string | null;
}
