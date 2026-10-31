import { describe, expect, it } from "vitest";
import { frameSentence, toActionPhrase } from "../src/voice";

describe("toActionPhrase", () => {
  it.each([
    ["You will be responsible for managing vendor contracts.", "manage vendor contracts"],
    ["Design and build scalable REST APIs for our customers", "design and build scalable REST APIs for the customers"],
    ["Manages daily patient care plans", "manage daily patient care plans"],
    ["5+ years of experience with Python", null],
    ["Experience with SAP is a plus", null],
  ])("%s", (input, expected) => {
    expect(toActionPhrase(input)).toBe(expected);
  });
});

describe("frameSentence", () => {
  const cases: [string, string, string][] = [
    ["manage vendor contracts and reduce costs", "Vendor contracts were managed, and costs were reduced.", "Managed vendor contracts and reduced costs."],
    ["design and build scalable REST APIs for internal teams", "Scalable REST APIs were designed and built for internal teams.", "Designed and built scalable REST APIs for internal teams."],
    ["develop, test and deploy features", "Features were developed, tested and deployed.", "Developed, tested and deployed features."],
    ["write technical documentation", "Technical documentation was written.", "Wrote technical documentation."],
    ["collaborate with stakeholders to define the roadmap", "Collaboration was carried out with stakeholders to define the roadmap.", "Collaborated with stakeholders to define the roadmap."],
    ["lead a team of 3 buyers and coach them on negotiation", "A team of 3 buyers was led, and they were coached on negotiation.", "Led a team of 3 buyers and coached them on negotiation."],
    ["ensure the quality of products", "The quality of products was ensured.", "Ensured the quality of products."],
    ["oversee the monthly budget", "The monthly budget was overseen.", "Oversaw the monthly budget."],
  ];
  it.each(cases)("%s", (phrase, passive, active) => {
    expect(frameSentence(phrase, "passive")).toBe(passive);
    expect(frameSentence(phrase, "active")).toBe(active);
  });
});
