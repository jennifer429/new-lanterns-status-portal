/**
 * Tests for notionTaskValidation.ts — status mapping and payload structure.
 * We test the pure logic (statusToTaskFlags, deriveTaskStatus) without hitting Notion.
 */

import { describe, it, expect } from "vitest";
import { statusToTaskFlags } from "./notionTaskValidation";

describe("statusToTaskFlags", () => {
  it("maps 'Complete' to completed=1, others=0", () => {
    const flags = statusToTaskFlags("Complete");
    expect(flags).toEqual({ completed: 1, inProgress: 0, blocked: 0, notApplicable: 0 });
  });

  it("maps 'In Progress' to inProgress=1, others=0", () => {
    const flags = statusToTaskFlags("In Progress");
    expect(flags).toEqual({ completed: 0, inProgress: 1, blocked: 0, notApplicable: 0 });
  });

  it("maps 'Blocked' to blocked=1, others=0", () => {
    const flags = statusToTaskFlags("Blocked");
    expect(flags).toEqual({ completed: 0, inProgress: 0, blocked: 1, notApplicable: 0 });
  });

  it("maps 'N/A' to notApplicable=1, others=0", () => {
    const flags = statusToTaskFlags("N/A");
    expect(flags).toEqual({ completed: 0, inProgress: 0, blocked: 0, notApplicable: 1 });
  });

  it("maps 'Not Started' to all zeros", () => {
    const flags = statusToTaskFlags("Not Started");
    expect(flags).toEqual({ completed: 0, inProgress: 0, blocked: 0, notApplicable: 0 });
  });

  it("maps unknown status to all zeros", () => {
    const flags = statusToTaskFlags("SomethingElse");
    expect(flags).toEqual({ completed: 0, inProgress: 0, blocked: 0, notApplicable: 0 });
  });

  it("maps empty string to all zeros", () => {
    const flags = statusToTaskFlags("");
    expect(flags).toEqual({ completed: 0, inProgress: 0, blocked: 0, notApplicable: 0 });
  });
});
