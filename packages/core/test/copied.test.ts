import { describe, expect, it } from "vitest";
import { cleanCopiedJob, slugHints } from "../src";

describe("copied job pages", () => {
  it("extracts the description from a copied LinkedIn page", () => {
    const page = `Skip to main content\nHome\nMy Network\nJobs\nAcme Foods\nSenior Procurement Lead\nHyderabad, Telangana, India · 3 weeks ago · Over 100 applicants\nPromoted\nEasy Apply\nSave\nAbout the job\nWe are hiring a Senior Procurement Lead.\nResponsibilities\nManage vendor contracts and reduce costs across packaging.\nRequirements\n6+ years in procurement. Strong negotiation.\nShow more\nSet alert for similar jobs\nProcurement, Hyderabad\nAbout the company\nAcme Foods makes snacks.`;
    const r = cleanCopiedJob(page);
    expect(r.cleaned).toBe(true);
    expect(r.text).toContain("Manage vendor contracts");
    expect(r.text).not.toMatch(/Easy Apply|Set alert|About the company|makes snacks/);
    expect(r.title).toBe("Senior Procurement Lead");
    expect(r.company).toBe("Acme Foods");
  });
  it("reads title hints from portal URLs", () => {
    expect(slugHints("https://www.linkedin.com/jobs/view/senior-procurement-lead-at-acme-foods-4470449960/")).toEqual({ title: "senior procurement lead", company: "acme foods" });
    expect(slugHints("https://www.linkedin.com/jobs/view/4470449960/")).toEqual({});
  });
});
