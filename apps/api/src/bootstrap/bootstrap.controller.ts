import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { BootstrapService } from './bootstrap.service';

@ApiTags('راه‌اندازی')
@Controller('bootstrap')
export class BootstrapController {
  constructor(private readonly bootstrap: BootstrapService) {}

  @Public()
  @Get('status')
  @ApiOperation({ summary: 'وضعیت Bootstrap سامانه' })
  status() {
    return this.bootstrap.getStatus();
  }
}
