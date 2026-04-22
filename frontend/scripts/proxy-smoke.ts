/**
 * Smoke-test mot Vite-proxyn (http://localhost:5173).
 * Verifierar att:
 *   - / levererar index.html med Sprintaiso-appen
 *   - /api/v1/health proxyas till backend
 *   - /api/v1/auth/login sätter refresh-cookie via proxyn
 *   - /api/v1/me fungerar med mottaget accessToken
 *   - /api/v1/auth/refresh returnerar nytt access-token med cookien från login
 */

const BASE = process.env.FE_BASE ?? "http://localhost:5173";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(name: string, cond: boolean, extra?: string) {
  if (cond) {
    console.log(`  ✓ ${name}`);
    pass++;
  } else {
    console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ""}`);
    fail++;
    failures.push(name);
  }
}

async function main() {
  console.log(`🧪 Frontend proxy-smoke på ${BASE}\n`);

  // 1. index.html serveras av Vite
  console.log("▶ Vite dev-server");
  {
    const res = await fetch(`${BASE}/`);
    assert("GET / → 200", res.status === 200);
    const html = await res.text();
    assert('index.html innehåller "Sprintaiso"', html.includes("Sprintaiso"));
    assert("index.html länkar till /src/main.tsx", html.includes("/src/main.tsx"));
  }

  // 2. /api/v1/health genom proxy
  console.log("\n▶ /api/v1/health genom proxy");
  {
    const res = await fetch(`${BASE}/api/v1/health`);
    assert("health → 200", res.status === 200);
    const body = (await res.json()) as { status?: string; db?: string };
    assert("health.status = ok", body.status === "ok");
    assert("health.db = connected", body.db === "connected");
  }

  // 3. Login + cookie via proxy
  console.log("\n▶ /api/v1/auth/login genom proxy");
  const loginRes = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "klas@example.se", password: "Skog123!" }),
  });
  assert("login → 200", loginRes.status === 200);
  const loginBody = (await loginRes.json()) as {
    accessToken?: string;
    user?: { role?: string; customerId?: string | null };
  };
  assert("accessToken mottaget", Boolean(loginBody.accessToken));
  assert(
    "user.role = CUSTOMER",
    loginBody.user?.role === "CUSTOMER",
  );
  assert(
    "user.customerId finns",
    Boolean(loginBody.user?.customerId),
  );

  const setCookie = loginRes.headers.get("set-cookie");
  assert("Set-Cookie: refresh_token satt via proxy", Boolean(setCookie?.includes("refresh_token=")));
  const refreshCookie = setCookie
    ?.split(",")
    .find((p) => p.includes("refresh_token="))
    ?.split(";")[0]
    ?.trim();

  // 4. /api/v1/me med bearer-token
  console.log("\n▶ /api/v1/me med access-token");
  {
    const res = await fetch(`${BASE}/api/v1/me`, {
      headers: { authorization: `Bearer ${loginBody.accessToken}` },
    });
    assert("me → 200", res.status === 200);
    const me = (await res.json()) as { user?: { email?: string } };
    assert("me.user.email = klas@example.se", me.user?.email === "klas@example.se");
  }

  // 5. Refresh via proxy med cookie
  console.log("\n▶ /api/v1/auth/refresh genom proxy");
  {
    const res = await fetch(`${BASE}/api/v1/auth/refresh`, {
      method: "POST",
      headers: refreshCookie ? { cookie: refreshCookie } : {},
    });
    assert("refresh → 200", res.status === 200);
    const b = (await res.json()) as { accessToken?: string };
    assert("ny accessToken", Boolean(b.accessToken));
    // Två access-tokens utfärdade inom samma sekund blir byte-identiska
    // (JWT iat har sekundprecision) — vi kräver bara att ett token utfärdas.
  }

  // 6. /api/v1/deals
  console.log("\n▶ /api/v1/deals genom proxy");
  {
    const res = await fetch(`${BASE}/api/v1/deals`, {
      headers: { authorization: `Bearer ${loginBody.accessToken}` },
    });
    assert("deals → 200", res.status === 200);
    const b = (await res.json()) as {
      data?: unknown[];
      pagination?: { total: number };
    };
    assert("kunden har 2 deals", b.pagination?.total === 2);
  }

  // 7. Fel login fortfarande 401
  console.log("\n▶ negativa fall");
  {
    const res = await fetch(`${BASE}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "klas@example.se", password: "fel" }),
    });
    assert("fel lösen → 401", res.status === 401);
  }
  {
    const res = await fetch(`${BASE}/api/v1/me`);
    assert("me utan token → 401", res.status === 401);
  }

  console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass}/${pass + fail} klara, ${fail} fel`);
  if (fail > 0) {
    console.log("\nFailed:");
    failures.forEach((f) => console.log(`  • ${f}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatalt fel:", err);
  process.exit(1);
});
