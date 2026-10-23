import { describe, expect, it } from "vitest";
import { mapProviderStatus } from "./video-provider";

describe("mapProviderStatus", () => {
  it("treats finished and failed states and leaves the rest as processing", () => {
    expect(mapProviderStatus("completed")).toBe("completed");
    expect(mapProviderStatus("failed")).toBe("failed");
    expect(mapProviderStatus("transcribing")).toBe("processing");
    expect(mapProviderStatus("")).toBe("processing");
  });
});
