import { describe, expect, it } from "vitest";
import { parseResume, sampleResume } from "@cvtuner/core";
import { Packer } from "docx";
import { buildDocx, countPdfPages, DENSITY, fitToPages, renderPdf } from "../src";

function bigResume() {
  const base = sampleResume();
  const work = Array.from({ length: 7 }, (_, i) => ({
    name: `Company ${i}`,
    position: `Role ${i}`,
    startDate: `${2010 + i}`,
    endDate: `${2011 + i}`,
    highlights: Array.from({ length: 8 }, (_, j) => `Delivered workstream ${j} for project ${i} with measurable cost savings and stakeholder alignment across several regional teams and partners.`),
  }));
  return parseResume({ ...base, work: [...base.work, ...work] });
}

describe("pdf", () => {
  it("renders a one page sample", async () => {
    const pdf = await renderPdf(sampleResume(), DENSITY[0]!);
    expect(countPdfPages(pdf)).toBe(1);
  }, 30000);

  it("fits a long resume into 2 pages", async () => {
    const r = bigResume();
    const before = countPdfPages(await renderPdf(r, DENSITY[0]!));
    expect(before).toBeGreaterThan(2);
    const fit = await fitToPages(r, { targetPages: 2, keywords: ["SAP"] });
    expect(fit.pages).toBeLessThanOrEqual(2);
    expect(fit.metTarget).toBe(true);
    expect(fit.droppedBullets).toBeGreaterThan(0);
    // the most relevant bullet survives
    expect(fit.resume.work[0]!.highlights.join(" ")).toMatch(/SAP/);
  }, 60000);
});

describe("docx", () => {
  it("builds a docx", async () => {
    const buf = await Packer.toBuffer(buildDocx(sampleResume(), DENSITY[0]!));
    expect(buf.subarray(0, 2).toString()).toBe("PK");
  });
});

describe("templates, languages and cover letter", () => {
  it("renders every template in another language", async () => {
    const { TEMPLATES } = await import("../src");
    for (const id of Object.keys(TEMPLATES) as ("classic" | "modern" | "serif")[]) {
      const pdf = await renderPdf(sampleResume(), DENSITY[0]!, { template: id, lang: "de" });
      expect(countPdfPages(pdf)).toBe(1);
      const docx = await Packer.toBuffer(buildDocx(sampleResume(), DENSITY[0]!, { template: id, lang: "de" }));
      expect(docx.length).toBeGreaterThan(1000);
    }
  }, 60000);

  it("renders a one page cover letter", async () => {
    const { renderLetterPdf, buildLetterDocx } = await import("../src");
    const { ruleCoverLetter, tailor, SAMPLE_JD } = await import("@cvtuner/core");
    const r = sampleResume();
    const letter = ruleCoverLetter(r, tailor(r, SAMPLE_JD).keywords, { jobTitle: "Lead", company: "Acme" });
    expect(countPdfPages(await renderLetterPdf(letter, r, { template: "modern" }))).toBe(1);
    expect((await Packer.toBuffer(buildLetterDocx(letter, r))).subarray(0, 2).toString()).toBe("PK");
  }, 30000);
});
