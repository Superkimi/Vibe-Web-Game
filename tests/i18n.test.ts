import assert from "node:assert/strict";
import test from "node:test";
import { translateMessage } from "@/lib/i18n";

test("translates studio labels and interpolates values", () => {
  assert.equal(translateMessage("zh", "Inspector"), "检查器");
  assert.equal(translateMessage("zh", "{count} objects", { count: 3 }), "3 个对象");
  assert.equal(translateMessage("en", "{count} objects", { count: 3 }), "3 objects");
});

test("falls back to the source message for unknown keys", () => {
  assert.equal(translateMessage("zh", "Custom project label"), "Custom project label");
});
