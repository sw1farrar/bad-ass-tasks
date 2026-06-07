import { describe, it, expect, afterEach } from "vitest";
import { verifyDatabaseSchema } from "@/lib/supabase/verifyDatabaseSchema";

describe("verifyDatabaseSchema", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = originalEnv;
  });

  it("reports not configured when admin credentials are missing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";

    const report = await verifyDatabaseSchema();
    expect(report.configured).toBe(false);
    expect(report.ok).toBe(false);
    expect(report.missing[0]).toMatch(/not configured/i);
  });
});