export type RoleCode =
  | 'SUPER_ADMIN'
  | 'ORGANIZATION_ADMIN'
  | 'TEAM_LEAD'
  | 'EMPLOYEE'
  | 'PAYROLL_REVIEWER';

export type ContractType = 'HOURLY' | 'FULL_TIME_REMOTE';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING';

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string | null;
  jobTitle?: string | null;
  contractType: ContractType;
  status: UserStatus;
  timezone: string;
  roles: Array<{ code: RoleCode; nameFa: string }>;
  teams: Array<{ id: string; name: string; isLead: boolean }>;
}

export interface LoginResponse {
  accessToken: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    organizationId: string;
    roles: RoleCode[];
    permissions: string[];
    timezone: string;
  };
}
