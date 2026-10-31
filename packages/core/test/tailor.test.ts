import { describe, expect, it } from "vitest";
import { applySuggestions, bulletPriorities, dropBullets, parseJd, parseResumeText, sampleResume, SAMPLE_JD, tailor } from "../src";

describe("parseJd", () => {
  const jd = parseJd(SAMPLE_JD);
  it("finds sections, keywords and phrases", () => {
    expect(jd.title).toBe("Senior Procurement Lead");
    const names = jd.keywords.map((k) => k.name);
    expect(names).toEqual(expect.arrayContaining(["SAP", "Power BI", "Negotiation", "Vendor Management", "Six Sigma", "Excel"]));
    // benefits are ignored
    expect(names).not.toContain("Health and Safety");
    expect(jd.phrases.map((p) => p.text)).toContain("manage vendor contracts and reduce costs across packaging and raw materials");
  });
  it("works for a non-tech domain", () => {
    const nurse = parseJd(`Registered Nurse\nResponsibilities\n- Administer medications and monitor patient care\n- Maintain accurate EHR documentation\nRequirements\n- BLS and ACLS certification`);
    expect(nurse.keywords.map((k) => k.name)).toEqual(expect.arrayContaining(["BLS", "ACLS", "Electronic Health Records"]));
  });
});

describe("tailor", () => {
  const resume = sampleResume();
  it("scores coverage and only suggests truthful bullets", () => {
    const r = tailor(resume, SAMPLE_JD, { voice: "passive" });
    expect(r.score).toBeGreaterThan(40);
    expect(r.gaps.map((g) => g.name)).toEqual(expect.arrayContaining(["Coupa"]));
    const bullets = r.suggestions.filter((s) => s.kind === "add-bullet");
    expect(bullets.length).toBeGreaterThan(0);
    for (const b of bullets) expect(b.kind === "add-bullet" && /\b(was|were)\b/.test(b.text)).toBe(true);
    // Coupa is not in the profile, so no bullet may mention it
    expect(bullets.some((b) => b.kind === "add-bullet" && /coupa|ariba/i.test(b.text))).toBe(false);
  });
  it("adds confirmed skills and applies suggestions", () => {
    const r = tailor(resume, SAMPLE_JD, { confirmedSkills: ["Coupa"], voice: "active" });
    const out = applySuggestions(resume, r.suggestions);
    expect(out.skills[0]!.keywords).toContain("Coupa");
    expect(out.skills[0]!.keywords[0]).not.toBe("Inventory Management");
    expect(out.work.flatMap((w) => w.highlights).length).toBeGreaterThan(resume.work.flatMap((w) => w.highlights).length);
    expect(resume.skills[0]!.keywords).not.toContain("Coupa"); // input untouched
  });
});

describe("trimming", () => {
  it("drops lowest priority bullets but keeps one per entry", () => {
    const resume = sampleResume();
    const order = bulletPriorities(resume, ["SAP", "Negotiation"]);
    const out = dropBullets(resume, order, 100);
    expect(out.work.every((w) => w.highlights.length === 1)).toBe(true);
    expect(out.work[0]!.highlights[0]).toMatch(/SAP|Negotiat/);
  });
});

describe("parseResumeText", () => {
  it("parses a plain text resume", () => {
    const r = parseResumeText(`Jane Doe
Data Analyst
jane@example.com | +1 555 123 4567
SUMMARY
Analyst with 5 years of experience.
EXPERIENCE
Senior Data Analyst at Globex  Jan 2020 - Present
• Built SQL pipelines for finance reporting
• Automated Tableau dashboards
EDUCATION
State University
BSc Statistics 2016
SKILLS
SQL, Python, Tableau, Excel`);
    expect(r.basics.name).toBe("Jane Doe");
    expect(r.basics.email).toBe("jane@example.com");
    expect(r.work[0]).toMatchObject({ position: "Senior Data Analyst", name: "Globex", startDate: "Jan 2020", endDate: "Present" });
    expect(r.work[0]!.highlights).toHaveLength(2);
    expect(r.skills[0]!.keywords).toEqual(["SQL", "Python", "Tableau", "Excel"]);
    expect(r.education[0]).toMatchObject({ institution: "State University", area: "BSc Statistics" });
  });
  it("treats sentence lines without bullet glyphs as highlights", () => {
    const r = parseResumeText(`Sam Lee\nEXPERIENCE\nStaff Nurse | City Hospital  2019 - Present\nMonitored vital signs for 30 patients per shift.\nTrained new nurses on EHR charting.\nEDUCATION\nCity College`);
    expect(r.work).toHaveLength(1);
    expect(r.work[0]!.highlights).toHaveLength(2);
  });
});
