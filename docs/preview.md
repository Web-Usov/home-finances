# Preview environment

A persistent copy of the app for the owner on the dev host. It deploys `origin/master` automatically (within ~2 minutes of a
merge plus build time) and has its own demo data. Language: English. Task: T-038.

## URLs

| What | URL |
| --- | --- |
| App | `http://192.168.1.114:8100/` (also `http://192.168.20.105:8100/`; any hostname of the host works) |
| Deployed build | `http://192.168.1.114:8100/version.json` (`sha`, `short`, `subject`, `builtAt`) |
| API health | `http://192.168.1.114:8100/api/v1/health` |
| Swagger UI / JSON | `http://192.168.1.114:8100/api`, `/api/swagger.json` |

One public port (8100). The API listens only on `127.0.0.1:3100`; the web server proxies everything under `/api` to it.
The web bundle is exported with `EXPO_PUBLIC_API_URL=same-origin` (client base URL is empty, requests go to the page origin),
so the app works from any IP or hostname. Unset/other values keep the dev/e2e behaviour
(`apps/mobile/src/lib/apiBaseUrl.ts`).

## Layout (`/root/workspace/finance-preview`, outside the repo checkouts)

```
mirror.git/        bare clone of origin, fetched by the updater (never touches the main checkout or task worktrees)
slots/a, slots/b   two detached worktrees (blue/green); `current` -> the live slot
current            symlink, swapped atomically
state/             deployed-sha, failed-sha, last-failure, update.lock
preview.env        DATABASE_URL (family_budget_preview), ports; not in git
```

Each slot holds its own `node_modules`, `apps/api/dist` and `.preview/web` (Expo export) + `.preview/version.json`.

## How it updates

`family-budget-preview-update.timer` runs `family-budget-preview-update.service` every 2 minutes
(`scripts/preview/update.sh` of the live slot):

1. `git fetch`; if `origin/master` equals `state/deployed-sha` nothing happens.
2. Otherwise it waits for the machine-wide `e2e` lock (`scripts/with-lock.mjs`, so it never builds together with an agent's
   e2e run) and runs at `nice 19` / idle I/O priority.
3. In the **inactive** slot: checkout the sha, `pnpm install --frozen-lockfile --prefer-offline`, build types + API,
   `expo export` for web, `prisma migrate deploy` on `family_budget_preview` (database is created if missing),
   write `version.json`, start the new API on a spare port (3199) and require a healthy `/api/v1/health`.
4. Swap `current` atomically, restart `family-budget-preview-api`, wait for health. If the new API is unhealthy the symlink is
   restored and the previous release restarted.
5. Any failure before the swap leaves the running release untouched; the sha goes to `state/failed-sha` (no retry loop every
   2 minutes) and the step is written to `state/last-failure`. Fix master (a new sha is tried automatically) or force a retry
   with `update.sh --force`.

Migrations are forward-only: a rolled-back release may run against an already migrated preview DB, so keep migrations
backwards compatible (as for any deploy).

## Status and logs

```bash
systemctl status family-budget-preview-api family-budget-preview-web family-budget-preview-update.timer
journalctl -u family-budget-preview-api -f           # API logs
journalctl -u family-budget-preview-web -f           # web server / proxy
journalctl -u family-budget-preview-update -n 100    # last deploys (build output, failures)
curl -s http://127.0.0.1:8100/version.json
cat /root/workspace/finance-preview/state/{deployed-sha,failed-sha,last-failure}
systemctl start family-budget-preview-update         # deploy now instead of waiting for the timer
/root/workspace/finance-preview/current/scripts/preview/update.sh --force   # retry a sha that failed
```

## Demo data

`node scripts/preview/seed-demo.mjs [apiOrigin]` fills an **empty** preview DB through the HTTP API (open month with income,
5 envelopes with initial balances, allocations, expenses incl. one not fully covered, a transfer, next month as draft). It
does nothing if any month exists. It is run once after the first deploy, not by the updater.

## Reset the preview DB

```bash
systemctl stop family-budget-preview-api
docker exec family-budget-db psql -U budget -d postgres -c 'DROP DATABASE family_budget_preview WITH (FORCE)' -c 'CREATE DATABASE family_budget_preview'
systemctl start family-budget-preview-update      # or: cd current/apps/api && pnpm exec prisma migrate deploy
systemctl start family-budget-preview-api
node /root/workspace/finance-preview/current/scripts/preview/seed-demo.mjs
```

Only ever touch `family_budget_preview`; never the dev DB `family_budget` or `*_test`.

## Install, disable, remove

- Install / re-install units (as root, idempotent): `scripts/preview/install-systemd.sh` (first deploy included;
  `--no-deploy` to skip). Unit templates: `scripts/preview/systemd/`.
- Pause auto-updates: `systemctl disable --now family-budget-preview-update.timer`.
- Stop the preview: `systemctl disable --now family-budget-preview-update.timer family-budget-preview-web family-budget-preview-api`.
- Remove completely: stop as above, delete `/etc/systemd/system/family-budget-preview-*`, `systemctl daemon-reload`,
  `rm -rf /root/workspace/finance-preview`, optionally `DROP DATABASE family_budget_preview`.
- Deploy another ref (for testing): set `PREVIEW_REF=origin/<branch>` in `preview.env` (default `origin/master`).

## Resources

API ≤ 768 MB (`MemoryMax`), web server ≤ 256 MB; typical use is far below. A build needs ~2 GB RAM and a few minutes, at
idle priority; the first slot takes ~1.1 GB of disk, the second only ~0.1 GB more (hard links into the pnpm store).
