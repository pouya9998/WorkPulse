import { PERMISSIONS, ROLE_PERMISSION_MAP } from './permissions';

describe('ROLE_PERMISSION_MAP', () => {
  it('مدیر کل باید تمام مجوزها را داشته باشد', () => {
    expect(ROLE_PERMISSION_MAP.SUPER_ADMIN).toEqual(Object.values(PERMISSIONS));
  });

  it('کارمند نباید مجوز مدیریت کاربران داشته باشد', () => {
    expect(ROLE_PERMISSION_MAP.EMPLOYEE).not.toContain(PERMISSIONS.USERS_WRITE);
    expect(ROLE_PERMISSION_MAP.EMPLOYEE).not.toContain(PERMISSIONS.USERS_DEACTIVATE);
  });

  it('بازبین حقوق باید مجوز بازبینی داشته باشد', () => {
    expect(ROLE_PERMISSION_MAP.PAYROLL_REVIEWER).toContain(PERMISSIONS.PAYROLL_REVIEW);
  });
});
