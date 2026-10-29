import { PrismaService } from '../../prisma/prisma.service';
import { createTestPrisma, resetDb } from '../../../test/db';
import { EnvelopesService } from './envelopes.service';

/**
 * Integration tests for EnvelopesService.create with an initial balance against
 * the real test database (see docs/testing.md). Every test starts from empty tables.
 */
describe('EnvelopesService.create initial balance (integration)', () => {
  let prisma: PrismaService;
  let service: EnvelopesService;

  beforeAll(async () => {
    prisma = createTestPrisma();
    await prisma.$connect();
    service = new EnvelopesService(prisma);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await resetDb(prisma);
    await prisma.$disconnect();
  });

  it('ENV-03 / OP-10 / FIN-14: envelope created with initial balance shows it in GET /envelopes', async () => {
    const month = await prisma.budgetMonth.create({
      data: { period: '2026-01', status: 'open', incomeMinor: 1_000_000, version: 1 },
    });

    const { envelope } = await service.create({ name: 'Еда', initialBalance: '1500.00' });
    expect(envelope.balanceMinor).toBe(150_000);

    const { envelopes } = await service.list();
    expect(envelopes.map((e) => [e.name, e.balanceMinor])).toEqual([['Еда', 150_000]]);

    const snapshot = await prisma.envelopeMonthSnapshot.findFirstOrThrow({
      where: { monthId: month.id, envelopeId: envelope.id },
    });
    expect(snapshot.closing).toBe(150_000);
    const result = await prisma.operationResult.findMany({
      where: { operation: { monthId: month.id } },
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.sourceBalanceAfter).toBe(150_000);
  });

  it('FIN-14 / OP-10: initial balance is not counted in the monthly adjustments indicator', async () => {
    const month = await prisma.budgetMonth.create({
      data: { period: '2026-01', status: 'open', incomeMinor: 1_000_000, version: 1 },
    });

    const { envelope } = await service.create({ name: 'Еда', initialBalance: '1500.00' });

    const snapshot = await prisma.envelopeMonthSnapshot.findFirstOrThrow({
      where: { monthId: month.id, envelopeId: envelope.id },
    });
    expect(snapshot.initial).toBe(150_000);
    expect(snapshot.adjustmentApplied).toBe(0);
  });

  it('CALC-04 / FIN-14: initial balance carries into later months as their opening balance', async () => {
    await prisma.budgetMonth.create({
      data: { period: '2026-01', status: 'open', incomeMinor: 1_000_000, version: 1 },
    });
    const next = await prisma.budgetMonth.create({
      data: { period: '2026-02', status: 'draft', incomeMinor: 1_000_000, version: 1 },
    });

    const { envelope } = await service.create({ name: 'Еда', initialBalance: '1500.00' });

    const snapshot = await prisma.envelopeMonthSnapshot.findFirstOrThrow({
      where: { monthId: next.id, envelopeId: envelope.id },
    });
    expect(snapshot.opening).toBe(150_000);
    expect(snapshot.closing).toBe(150_000);
    expect(snapshot.initial).toBe(0);
  });
});
