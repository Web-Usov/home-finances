import type { APIRequestContext } from '@playwright/test';
import pg from 'pg';
import { getE2eEnv } from '../support/env.mjs';

export interface EnvelopeDto {
  id: string;
  name: string;
  balanceMinor: number;
  status: string;
}

/** HTTP + DB helpers for arranging state without going through the UI. */
export class ApiFixture {
  constructor(
    private readonly request: APIRequestContext,
    private readonly apiUrl: string,
  ) {}

  private async post<T>(path: string, data: unknown): Promise<T> {
    const res = await this.request.post(`${this.apiUrl}/api/v1${path}`, { data });
    if (!res.ok()) throw new Error(`POST ${path} -> ${res.status()}: ${await res.text()}`);
    return (await res.json()) as T;
  }

  /** `period` is YYYY-MM, `income` a money string in rubles ("100000.00"). */
  createMonth(period: string, income?: string) {
    return this.post<{ month: { id: string; period: string } }>('/months', { period, income });
  }

  createEnvelope(name: string, initialBalance?: string) {
    return this.post<{ envelope: EnvelopeDto }>('/envelopes', { name, initialBalance });
  }

  /** Truncates all tables of the e2e schema (keeps the Prisma migrations table). */
  async reset(): Promise<void> {
    const { baseDatabaseUrl, schema } = getE2eEnv();
    const client = new pg.Client({ connectionString: baseDatabaseUrl });
    await client.connect();
    try {
      const { rows } = await client.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename <> '_prisma_migrations'`,
        [schema],
      );
      if (rows.length === 0) return;
      const tables = rows.map((r) => `"${schema}"."${r.tablename}"`).join(', ');
      await client.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
    } finally {
      await client.end();
    }
  }
}
