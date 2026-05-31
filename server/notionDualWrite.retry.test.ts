/**
 * Regression tests for the Notion dual-write retry queue contract.
 *
 * Bug: when a dual-write failed, upsertPage enqueued its *internal* opts
 * ({ dbId, dsId, mysqlId, title, writeType }) as the retry payload instead of
 * the original sync payload. On retry, syncAiChatLog(data) then read
 * data.createdAt (undefined) and crashed with
 * "Cannot read properties of undefined (reading 'toISOString')".
 *
 * These tests pin down that the enqueued payload is the original payload and
 * that it survives a JSON round-trip (Date -> ISO string) through the queue.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks referenced inside vi.mock factories must be hoisted alongside them.
const { enqueueMock } = vi.hoisted(() => ({ enqueueMock: vi.fn(async () => {}) }));

// Make getClient() build a client whose calls always fail, so every sync
// function hits the catch/enqueue path.
vi.mock("./_core/env", () => ({
  ENV: { notionApiKey: "test-key" },
}));

vi.mock("@notionhq/client", () => ({
  Client: class {
    dataSources = {
      query: vi.fn(async () => {
        throw new Error("Notion is down");
      }),
    };
    pages = {
      create: vi.fn(async () => {
        throw new Error("Notion is down");
      }),
      update: vi.fn(async () => {
        throw new Error("Notion is down");
      }),
    };
  },
}));

// Capture what gets enqueued without touching the DB.
vi.mock("./notionRetryQueue", () => ({
  enqueueFailedWrite: enqueueMock,
}));

import { syncAiChatLog, syncActivityFeed, type AiChatLogPayload } from "./notionDualWrite";

beforeEach(() => {
  enqueueMock.mockClear();
});

describe("dual-write retry enqueue", () => {
  it("enqueues the full original payload (not internal upsertPage opts)", async () => {
    const payload: AiChatLogPayload = {
      mysqlId: 1050001,
      organizationId: 42,
      orgName: "boulder",
      userEmail: "jennifer@newlantern.ai",
      userRole: "admin",
      prompt: "hello",
      response: "world",
      model: "claude-sonnet",
      tokensUsed: null,
      toolCalls: null,
      createdAt: new Date("2026-05-31T12:00:00.000Z"),
    };

    const ok = await syncAiChatLog(payload);
    expect(ok).toBe(false); // write failed
    expect(enqueueMock).toHaveBeenCalledTimes(1);

    const [enqueued] = enqueueMock.mock.calls[0];
    expect(enqueued.writeType).toBe("aiChatLog");
    // The enqueued data must be the original payload so a retry can rebuild
    // the Notion properties — in particular it must carry createdAt + userEmail.
    expect(enqueued.data).toMatchObject({
      mysqlId: 1050001,
      userEmail: "jennifer@newlantern.ai",
      createdAt: payload.createdAt,
    });
  });

  it("does not crash re-syncing a JSON-round-tripped payload (Date -> string)", async () => {
    const original: AiChatLogPayload = {
      mysqlId: 1050001,
      organizationId: null,
      orgName: null,
      userEmail: "jennifer@newlantern.ai",
      userRole: "admin",
      prompt: "p",
      response: "r",
      model: "claude-sonnet",
      tokensUsed: null,
      toolCalls: null,
      createdAt: new Date("2026-05-31T12:00:00.000Z"),
    };

    // Simulate what the retry queue does: JSON.stringify on enqueue, JSON.parse
    // on dequeue. This turns createdAt into a string.
    const rehydrated = JSON.parse(JSON.stringify(original));
    expect(typeof rehydrated.createdAt).toBe("string");

    // The pre-fix code threw "createdAt.toISOString is not a function" here.
    await expect(syncAiChatLog(rehydrated)).resolves.toBe(false);
    expect(enqueueMock).toHaveBeenCalledTimes(1);
  });

  it("handles activityFeed titles with a string createdAt after round-trip", async () => {
    const rehydrated = JSON.parse(
      JSON.stringify({
        mysqlId: 7,
        organizationId: 1,
        orgName: "boulder",
        eventType: "task_completed",
        actor: "user@x.com",
        description: "done",
        createdAt: new Date("2026-05-31T12:00:00.000Z"),
      })
    );

    await expect(syncActivityFeed(rehydrated)).resolves.toBe(false);
  });
});
