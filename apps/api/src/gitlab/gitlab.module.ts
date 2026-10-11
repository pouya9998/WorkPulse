import { Module } from '@nestjs/common';
import { EncryptionService } from '../common/crypto/encryption.service';
import { DefaultGitLabApiClient } from './gitlab-api.client';
import { GITLAB_API_CLIENT } from './gitlab-api.types';
import { GitLabController } from './gitlab.controller';
import { GitLabService } from './gitlab.service';

@Module({
  controllers: [GitLabController],
  providers: [
    GitLabService,
    EncryptionService,
    DefaultGitLabApiClient,
    { provide: GITLAB_API_CLIENT, useExisting: DefaultGitLabApiClient },
  ],
  exports: [GitLabService],
})
export class GitLabModule {}
