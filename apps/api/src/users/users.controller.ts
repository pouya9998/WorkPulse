import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PERMISSIONS } from '../common/permissions';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('کاربران')
@ApiBearerAuth()
@Controller('users')
@UseGuards(PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ApiOperation({ summary: 'فهرست کاربران سازمان' })
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: UserStatus,
    @Query('search') search?: string,
  ) {
    return this.users.list(user, { status, search });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ApiOperation({ summary: 'جزئیات کاربر' })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.users.getById(user, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_WRITE)
  @ApiOperation({ summary: 'ایجاد کاربر جدید' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.users.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USERS_WRITE)
  @ApiOperation({ summary: 'ویرایش کاربر' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(user, id, dto);
  }

  @Post(':id/deactivate')
  @RequirePermissions(PERMISSIONS.USERS_DEACTIVATE)
  @ApiOperation({ summary: 'غیرفعال‌سازی کاربر (حذف فیزیکی انجام نمی‌شود)' })
  deactivate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.users.deactivate(user, id);
  }

  @Post(':id/activate')
  @RequirePermissions(PERMISSIONS.USERS_WRITE)
  @ApiOperation({ summary: 'فعال‌سازی مجدد کاربر' })
  activate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.users.activate(user, id);
  }

  @Post(':id/reset-password')
  @RequirePermissions(PERMISSIONS.USERS_WRITE)
  @ApiOperation({ summary: 'تنظیم مجدد رمز عبور' })
  resetPassword(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.users.resetPassword(user, id, dto);
  }

  @Post(':id/revoke-sessions')
  @RequirePermissions(PERMISSIONS.USERS_WRITE)
  @ApiOperation({ summary: 'لغو تمام نشست‌های فعال کاربر' })
  revokeSessions(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.users.revokeSessions(user, id);
  }
}
