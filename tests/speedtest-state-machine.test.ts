import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertTransition,
  canTransition,
  isSuccessfulStatus,
} from "../lib/speedtest/state-machine";
import { SpeedTestJobError } from "../lib/speedtest/errors";

test("PENDING can move to RUNNING or CANCELLED", () => {
  assert.equal(canTransition("PENDING", "RUNNING"), true);
  assert.equal(canTransition("PENDING", "CANCELLED"), true);
  assert.equal(canTransition("PENDING", "SUCCESS"), false);
  assert.equal(canTransition("PENDING", "FAILED"), false);
});

test("RUNNING can finish as SUCCESS, FAILED, or CANCELLED", () => {
  assert.equal(canTransition("RUNNING", "SUCCESS"), true);
  assert.equal(canTransition("RUNNING", "FAILED"), true);
  assert.equal(canTransition("RUNNING", "CANCELLED"), true);
  assert.equal(canTransition("RUNNING", "PENDING"), false);
});

test("terminal states reject further transitions", () => {
  for (const status of ["SUCCESS", "COMPLETED", "FAILED", "CANCELLED"] as const) {
    assert.equal(canTransition(status, "RUNNING"), false);
    assert.equal(canTransition(status, "PENDING"), false);
  }
});

test("SUCCESS and COMPLETED both count as successful", () => {
  assert.equal(isSuccessfulStatus("SUCCESS"), true);
  assert.equal(isSuccessfulStatus("COMPLETED"), true);
  assert.equal(isSuccessfulStatus("FAILED"), false);
});

test("assertTransition throws on illegal jumps", () => {
  assert.throws(
    () => assertTransition("PENDING", "SUCCESS"),
    (error: unknown) => error instanceof SpeedTestJobError && error.code === "ILLEGAL_TRANSITION"
  );
});
