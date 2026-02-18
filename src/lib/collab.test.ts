import { describe, expect, it } from "vitest";
import {
	hasRevisionAdvance,
	isSelfUpdate,
	shouldApplyIncomingState,
} from "./collab";

describe("collab revision helpers", () => {
	it("detects revision advance", () => {
		expect(hasRevisionAdvance(2, 3)).toBe(true);
		expect(hasRevisionAdvance(2, 2)).toBe(false);
		expect(hasRevisionAdvance(4, 1)).toBe(false);
	});

	it("detects self updates", () => {
		expect(isSelfUpdate("user-a", "user-a")).toBe(true);
		expect(isSelfUpdate("user-a", "user-b")).toBe(false);
		expect(isSelfUpdate(null, "user-a")).toBe(false);
	});

	it("applies incoming state only when revision is newer", () => {
		expect(shouldApplyIncomingState(8, 9)).toBe(true);
		expect(shouldApplyIncomingState(8, 8)).toBe(false);
	});
});
