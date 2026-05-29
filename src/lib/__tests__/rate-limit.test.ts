import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { checkLimit } from "../rate-limit";

function fakeReq(ip: string): NextRequest {
  return { headers: new Headers({ "x-forwarded-for": ip }) } as unknown as NextRequest;
}

describe("checkLimit", () => {
  it("allows up to max requests then blocks", () => {
    const r = fakeReq("1.2.3.4");
    for (let i = 0; i < 3; i++) expect(checkLimit(r, "t1", 3, 60_000)).toBeNull();
    const blocked = checkLimit(r, "t1", 3, 60_000);
    expect(blocked?.status).toBe(429);
    expect(blocked?.retryAfter).toBeGreaterThan(0);
  });

  it("isolates IPs", () => {
    const a = fakeReq("10.0.0.1");
    const b = fakeReq("10.0.0.2");
    checkLimit(a, "t2", 1, 60_000);
    expect(checkLimit(a, "t2", 1, 60_000)?.status).toBe(429);
    expect(checkLimit(b, "t2", 1, 60_000)).toBeNull();
  });

  it("isolates scopes", () => {
    const r = fakeReq("9.9.9.9");
    checkLimit(r, "scopeA", 1, 60_000);
    expect(checkLimit(r, "scopeA", 1, 60_000)?.status).toBe(429);
    expect(checkLimit(r, "scopeB", 1, 60_000)).toBeNull();
  });
});
