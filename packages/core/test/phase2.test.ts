import { describe, expect, it } from "vitest";
import {
  buildTailorPrompt,
  detectAts,
  atsApiUrl,
  extractJson,
  htmlToText,
  isBlockedHost,
  matchScore,
  parseAts,
  parseJsonLd,
  ruleCoverLetter,
  sampleResume,
  SAMPLE_JD,
  tailor,
  validateAiTailor,
} from "../src";

const resume = sampleResume();
const rule = tailor(resume, SAMPLE_JD);
const input = { resume, jd: SAMPLE_JD, voice: "passive" as const, confirmedSkills: [], gaps: rule.gaps.map((g) => g.name), language: "English" };

describe("AI tailoring guard", () => {
  it("lists gaps in the prompt so the model is told not to claim them", () => {
    const [system] = buildTailorPrompt(input);
    expect(system!.content).toContain("Coupa");
    expect(system!.content).toContain("PASSIVE");
  });

  it("extracts JSON from fenced or chatty replies", () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here: {"a":{"b":2}} thanks')).toEqual({ a: { b: 2 } });
    expect(() => extractJson("no json")).toThrow();
  });

  it("drops lines that claim unbacked skills and unknown role ids", () => {
    const roleId = resume.work[0]!.id;
    const out = validateAiTailor(
      {
        bullets: [
          { roleId, text: "Supplier contracts were renegotiated using SAP", jdSource: "Manage vendor contracts" },
          { roleId, text: "Sourcing was run in Coupa for 120 suppliers", jdSource: "Coupa" },
          { roleId: "made-up", text: "Monthly spend was forecast with finance", jdSource: "budgeting" },
        ],
        summary: "Procurement leader with SAP and Kubernetes experience.",
        skillsOrder: ["SAP", "Kubernetes", "Negotiation"],
      },
      input,
      rule,
    );
    const bullets = out.suggestions.filter((s) => s.kind === "add-bullet");
    expect(bullets.map((b) => b.kind === "add-bullet" && b.text)).toEqual(["Supplier contracts were renegotiated using SAP.", "Monthly spend was forecast with finance."]);
    // unknown role id falls back to the most recent role
    expect(bullets[1]!.kind === "add-bullet" && bullets[1]!.targetId).toBe(roleId);
    expect(out.rejected.map((r) => r.reason).join(" ")).toMatch(/Coupa/);
    expect(out.rejected.map((r) => r.reason).join(" ")).toMatch(/Kubernetes/);
    const order = out.suggestions.find((s) => s.kind === "reorder-skills");
    expect(order && order.kind === "reorder-skills" && order.order).not.toContain("Kubernetes");
    expect(order && order.kind === "reorder-skills" && order.order[0]).toBe("SAP");
  });

  it("allows confirmed skills", () => {
    const withCoupa = { ...input, confirmedSkills: ["Coupa"], gaps: input.gaps.filter((g) => g !== "Coupa") };
    const out = validateAiTailor({ bullets: [{ roleId: resume.work[0]!.id, text: "Sourcing events were run in Coupa" }] }, withCoupa, tailor(resume, SAMPLE_JD, { confirmedSkills: ["Coupa"] }));
    expect(out.suggestions.some((s) => s.kind === "add-bullet")).toBe(true);
  });
});

describe("job sources", () => {
  it("detects ATS links", () => {
    expect(detectAts("https://boards.greenhouse.io/acme/jobs/123")).toEqual({ kind: "greenhouse", board: "acme", id: "123" });
    expect(detectAts("https://job-boards.greenhouse.io/acme")).toEqual({ kind: "greenhouse", board: "acme", id: undefined });
    expect(detectAts("https://jobs.lever.co/acme/abc-def")).toEqual({ kind: "lever", company: "acme", id: "abc-def" });
    expect(detectAts("https://jobs.ashbyhq.com/acme/uuid-1")).toEqual({ kind: "ashby", org: "acme", id: "uuid-1" });
    expect(detectAts("https://jobs.smartrecruiters.com/Acme/7441-senior-buyer")).toEqual({ kind: "smartrecruiters", company: "Acme", id: "7441" });
    expect(detectAts("https://apply.workable.com/acme/j/AB12CD/")).toEqual({ kind: "workable", account: "acme", id: "AB12CD" });
    expect(detectAts("https://example.com/careers")).toBeNull();
    expect(atsApiUrl({ kind: "lever", company: "acme" })).toBe("https://api.lever.co/v0/postings/acme?mode=json");
  });

  it("blocks portals that forbid scraping", () => {
    expect(isBlockedHost("www.linkedin.com")).toBe(true);
    expect(isBlockedHost("in.indeed.com")).toBe(true);
    expect(isBlockedHost("www.naukri.com")).toBe(true);
    expect(isBlockedHost("boards.greenhouse.io")).toBe(false);
  });

  it("parses JSON-LD JobPosting", () => {
    const html = `<html><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization"},{"@type":"JobPosting","title":"Staff Nurse","description":"&lt;p&gt;Provide &lt;b&gt;patient care&lt;/b&gt;&lt;/p&gt;&lt;ul&gt;&lt;li&gt;BLS required&lt;/li&gt;&lt;/ul&gt;","hiringOrganization":{"name":"City Hospital"},"jobLocation":{"address":{"addressLocality":"Pune","addressCountry":"IN"}}}]}</script></html>`;
    const job = parseJsonLd(html, "https://x.test/job")!;
    expect(job).toMatchObject({ title: "Staff Nurse", company: "City Hospital", location: "Pune, IN", source: "json-ld" });
    expect(job.text).toContain("Provide patient care");
    expect(job.text).toContain("- BLS required");
  });

  it("parses Greenhouse and Lever payloads", () => {
    const gh = parseAts({ kind: "greenhouse", board: "acme" }, { jobs: [{ id: 1, title: "Buyer", content: "&lt;p&gt;Manage suppliers&lt;/p&gt;", location: { name: "Remote" }, absolute_url: "https://boards.greenhouse.io/acme/jobs/1" }] }, "u");
    expect(gh[0]).toMatchObject({ id: "1", title: "Buyer", location: "Remote" });
    expect(gh[0]!.text).toContain("Manage suppliers");
    const lv = parseAts({ kind: "lever", company: "acme", id: "x" }, { id: "x", text: "Analyst", descriptionPlain: "Do analysis", lists: [{ text: "Requirements", content: "<li>SQL</li>" }], categories: { location: "Hyderabad" } }, "u");
    expect(lv[0]!.text).toContain("Requirements");
    expect(lv[0]!.text).toContain("SQL");
  });

  it("turns HTML into readable text", () => {
    expect(htmlToText("<h2>Role</h2><script>x()</script><ul><li>One</li><li>Two &amp; three</li></ul>")).toBe("Role\n- One\n- Two & three");
  });
});

describe("cover letter and scoring", () => {
  it("writes a rule-based cover letter from real resume lines", () => {
    const l = ruleCoverLetter(resume, rule.keywords, { jobTitle: "Senior Procurement Lead", company: "Acme Foods" });
    expect(l.paragraphs[0]).toContain("Senior Procurement Lead position at Acme Foods");
    expect(l.paragraphs.join(" ")).toMatch(/SAP/);
    expect(l.signature).toBe("Asha Rao");
  });
  it("scores postings quickly", () => {
    const { score, missing } = matchScore(resume, SAMPLE_JD);
    expect(score).toBe(rule.score);
    expect(missing).toContain("Coupa");
  });
});
