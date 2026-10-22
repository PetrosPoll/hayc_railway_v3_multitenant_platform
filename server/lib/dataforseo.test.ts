import { describe, expect, it } from "vitest";
import { readOrganicResults, readSearchVolume } from "./dataforseo";

describe("DataForSEO parsers", () => {
  it("reads search volume", () => {
    expect(readSearchVolume({ result: [{ search_volume: 880 }] })).toBe(880);
    expect(readSearchVolume({ result: [{}] })).toBeNull();
  });

  it("keeps the first organic titles and snippets", () => {
    expect(readOrganicResults({
      result: [{
        items: [
          { type: "organic", title: "Πρώτο", description: "απόσπασμα" },
          { type: "people_also_ask", title: "Όχι" },
          { type: "organic", title: "Δεύτερο", description: "" },
        ],
      }],
    })).toEqual([
      { title: "Πρώτο", description: "απόσπασμα" },
      { title: "Δεύτερο", description: "" },
    ]);
  });
});
