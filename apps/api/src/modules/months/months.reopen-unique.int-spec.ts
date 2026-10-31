import { Prisma } from '@prisma/client';
import { createMonth, createTestPrisma, resetDb } from '../../../test/db';
import { isSingleReopenedViolation } from './reopen-violation';

/** MON-13 at the database level: the partial unique index allows at most one 'reopened' month. */
describe('single reopened month index (integration)', () => {
  const prisma = createTestPrisma();

  beforeAll(() => prisma.$connect());
  beforeEach(() => resetDb(prisma));
  afterAll(async () => {
    await resetDb(prisma);
    await prisma.$disconnect();
  });

  it('MON-13: inserting a second reopened month fails at the DB level and is recognised by the mapper', async () => {
    await createMonth(prisma, { period: '2026-01', status: 'reopened' });

    const error = await createMonth(prisma, { period: '2026-02', status: 'reopened' }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
    expect(isSingleReopenedViolation(error)).toBe(true);
  });

  it('MON-13: updating a closed month to reopened fails while another month is reopened', async () => {
    await createMonth(prisma, { period: '2026-01', status: 'reopened' });
    await createMonth(prisma, { period: '2026-02', status: 'closed' });

    const error = await prisma.budgetMonth
      .update({ where: { period: '2026-02' }, data: { status: 'reopened' } })
      .catch((e: unknown) => e);

    expect(isSingleReopenedViolation(error)).toBe(true);
  });

  it('MON-13: many closed / open / draft months are still allowed, and so is one reopened', async () => {
    await createMonth(prisma, { period: '2026-01', status: 'closed' });
    await createMonth(prisma, { period: '2026-02', status: 'closed' });
    await createMonth(prisma, { period: '2026-03', status: 'reopened' });
    await createMonth(prisma, { period: '2026-04', status: 'open' });
    await expect(prisma.budgetMonth.count()).resolves.toBe(4);
  });
});
