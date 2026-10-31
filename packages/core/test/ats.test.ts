import { describe, expect, it } from "vitest";
import { applySuggestions, atsReport, countPlaceholders, inferSkillsFromResume, sampleResume, SAMPLE_JD, screenCandidates, splitMetrics, tailor, parseResume } from "../src";

describe("metrics", () => {
  it("bolds numbers, percentages and amounts but not years", () => {
    const runs = splitMetrics("Cut costs by 9% across 120+ suppliers, saving INR 40 Cr in 2021 within 6 days");
    expect(runs.filter((r) => r.bold).map((r) => r.text)).toEqual(["9%", "120+", "INR 40 Cr", "6 days"]);
    expect(runs.map((r) => r.text).join("")).toBe("Cut costs by 9% across 120+ suppliers, saving INR 40 Cr in 2021 within 6 days");
  });
  it("counts placeholders", () => {
    const r = sampleResume();
    r.work[0]!.highlights.push("Lead time was reduced by [X%] for [N] suppliers.");
    expect(countPlaceholders(r)).toBe(2);
  });
});

describe("auto skill confirmation", () => {
  it("confirms multi-word skills only when one resume line proves every word", () => {
    const r = sampleResume();
    r.work[0]!.highlights.push("Managed the supply chain for 3 regional warehouses.");
    const found = inferSkillsFromResume(r, ["Supply Chain Management", "Stakeholder Management", "Coupa"]);
    expect(found.map((f) => f.skill)).toEqual(["Supply Chain Management"]);
    expect(found[0]!.evidence).toMatch(/supply chain/);
  });
  it("puts newly confirmed skills at the front of the skills list", () => {
    const r = sampleResume();
    const t = tailor(r, SAMPLE_JD, { confirmedSkills: ["Coupa"] });
    const out = applySuggestions(r, t.suggestions);
    expect(out.skills[0]!.keywords[0]).toBe("Coupa");
  });
});

describe("ATS report", () => {
  it("scores a tuned resume and flags sidebars and placeholders", () => {
    const r = sampleResume();
    const t = tailor(r, SAMPLE_JD);
    const good = atsReport(applySuggestions(r, t.suggestions), t, { pages: 1, singleColumn: true });
    expect(good.score).toBeGreaterThan(60);
    expect(good.checks.find((c) => c.id === "contact")!.status).toBe("pass");
    r.work[0]!.highlights.push("Costs were cut by [X%].");
    const worse = atsReport(r, t, { pages: 3, singleColumn: false });
    expect(worse.score).toBeLessThan(good.score);
    expect(worse.checks.find((c) => c.id === "placeholders")!.status).toBe("fail");
    expect(worse.checks.find((c) => c.id === "layout")!.status).toBe("warn");
  });
});

describe("recruiter screening", () => {
  it("ranks candidates and penalises missing must-haves", () => {
    const strong = sampleResume();
    const weak = parseResume({ basics: { name: "Ravi" }, work: [{ position: "Cashier", name: "Mart", highlights: ["Handled billing"] }], skills: [{ keywords: ["Excel"] }] });
    const ranked = screenCandidates(SAMPLE_JD, [
      { id: "b", fileName: "ravi.pdf", resume: weak },
      { id: "a", fileName: "asha.pdf", resume: strong },
    ], ["SAP"]);
    expect(ranked.map((c) => c.name)).toEqual(["Asha Rao", "Ravi"]);
    expect(ranked[1]!.missing).toContain("SAP");
  });
});
