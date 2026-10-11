import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AgentReleasesService } from './agent-releases.service';

@ApiTags('Agent releases')
@Public()
@Controller('agent/releases')
export class AgentReleasesController {
  constructor(private readonly releases: AgentReleasesService) {}

  @Get()
  @ApiOperation({ summary: 'List downloadable desktop agent builds' })
  list() {
    return this.releases.list();
  }

  @Get(':platform/download')
  @ApiOperation({ summary: 'Download agent binary for platform' })
  @ApiParam({ name: 'platform', enum: ['linux', 'windows', 'macos', 'macos-arm64'] })
  download(
    @Param('platform') platform: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = this.releases.openBinary(platform);
    res.set({
      'Content-Type': file.contentType,
      'Content-Length': String(file.size),
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
      'Cache-Control': 'public, max-age=300',
    });
    return new StreamableFile(file.stream);
  }

  @Get(':platform/install-script')
  @ApiOperation({ summary: 'Download install script for platform' })
  @ApiParam({ name: 'platform', enum: ['linux', 'windows', 'macos', 'macos-arm64'] })
  installScript(
    @Param('platform') platform: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = this.releases.openInstallScript(platform);
    res.set({
      'Content-Type': file.contentType,
      'Content-Length': String(file.size),
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
      'Cache-Control': 'public, max-age=300',
    });
    return new StreamableFile(file.stream);
  }
}
