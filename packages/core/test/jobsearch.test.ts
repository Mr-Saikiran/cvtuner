import { describe, expect, it } from "vitest";
import { dedupeJobs, parseSearch, portalSearchLinks, profileSearchQuery, sampleResume, searchUrl } from "../src";

describe("job search", () => {
  const q = profileSearchQuery(sampleResume());
  it("builds a query from the profile", () => {
    expect(q).toEqual({ title: "Procurement Manager", location: "Hyderabad", country: "in" });
  });
  it("uses a simple headline as is", () => {
    const r = sampleResume();
    r.basics.label = "Category Buyer";
    expect(profileSearchQuery(r).title).toBe("Category Buyer");
  });
  it("links to LinkedIn, Naukri, Indeed and Google Jobs", () => {
    const links = portalSearchLinks({ title: "Procurement Manager", location: "Hyderabad", country: "in" });
    expect(links.map((l) => l.name)).toEqual(["LinkedIn", "Naukri", "Indeed", "Google Jobs"]);
    expect(links[1]!.url).toBe("https://www.naukri.com/procurement-manager-jobs-in-hyderabad");
    expect(links[2]!.url).toContain("in.indeed.com/jobs?q=Procurement%20Manager&l=Hyderabad");
    expect(portalSearchLinks({ title: "Nurse", location: "", country: "gb" }).map((l) => l.name)).not.toContain("Naukri");
  });
  it("filters postings that never mention the role", async () => {
    const { relevantTo, titleKeywords } = await import("../src");
    expect(titleKeywords("Senior Procurement Manager")).toEqual(["procurement"]);
    expect(relevantTo({ title: "Full-Stack Developer", text: "React and Node", url: "u", source: "page", via: "x" }, "Procurement Manager")).toBe(false);
    expect(relevantTo({ title: "Procurement Lead", text: "", url: "u", source: "page", via: "x" }, "Procurement Manager")).toBe(true);
  });
  it("parses sources and dedupes", () => {
    const js = parseSearch("jsearch", { data: [{ job_id: "1", job_title: "Buyer", employer_name: "Acme", job_city: "Pune", job_country: "IN", job_apply_link: "https://x/1", job_description: "Buy things", job_publisher: "LinkedIn" }] });
    expect(js[0]).toMatchObject({ title: "Buyer", via: "LinkedIn via JSearch", location: "Pune, IN" });
    const rm = parseSearch("remotive", { jobs: [{ id: 2, title: "Buyer", company_name: "ACME", url: "https://y/2", description: "<p>Buy</p>" }] });
    expect(dedupeJobs([...js, ...rm])).toHaveLength(1);
    expect(searchUrl("adzuna", { title: "Buyer", location: "Pune", country: "in" }, { adzunaId: "a", adzunaKey: "b" })).toContain("/jobs/in/search/1?app_id=a&app_key=b");
  });
});
