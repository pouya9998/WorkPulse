import { AlertStatus, AlertType } from '@prisma/client';
import { AlertsEngineService } from './alerts-engine.service';

describe('AlertsEngineService', () => {
  const prisma = {
    alert: {
      findUnique: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    },
  };
  const notifications = {
    createForAlert: jest.fn(),
  };

  let service: AlertsEngineService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AlertsEngineService(prisma as never, notifications as never);
  });

  it('dedupeKey از نوع+کاربر+روز ساخته می‌شود', () => {
    const key = service.buildDedupeKey(
      AlertType.HEARTBEAT_EXPIRED,
      'user-1',
      new Date('2026-10-11T08:00:00.000Z'),
    );
    expect(key).toBe('HEARTBEAT_EXPIRED:user-1:2026-10-11');
  });

  it('هشدار تکراری در همان پنجره ایجاد نمی‌شود', async () => {
    prisma.alert.findUnique.mockResolvedValue({
      id: 'a1',
      status: AlertStatus.OPEN,
    });

    const result = await service.createAlertDeduped({
      organizationId: 'org-1',
      userId: 'user-1',
      type: AlertType.AGENT_NOT_SYNCED,
      titleFa: 'تست',
      messageFa: 'پیام',
      windowStart: new Date('2026-10-11T00:00:00.000Z'),
      windowEnd: new Date('2026-10-12T00:00:00.000Z'),
    });

    expect(result.created).toBe(false);
    expect(prisma.alert.create).not.toHaveBeenCalled();
  });
});
