import { ViewerIdentityEntity } from '@/domain/entities/viewer-identity.entity';

describe('ViewerIdentityEntity', () => {
  it('creates with valid props', () => {
    const id = ViewerIdentityEntity.create({
      dashboardId: 'd1',
      createdAt: 1,
    });
    expect(id.dashboardId).toBe('d1');
    expect(id.toJSON()).toEqual({ dashboardId: 'd1', createdAt: 1 });
  });

  it('throws on empty dashboardId', () => {
    expect(() =>
      ViewerIdentityEntity.create({ dashboardId: '', createdAt: 1 }),
    ).toThrow();
  });
});
