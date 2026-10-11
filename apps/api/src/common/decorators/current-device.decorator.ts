import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DeviceAuthContext } from '../../devices/device-auth.types';

export const CurrentDevice = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): DeviceAuthContext => {
    const request = ctx.switchToHttp().getRequest<{ device: DeviceAuthContext }>();
    return request.device;
  },
);
