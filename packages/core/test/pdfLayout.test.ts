import { describe, expect, it } from "vitest";
import { layoutPdfText, parseResumeText, type PdfItem } from "../src";

/** A synthetic two-column page: a sidebar on the left, the name and experience on the right. */
function page(): { width: number; items: PdfItem[] } {
  const items: PdfItem[] = [];
  const add = (str: string, x: number, y: number, h = 9.5, w = str.length * 4.6) => items.push({ str, x, y, w, h });
  // main column
  add("JANE DOE", 230, 790, 30, 180);
  add("S e n i o r", 230, 765, 12, 50);
  add("D a t a", 290, 765, 12, 35);
  add("A n a l y s t", 335, 765, 12, 60);
  add("Experience", 230, 700, 16, 90);
  add("Jan 2020 - Present", 230, 680, 10);
  add("Globex Corp | Clients - Acme, Initech", 230, 667, 10);
  add("Lead Data Analyst", 230, 654, 12);
  add("Built SQL pipelines for finance reporting across five regional", 245, 635, 9.5, 300);
  add("teams, cutting month-end close by 3 days.", 245, 622, 9.5, 190);
  add("Automated Tableau dashboards for the sales leadership team", 245, 609, 9.5, 290);
  // sidebar
  add("jane.doe@example.com", 30, 780, 9);
  add("SKILLS", 30, 700, 16, 60);
  add("SQL, Python, Tableau, Data", 30, 680, 9, 150);
  add("Modelling, Excel", 30, 668, 9, 80);
  add("EDUCATION", 30, 640, 16, 90);
  add("BSc Statistics", 30, 620, 9.8);
  add("State University", 30, 607, 9);
  add("ACHIEVEMENTS", 30, 580, 16, 110);
  add("Analyst of the Year 2023", 30, 560, 9);
  return { width: 595, items };
}

describe("layout-aware PDF text", () => {
  const text = layoutPdfText([page()]);
  it("reads the main column first, rejoins letter-spaced words and wrapped bullets", () => {
    const lines = text.split("\n");
    expect(lines[0]).toBe("JANE DOE");
    expect(lines[1]).toBe("Senior Data Analyst");
    expect(text).toContain("Built SQL pipelines for finance reporting across five regional teams, cutting month-end close by 3 days.");
    expect(text).toContain("SQL, Python, Tableau, Data Modelling, Excel");
    // the sidebar is never glued onto main-column lines
    expect(lines.every((l) => !(l.includes("SKILLS") && l.includes("Experience")))).toBe(true);
  });
  it("parses the rebuilt text into sections", () => {
    const r = parseResumeText(text);
    expect(r.basics).toMatchObject({ name: "Jane Doe", label: "Senior Data Analyst", email: "jane.doe@example.com" });
    expect(r.work[0]).toMatchObject({ position: "Lead Data Analyst", name: "Globex Corp", summary: "Clients: Acme, Initech", startDate: "Jan 2020", endDate: "Present" });
    expect(r.work[0]!.highlights).toHaveLength(2);
    expect(r.skills[0]!.keywords).toEqual(["SQL", "Python", "Tableau", "Data Modelling", "Excel"]);
    expect(r.education[0]).toMatchObject({ studyType: "BSc", area: "Statistics", institution: "State University" });
    expect(r.custom[0]).toMatchObject({ title: "Achievements", kind: "list", placement: "side", items: ["Analyst of the Year 2023"] });
  });
});
