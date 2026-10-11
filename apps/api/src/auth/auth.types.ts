import { RoleCode } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  organizationId: string;
  roles: RoleCode[];
  permissions: string[];
  sessionId: string;
  jti: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  organizationId: string;
  roles: RoleCode[];
  permissions: string[];
  sessionId: string;
  jti: string;
}
