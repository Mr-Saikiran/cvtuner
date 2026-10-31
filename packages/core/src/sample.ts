import { parseResume, type Resume } from "./schema";

export function sampleResume(): Resume {
  return parseResume({
    basics: {
      name: "Asha Rao",
      label: "Operations & Procurement Manager",
      email: "asha.rao@example.com",
      phone: "+91 98765 43210",
      location: "Hyderabad, India",
      url: "linkedin.com/in/asharao",
      summary: "Operations manager with 8 years in procurement, vendor management and process improvement for manufacturing and retail.",
    },
    work: [
      {
        name: "Northwind Retail",
        position: "Procurement Manager",
        location: "Hyderabad",
        startDate: "Apr 2021",
        endDate: "Present",
        highlights: [
          "Led sourcing for 120+ suppliers across packaging and logistics, cutting unit costs by 9%.",
          "Rolled out an SAP purchase-to-pay workflow that reduced approval time from 6 days to 2.",
          "Built a supplier scorecard covering quality, delivery and price used in quarterly reviews.",
          "Negotiated annual contracts worth INR 40 Cr with transport and warehousing partners.",
        ],
      },
      {
        name: "Contoso Manufacturing",
        position: "Operations Analyst",
        location: "Pune",
        startDate: "Jun 2017",
        endDate: "Mar 2021",
        highlights: [
          "Ran Lean Six Sigma projects that removed 14% of scrap on two production lines.",
          "Built Excel and Power BI dashboards for inventory, lead times and OTIF.",
          "Coordinated with finance on monthly budgeting and forecasting for plant spend.",
        ],
      },
    ],
    education: [{ institution: "Osmania University", studyType: "MBA", area: "Operations Management", endDate: "2017" }],
    skills: [
      { name: "Skills", keywords: ["Procurement", "Vendor Management", "Negotiation", "SAP", "Excel", "Power BI", "Lean", "Six Sigma", "Budgeting", "Forecasting", "Inventory Management"] },
    ],
    certificates: ["Lean Six Sigma Green Belt"],
  });
}

export const SAMPLE_JD = `Senior Procurement Lead — Acme Foods

About Acme Foods
We make snacks loved by millions.

What you'll do
- Manage vendor contracts and reduce costs across packaging and raw materials
- Develop, negotiate and maintain supplier agreements in line with company policy
- Partner with finance on budgeting and forecasting for category spend
- Drive process improvement in the purchase-to-pay cycle using SAP
- Build dashboards in Power BI to track supplier performance and KPIs
- Lead a team of 3 buyers and coach them on negotiation

Requirements
- 6+ years in procurement or supply chain management
- Strong negotiation and stakeholder management skills
- Experience with SAP and Excel
- Lean or Six Sigma certification

Nice to have
- Experience with Coupa or Ariba
- Knowledge of ISO 9001

Benefits
- Health insurance and hybrid working`;
