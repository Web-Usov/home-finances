// Rules whose subject is the repository itself (documented launch, shipped migrations and env docs, API structure,
// UI without out-of-MVP controls). `pnpm spec:check` counts this file as test coverage (see RULE_TEST_DIR there), so
// every test here must assert a property that fails when the rule is broken.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from './helpers.mjs';

const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(repoRoot, rel));

/** All files below `rel` with one of `exts`, as repo-relative paths (no node_modules, no tests). */
function sources(rel, exts = ['.ts', '.tsx']) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(repoRoot, rel), { withFileTypes: true })) {
    const child = `${rel}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') out.push(...sources(child, exts));
    } else if (exts.some((e) => entry.name.endsWith(e)) && !/\.(test|spec|int-spec|e2e)\.[tj]sx?$/.test(entry.name)) {
      out.push(child);
    }
  }
  return out;
}

/** Variables interpolated as ${NAME...} in docker-compose.yml. */
function composeVariables() {
  return [...new Set([...read('docker-compose.yml').matchAll(/\$\{([A-Z_]+)/g)].map((m) => m[1]))];
}

test('NFR-02: the API is NestJS + TypeScript with one module per domain area and no SQL in controllers', () => {
  const pkg = JSON.parse(read('apps/api/package.json'));
  for (const dep of ['@nestjs/core', '@nestjs/common']) assert.ok(pkg.dependencies[dep], `${dep} is a dependency of the API`);
  assert.ok(exists('apps/api/tsconfig.json'));

  const modulesDir = 'apps/api/src/modules';
  const domains = fs.readdirSync(path.join(repoRoot, modulesDir), { withFileTypes: true }).filter((e) => e.isDirectory());
  assert.ok(domains.length >= 5, 'the domain logic is split into several modules');
  for (const { name } of domains) {
    assert.ok(exists(`${modulesDir}/${name}/${name}.module.ts`), `${modulesDir}/${name} declares its own Nest module`);
  }
  assert.ok(exists(`${modulesDir}/calculation-engine/calculation-engine.service.ts`), 'the calculation engine is its own module');

  // Business logic stays in services: a controller never touches the database layer directly.
  for (const file of sources('apps/api/src').filter((f) => f.endsWith('.controller.ts'))) {
    assert.doesNotMatch(read(file), /prisma|@prisma\/client/i, `${file} must delegate to a service`);
  }
});

test('DOD-04: one documented Docker Compose command starts postgres, migrations, the API and the web client', () => {
  const readme = read('README.md');
  assert.match(readme, /^## Запуск в Docker/m, 'README has the Docker launch section');
  assert.match(readme, /docker compose up -d --build/, 'README documents the single launch command');

  const compose = read('docker-compose.yml');
  for (const service of ['postgres', 'migrate', 'api', 'web']) {
    assert.match(compose, new RegExp(`^  ${service}:`, 'm'), `docker-compose.yml defines the ${service} service`);
  }
  // order the README promises: migrations finish before the API starts, the API is healthy before the web client
  assert.match(compose, /migrate:\s*\n\s*condition: service_completed_successfully/);
  assert.match(compose, /api:\s*\n\s*condition: service_healthy/);
  assert.match(compose, /prisma", "migrate", "deploy"/);

  // the documented command is exercised for real by the compose smoke script
  assert.match(read('scripts/smoke-compose.sh'), /"\$\{DC\[@\]\}" up --build -d/);
  assert.equal(JSON.parse(read('package.json')).scripts['smoke:compose'], 'bash scripts/smoke-compose.sh');
});

test('DOD-05: migrations, environment variables and the first-launch instruction are in the repository', () => {
  const migrationsDir = 'apps/api/prisma/migrations';
  assert.ok(exists(`${migrationsDir}/migration_lock.toml`));
  const migrations = fs.readdirSync(path.join(repoRoot, migrationsDir), { withFileTypes: true }).filter((e) => e.isDirectory());
  assert.ok(migrations.length >= 1, 'at least the init migration is committed');
  for (const { name } of migrations) {
    assert.match(name, /^\d{14}_/, `${name} is a prisma migration folder`);
    assert.ok(read(`${migrationsDir}/${name}/migration.sql`).trim().length > 0, `${name}/migration.sql is not empty`);
  }

  // every variable the compose file reads is documented in .env.example and in the README table
  const envExample = read('.env.example');
  const readme = read('README.md');
  const variables = composeVariables();
  assert.ok(variables.includes('POSTGRES_PASSWORD') && variables.includes('WEB_HOST_PORT'), 'compose variables were parsed');
  for (const name of variables) {
    assert.match(envExample, new RegExp(`^${name}=`, 'm'), `.env.example defines ${name}`);
    assert.ok(readme.includes(`\`${name}\``), `README documents ${name}`);
  }
  assert.match(readme, /^### Переменные окружения/m);
  assert.match(readme, /^### Остановка, сброс, обновление/m);
  // the committed example holds no real secrets: .env itself is ignored
  assert.match(read('.gitignore'), /^\.env$/m);
});

test('DOD-06: the UI has only the four MVP sections and no out-of-MVP controls or unfinished stubs', () => {
  // UI-01: the routes are exactly the four sections; a settings/login/export screen would be a new file here
  const routes = fs
    .readdirSync(path.join(repoRoot, 'apps/mobile/app/(tabs)'))
    .filter((f) => f.endsWith('.tsx') && f !== '_layout.tsx')
    .sort();
  assert.deepEqual(routes, ['analytics.tsx', 'envelopes.tsx', 'history.tsx', 'month.tsx']);
  assert.deepEqual(fs.readdirSync(path.join(repoRoot, 'apps/mobile/app')).sort(), ['(tabs)', '_layout.tsx', 'index.tsx']);

  // SCOPE-16..SCOPE-22: auth, export/import/backup, bank, goals/reminders/recurring, currencies, push
  const outOfMvp =
    /Войти|Выйти|Вход в|Регистрац|Пароль|Экспорт|Импорт|Резервн\w+ копи|Банк|Напоминан|Регулярн|Цели\b|Валют|Курс\b|Уведомлен|Push/;
  // unfinished stubs: markers, "soon" labels, placeholder data
  const stub = /TODO|FIXME|XXX|скоро|в разработке|coming soon|not implemented|заглушк|lorem ipsum/i;
  const files = [...sources('apps/mobile/app'), ...sources('apps/mobile/src').filter((f) => !f.startsWith('apps/mobile/src/api/'))];
  assert.ok(files.length > 20, 'the UI sources were found');
  for (const file of files) {
    const text = read(file);
    assert.doesNotMatch(text, outOfMvp, `${file} mentions an out-of-MVP function`);
    assert.doesNotMatch(text, stub, `${file} contains an unfinished stub`);
  }
});
