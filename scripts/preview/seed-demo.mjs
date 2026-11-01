#!/usr/bin/env node
/* eslint-disable no-console */
// Seeds a realistic demo into the preview environment through the HTTP API, ONLY if there are no months yet.
//   node scripts/preview/seed-demo.mjs [apiOrigin]        (default http://127.0.0.1:3100)
// Scenario: first (open) month with income, 5 envelopes with initial balances, allocations, expenses (one
// not fully covered), a transfer, and the next month as a draft.
const origin = (process.argv[2] ?? process.env.PREVIEW_API_URL ?? 'http://127.0.0.1:3100').replace(/\/+$/, '');

// `version` is the expected month version, sent as `If-Match: "<version>"` (API-25).
async function call(method, path, body, version) {
  const res = await fetch(`${origin}/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(version !== undefined ? { 'If-Match': `"${version}"` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  return json;
}

const monthVersion = async (period) => (await call('GET', '/months')).months.find((m) => m.period === period).version;

function currentPeriod(offset = 0) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

const existing = await call('GET', '/months');
if (existing.months.length > 0) {
  console.log(`preview DB already has ${existing.months.length} month(s); not seeding`);
  process.exit(0);
}

const period = currentPeriod(0);
const next = currentPeriod(1);

// Initial balances are operations of the open month (OP-10), so the month comes first.
await call('POST', '/months', { period, income: '150000.00' });

const envelopes = {};
for (const [name, initialBalance] of [
  ['Продукты', '12000.00'],
  ['Коммуналка', '0.00'],
  ['Отпуск', '40000.00'],
  ['Подушка безопасности', '100000.00'],
  ['Развлечения', '3000.00'],
]) {
  envelopes[name] = (await call('POST', '/envelopes', { name, initialBalance })).envelope.id;
}
const id = (name) => envelopes[name];

await call(
  'PUT',
  `/months/${period}/allocations`,
  {
    allocations: {
      [id('Продукты')]: '35000.00',
      [id('Коммуналка')]: '18000.00',
      [id('Отпуск')]: '20000.00',
      [id('Подушка безопасности')]: '15000.00',
      [id('Развлечения')]: '8000.00',
    },
  },
  await monthVersion(period),
);

const operations = [
  { type: 'expense', source: 'Продукты', amount: '4350.50', comment: 'Супермаркет' },
  { type: 'expense', source: 'Коммуналка', amount: '7420.00', comment: 'Квартплата и свет' },
  // 14 500 against 11 000 available: 3 500 stay uncovered (OP-05 / OP-06).
  { type: 'expense', source: 'Развлечения', amount: '14500.00', comment: 'Концерт и ужин' },
  { type: 'transfer', source: 'Подушка безопасности', destination: 'Отпуск', amount: '5000.00', comment: 'В отпускной фонд' },
];
for (const op of operations) {
  await call(
    'POST',
    '/operations',
    {
      type: op.type,
      sourceEnvelopeId: id(op.source),
      ...(op.destination ? { destinationEnvelopeId: id(op.destination) } : {}),
      amount: op.amount,
      comment: op.comment,
    },
    await monthVersion(period),
  );
}

await call('POST', '/months', { period: next });

const dash = await call('GET', `/dashboard/monthly?period=${period}`);
console.log(`seeded demo: ${period} (open) + ${next} (draft), ${Object.keys(envelopes).length} envelopes`);
console.log(JSON.stringify(dash.data?.summary ?? dash.summary ?? dash, null, 2));
