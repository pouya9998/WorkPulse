export interface GitLabRemoteProject {
  id: number;
  path_with_namespace: string;
  name: string;
}

export interface GitLabApiClient {
  listProjects(baseUrl: string, token: string, page: number): Promise<GitLabRemoteProject[]>;
}

export const GITLAB_API_CLIENT = Symbol('GITLAB_API_CLIENT');
