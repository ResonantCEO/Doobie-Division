---
name: Neon DB driver — concurrent query crash fix
description: neon-http (HTTP mode) returns null rows under concurrent requests; the fix is to use the WebSocket Pool mode.
---

The root cause: `drizzle-orm/neon-http` uses HTTP for each query. When many queries fire simultaneously (admin page load fires 5–10 queries at once), Neon's serverless HTTP endpoint returns null row arrays, causing "Cannot read properties of null (reading 'map')". Increasing retries doesn't help — all retries also compete.

**Fix:** Switch to `drizzle-orm/neon-serverless` with a `Pool` (WebSocket mode).

```ts
// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
export const sql = pool; // for raw queries: pool.query("...", [params])
```

**Why:** Pool mode keeps persistent WebSocket connections; queries are properly queued per connection slot instead of fighting over a single HTTP endpoint.

**How to apply:** Any time you see "Cannot read properties of null (reading 'map')" from Neon in a project using neon-http under load — switch to neon-serverless + Pool + ws. Also: remove per-request `checkDatabaseConnection()` middleware (it doubles the query count by running SELECT 1 on every request).

Raw SQL syntax changes with Pool: `await pool.query("SELECT ... WHERE id = $1", [id])` instead of tagged templates. `rawSql\`...\`` becomes `const { rows } = await rawPool.query("...", [params])`.
