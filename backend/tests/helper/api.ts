/**
 * Enkel end-to-end-test mot en körande backend.
 * Kör med: pnpm exec tsx scripts/api-test.ts
 *
 * Förutsätter:
 *  - servern lyssnar på http://localhost:4000
 *  - databasen är seedad (pnpm db:seed)
 *  - Redis är uppe (för rate limiting)
 */

const BASE = process.env.API_BASE ?? "http://localhost:4000";

type Assertion = {
  name: string;
  ok: boolean;
  got?: unknown;
  want?: unknown;
  note?: string;
};

const results: Assertion[] = [];

function record(a: Assertion) {
  results.push(a);
  const icon = a.ok ? "✓" : "✗";
  const extra = a.ok
    ? ""
    : ` — got=${JSON.stringify(a.got)} want=${JSON.stringify(a.want)}${a.note ? ` (${a.note})` : ""}`;
  console.log(`  ${icon} ${a.name}${extra}`);
}

function assertEq(name: string, got: unknown, want: unknown, note?: string) {
  record({ name, ok: got === want, got, want, note });
}

function assertTruthy(name: string, got: unknown, note?: string) {
  record({ name, ok: Boolean(got), got, note });
}

interface Call {
  method?: string;
  path: string;
  token?: string;
  cookie?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function call({ method = "GET", path, token, cookie, body, headers }: Call) {
  const h: Record<string, string> = { "content-type": "application/json", ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  if (cookie) h.cookie = cookie;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, headers: res.headers, body: json };
}

function extractRefreshCookie(setCookie: string | null): string | undefined {
  if (!setCookie) return undefined;
  const part = setCookie.split(",").find((p) => p.includes("refresh_token="));
  if (!part) return undefined;
  const kv = part.split(";")[0];
  return kv?.trim();
}

async function main() {
  console.log(`🧪 Testar API på ${BASE}\n`);

  // --- Health ---
  console.log("▶ health");
  {
    const r = await call({ path: "/api/v1/health" });
    assertEq("GET /health → 200", r.status, 200);
    const b = r.body as { status?: string; db?: string };
    assertEq("health.status = ok", b?.status, "ok");
    assertEq("health.db = connected", b?.db, "connected");
  }

  // --- Felaktig login ---
  console.log("\n▶ auth (negativa fall)");
  {
    const r = await call({
      method: "POST",
      path: "/api/v1/auth/login",
      body: { email: "klas@example.se", password: "fel-lösen" },
    });
    assertEq("POST /auth/login fel lösen → 401", r.status, 401);
    assertEq(
      "fel kod = UNAUTHORIZED",
      (r.body as { code?: string })?.code,
      "UNAUTHORIZED",
    );
  }
  {
    const r = await call({
      method: "POST",
      path: "/api/v1/auth/login",
      body: { email: "inte-en-email", password: "x" },
    });
    assertEq("POST /auth/login bad email → 400", r.status, 400);
    assertEq(
      "kod = VALIDATION_ERROR",
      (r.body as { code?: string })?.code,
      "VALIDATION_ERROR",
    );
  }

  // --- Kund-login ---
  console.log("\n▶ auth (kund)");
  const customerLogin = await call({
    method: "POST",
    path: "/api/v1/auth/login",
    body: { email: "klas@example.se", password: "Skog123!" },
  });
  assertEq("kund-login → 200", customerLogin.status, 200);
  const customerToken = (customerLogin.body as { accessToken?: string })?.accessToken;
  assertTruthy("accessToken mottaget", customerToken);
  const customerRefreshCookie = extractRefreshCookie(
    customerLogin.headers.get("set-cookie"),
  );
  assertTruthy("refresh_token cookie satt", customerRefreshCookie);

  // --- Admin-login ---
  const adminLogin = await call({
    method: "POST",
    path: "/api/v1/auth/login",
    body: { email: "admin@skogsbo.se", password: "Admin123!" },
  });
  assertEq("admin-login → 200", adminLogin.status, 200);
  const adminToken = (adminLogin.body as { accessToken?: string })?.accessToken;
  assertTruthy("admin accessToken mottaget", adminToken);

  // --- Auth required ---
  console.log("\n▶ skyddade endpoints utan token");
  {
    const r = await call({ path: "/api/v1/me" });
    assertEq("GET /me utan token → 401", r.status, 401);
  }
  {
    const r = await call({ path: "/api/v1/deals" });
    assertEq("GET /deals utan token → 401", r.status, 401);
  }

  // --- /me ---
  console.log("\n▶ /me");
  {
    const r = await call({ path: "/api/v1/me", token: customerToken });
    assertEq("GET /me (kund) → 200", r.status, 200);
    const b = r.body as { user?: { email?: string }; bankAccountMasked?: string };
    assertEq("me.user.email = klas@example.se", b?.user?.email, "klas@example.se");
    assertTruthy("me.bankAccountMasked finns", b?.bankAccountMasked);
  }
  {
    const r = await call({ path: "/api/v1/me", token: adminToken });
    assertEq("GET /me (admin) → 403", r.status, 403);
  }
  {
    const r = await call({
      method: "PATCH",
      path: "/api/v1/me",
      token: customerToken,
      body: { phone: "+46700000001" },
    });
    assertEq("PATCH /me → 200", r.status, 200);
  }
  {
    const r = await call({
      method: "PATCH",
      path: "/api/v1/me",
      token: customerToken,
      body: {},
    });
    assertEq("PATCH /me tomt → 400", r.status, 400);
  }
  {
    const r = await call({
      method: "PUT",
      path: "/api/v1/me/bank-account",
      token: customerToken,
      body: { bankAccount: "3300-1234567" },
    });
    assertEq("PUT /me/bank-account → 200", r.status, 200);
    const b = r.body as { bankAccountMasked?: string };
    assertEq("nytt bankkonto maskat = ****4567", b?.bankAccountMasked, "****4567");
  }

  // --- /deals ---
  console.log("\n▶ /deals");
  let ownedDealId = "";
  {
    const r = await call({ path: "/api/v1/deals", token: customerToken });
    assertEq("GET /deals → 200", r.status, 200);
    const b = r.body as {
      data?: Array<{ id: string }>;
      pagination?: { total: number };
    };
    assertTruthy("deals.data finns", Array.isArray(b?.data));
    assertEq("kunden har 2 deals", b?.pagination?.total, 2);
    ownedDealId = b?.data?.[0]?.id ?? "";
  }
  {
    const r = await call({
      path: `/api/v1/deals/${ownedDealId}`,
      token: customerToken,
    });
    assertEq("GET /deals/:id (egen) → 200", r.status, 200);
  }
  {
    // Slumpa UUID som inte finns.
    const r = await call({
      path: "/api/v1/deals/00000000-0000-0000-0000-000000000000",
      token: customerToken,
    });
    assertEq("GET /deals/:id (ogiltigt) → 404", r.status, 404);
  }
  for (const sub of ["events", "timber", "costs", "documents", "messages"]) {
    const r = await call({
      path: `/api/v1/deals/${ownedDealId}/${sub}`,
      token: customerToken,
    });
    assertEq(`GET /deals/:id/${sub} → 200`, r.status, 200);
  }
  {
    const r = await call({
      method: "POST",
      path: `/api/v1/deals/${ownedDealId}/messages`,
      token: customerToken,
      body: { body: "Hej, några frågor om gallringen." },
    });
    assertEq("POST /deals/:id/messages → 201", r.status, 201);
  }
  {
    const r = await call({
      method: "POST",
      path: `/api/v1/deals/${ownedDealId}/messages`,
      token: customerToken,
      body: { body: "" },
    });
    assertEq("POST tomt meddelande → 400", r.status, 400);
  }

  // --- /payments ---
  console.log("\n▶ /payments");
  {
    const r = await call({ path: "/api/v1/payments", token: customerToken });
    assertEq("GET /payments → 200", r.status, 200);
    const b = r.body as { pagination?: { total: number } };
    assertEq("kunden har 1 payment", b?.pagination?.total, 1);
  }

  // --- Admin ---
  console.log("\n▶ /admin");
  {
    const r = await call({ path: "/api/v1/admin/customers", token: customerToken });
    assertEq("GET /admin/customers som kund → 403", r.status, 403);
  }
  {
    const r = await call({ path: "/api/v1/admin/customers", token: adminToken });
    assertEq("GET /admin/customers som admin → 200", r.status, 200);
  }
  {
    const r = await call({ path: "/api/v1/admin/deals", token: adminToken });
    assertEq("GET /admin/deals → 200", r.status, 200);
  }
  let newDealId = "";
  {
    // Hitta customerId för att skapa deal.
    const list = await call({ path: "/api/v1/admin/customers", token: adminToken });
    const customerId = (list.body as { data?: Array<{ id: string }> })?.data?.[0]?.id;
    assertTruthy("hittade customerId för admin-test", customerId);
    const r = await call({
      method: "POST",
      path: "/api/v1/admin/deals",
      token: adminToken,
      body: {
        customerId,
        externalId: `TEST-${Date.now()}`,
        title: "Testaffär via API",
        dealType: "OVRIGT",
        status: "PLANERAD",
        estimatedGrossSek: 15000,
      },
    });
    assertEq("POST /admin/deals → 201", r.status, 201);
    newDealId = (r.body as { id?: string })?.id ?? "";
  }
  {
    const r = await call({
      method: "PUT",
      path: `/api/v1/admin/deals/${newDealId}`,
      token: adminToken,
      body: { status: "PAGAENDE" },
    });
    assertEq("PUT /admin/deals/:id → 200", r.status, 200);
  }
  {
    const r = await call({
      method: "POST",
      path: `/api/v1/admin/deals/${newDealId}/events`,
      token: adminToken,
      body: { eventType: "AVTAL_SIGNERAT", label: "Avtal signerat (test)" },
    });
    assertEq("POST /admin/deals/:id/events → 201", r.status, 201);
  }

  // --- Refresh & logout ---
  console.log("\n▶ refresh / logout");
  {
    const r = await call({
      method: "POST",
      path: "/api/v1/auth/refresh",
      cookie: customerRefreshCookie,
    });
    assertEq("POST /auth/refresh → 200", r.status, 200);
    assertTruthy(
      "ny accessToken utfärdad",
      (r.body as { accessToken?: string })?.accessToken,
    );
  }
  {
    const r = await call({
      method: "POST",
      path: "/api/v1/auth/refresh",
    });
    assertEq("POST /auth/refresh utan cookie → 401", r.status, 401);
  }
  {
    // Logout tar bort refresh-tokenen — men vi har redan roterat ovan, så
    // den gamla tokenen är återkallad redan. Verifiera att logout svarar 204.
    const r = await call({ method: "POST", path: "/api/v1/auth/logout" });
    assertEq("POST /auth/logout → 204", r.status, 204);
  }

  // --- Rate limit ---
  console.log("\n▶ rate limit");
  {
    // /login är begränsad till 10 req/min. Gör 12 förfrågningar och verifiera
    // att minst en får 429.
    let limited = 0;
    for (let i = 0; i < 12; i++) {
      const r = await call({
        method: "POST",
        path: "/api/v1/auth/login",
        body: { email: `ratelimit-${i}@example.se`, password: "x" },
        headers: { "x-forwarded-for": "10.0.0.99" },
      });
      if (r.status === 429) limited++;
    }
    assertTruthy(`minst en 429 vid rate limit (fick ${limited})`, limited >= 1);
  }

  // --- Summering ---
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(
    `\n${failed === 0 ? "✅" : "❌"} ${passed}/${results.length} klara, ${failed} fel`,
  );
  if (failed > 0) {
    console.log("\nFel:");
    for (const r of results.filter((r) => !r.ok)) {
      console.log(
        `  • ${r.name} — got=${JSON.stringify(r.got)} want=${JSON.stringify(r.want)}`,
      );
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatalt fel i testet:", err);
  process.exit(1);
});
