import { Injectable } from '@nestjs/common';
import { GitLabApiClient, GitLabRemoteProject } from './gitlab-api.types';

/** کلاینت پیش‌فرض — در تست با Mock جایگزین می‌شود. */
@Injectable()
export class DefaultGitLabApiClient implements GitLabApiClient {
  async listProjects(
    baseUrl: string,
    token: string,
    page: number,
  ): Promise<GitLabRemoteProject[]> {
    const url = `${baseUrl.replace(/\/$/, '')}/api/v4/projects?membership=true&page=${page}&per_page=20`;
    const res = await fetch(url, {
      headers: { 'PRIVATE-TOKEN': token },
    });
    if (!res.ok) {
      throw new Error(`GitLab API ${res.status}`);
    }
    const data = (await res.json()) as GitLabRemoteProject[];
    return data;
  }
}
