import { Module } from '@nestjs/common';
import { AgentReleasesController } from './agent-releases.controller';
import { AgentReleasesService } from './agent-releases.service';

@Module({
  controllers: [AgentReleasesController],
  providers: [AgentReleasesService],
  exports: [AgentReleasesService],
})
export class AgentReleasesModule {}
