/**
 * Cross-domain skill taxonomy. Each entry is a canonical skill plus aliases.
 * This is a curated starter set covering many professions; it is deliberately
 * domain-neutral and can be extended at runtime via `extraTerms`.
 * A later phase replaces/augments this with ESCO + O*NET exports.
 */
export interface SkillTerm {
  name: string;
  aliases?: string[];
  domain: string;
}

const t = (domain: string, list: (string | [string, ...string[]])[]): SkillTerm[] =>
  list.map((x) => (Array.isArray(x) ? { name: x[0], aliases: x.slice(1), domain } : { name: x, domain }));

export const TAXONOMY: SkillTerm[] = [
  ...t("software", [
    ["JavaScript", "js", "ecmascript"], ["TypeScript", "ts"], "Python", "Java", ["C#", "c sharp", ".net c#"], "C++", ["Go", "golang"],
    "Rust", "Kotlin", "Swift", "PHP", "Ruby", "Scala", ["React", "react.js", "reactjs"], ["React Native"], ["Next.js", "nextjs"],
    ["Angular", "angularjs"], ["Vue", "vue.js", "vuejs"], ["Node.js", "node", "nodejs"], "Express", "Django", "Flask", "FastAPI",
    ["Spring Boot", "spring"], [".NET", "dotnet", "asp.net"], "GraphQL", ["REST", "rest api", "restful", "rest apis"], "gRPC",
    "HTML", "CSS", "Tailwind", "Redux", "Microservices", ["System Design"], "Unit Testing", ["Test Automation", "automated testing"],
    "Selenium", "Cypress", "Playwright", "Jest", "JUnit", ["TDD", "test-driven development"], "Git", ["CI/CD", "ci cd", "continuous integration", "continuous delivery"],
    "Jenkins", ["GitHub Actions"], "Agile", "Scrum", "Kanban", "Jira", ["Object-Oriented Programming", "oop"], "Design Patterns",
    "Android", "iOS", "Flutter", "Linux", "Bash", ["Shell Scripting"],
  ]),
  ...t("cloud", [
    ["AWS", "amazon web services"], ["Azure", "microsoft azure"], ["GCP", "google cloud", "google cloud platform"], "Docker",
    ["Kubernetes", "k8s"], "Terraform", "Ansible", "Helm", "Serverless", ["AWS Lambda", "lambda"], "DevOps", ["SRE", "site reliability"],
    "Prometheus", "Grafana", "Datadog", "Observability", "Networking", ["Cybersecurity", "information security", "infosec"],
    ["IAM", "identity and access management"], "Vercel", "Cloudflare",
  ]),
  ...t("data", [
    "SQL", "PostgreSQL", "MySQL", ["MongoDB", "mongo"], "Redis", "Elasticsearch", "Kafka", ["Apache Spark", "spark", "pyspark"],
    "Airflow", "dbt", "Snowflake", "BigQuery", "Databricks", ["ETL", "elt", "data pipelines"], ["Data Modeling", "data modelling"],
    ["Data Warehousing", "data warehouse"], ["Data Analysis", "data analytics"], ["Machine Learning", "ml"], ["Deep Learning"],
    ["NLP", "natural language processing"], ["LLM", "large language models", "llms", "generative ai", "genai"], "PyTorch", "TensorFlow",
    "scikit-learn", "Pandas", "NumPy", ["Statistics", "statistical analysis"], ["A/B Testing", "ab testing", "experimentation"],
    "Tableau", ["Power BI", "powerbi"], "Looker", "Excel", ["R", "r programming", "rstudio"], "MLOps", ["Computer Vision"],
  ]),
  ...t("product-design", [
    ["Product Management"], ["Product Strategy"], "Roadmapping", ["User Research", "ux research"], ["UX Design", "ux", "user experience"],
    ["UI Design", "ui"], "Figma", "Sketch", ["Adobe Creative Suite", "adobe photoshop", "photoshop", "illustrator"], "Prototyping",
    "Wireframing", ["Design Systems"], "Accessibility", ["Stakeholder Management", "stakeholder engagement"], ["Requirements Gathering"],
    ["Business Analysis"], ["OKRs"], ["KPIs", "kpi"], ["Go-to-Market", "gtm"],
  ]),
  ...t("marketing-sales", [
    ["SEO", "search engine optimization"], ["SEM", "search engine marketing", "ppc"], ["Content Marketing"], ["Social Media Marketing", "social media"],
    ["Email Marketing"], ["Google Analytics", "ga4"], ["Google Ads", "adwords"], ["Marketing Automation"], "HubSpot", ["Salesforce", "sfdc"],
    ["CRM", "customer relationship management"], ["Lead Generation"], ["B2B Sales", "b2b"], ["B2C"], ["Account Management"],
    ["Business Development"], ["Negotiation"], ["Cold Calling"], ["Pipeline Management"], ["Brand Management", "branding"], "Copywriting",
    ["Market Research"], ["Customer Success"], ["Public Relations", "pr"],
  ]),
  ...t("finance", [
    ["Financial Modeling", "financial modelling"], ["Financial Analysis"], ["Budgeting"], ["Forecasting"], ["FP&A", "financial planning and analysis"],
    ["Accounting"], ["Accounts Payable"], ["Accounts Receivable"], ["GAAP", "us gaap"], ["IFRS"], ["Auditing", "audit", "internal audit"],
    ["Tax", "taxation"], ["Payroll"], ["Reconciliation", "account reconciliation"], ["SAP"], ["Oracle"], ["QuickBooks"], ["Tally"],
    ["Risk Management"], ["Compliance", "regulatory compliance"], ["Valuation"], ["Investment Banking"], ["Treasury"], ["Cost Reduction", "cost savings"],
  ]),
  ...t("operations", [
    ["Supply Chain Management", "supply chain"], ["Logistics"], ["Procurement", "purchasing", "sourcing"], "Coupa", ["Ariba", "sap ariba"], ["NetSuite"], ["Vendor Management", "vendor contracts", "supplier management"],
    ["Inventory Management", "inventory"], ["Lean", "lean manufacturing"], ["Six Sigma", "lean six sigma"], ["Process Improvement", "continuous improvement"],
    ["Project Management"], ["Program Management"], ["PMP"], ["Operations Management"], ["Quality Assurance", "qa"], ["Quality Control", "qc"],
    ["ISO 9001", "iso"], ["Health and Safety", "ehs", "osha"], ["ERP"], ["Warehouse Management"], ["Change Management"],
  ]),
  ...t("people", [
    ["Recruiting", "recruitment", "talent acquisition"], ["Onboarding"], ["Employee Relations"], ["Performance Management"],
    ["Compensation and Benefits", "compensation", "benefits administration"], ["HRIS"], "Workday", "ServiceNow", ["Learning and Development", "l&d", "training"],
    ["Coaching", "mentoring"], ["People Management", "team management", "line management"], ["Leadership", "team leadership"],
    ["Hiring"], ["Diversity and Inclusion", "dei"],
  ]),
  ...t("healthcare", [
    ["Patient Care"], ["Electronic Health Records", "ehr", "emr", "electronic medical records"], ["Epic"], ["HIPAA"], ["Clinical Research"],
    ["Medication Administration"], ["Triage"], ["BLS", "basic life support"], ["ACLS"], ["Phlebotomy"], ["Nursing", "registered nurse", "rn"],
    ["Infection Control"], ["Care Planning", "care plans"], ["Medical Coding", "icd-10"], ["Pharmacology"], ["Telehealth"], ["GCP Compliance", "good clinical practice"],
  ]),
  ...t("legal-education", [
    ["Contract Drafting", "contract management", "contracts"], ["Legal Research"], ["Litigation"], ["Due Diligence"], ["Corporate Law"],
    ["Intellectual Property", "ip"], ["GDPR"], ["Curriculum Development"], ["Lesson Planning"], ["Classroom Management"],
    ["Instructional Design"], ["E-Learning", "elearning", "lms"],
  ]),
  ...t("engineering", [
    "AutoCAD", "SolidWorks", "CATIA", "MATLAB", ["CAD"], ["FEA", "finite element analysis"], ["PLC", "plc programming"], ["Embedded Systems"],
    ["Electrical Design"], ["Mechanical Design"], ["Civil Engineering"], ["Structural Analysis"], ["Revit"], ["BIM"], ["GD&T"],
    ["Root Cause Analysis", "rca"], ["Manufacturing"], ["Product Development"],
  ]),
  ...t("general", [
    ["Communication", "communication skills", "verbal communication", "written communication"], ["Problem Solving", "problem-solving"],
    ["Customer Service", "customer support", "client service"], ["Time Management"], ["Teamwork", "collaboration", "cross-functional"],
    ["Critical Thinking"], ["Attention to Detail", "detail-oriented"], ["Presentation", "presentations", "public speaking"],
    ["Microsoft Office", "ms office", "office 365"], ["Data Entry"], ["Report Writing", "reporting"], ["Documentation"],
    ["Strategic Planning", "strategy"], ["Decision Making"], ["Multitasking"], ["Adaptability"], ["English"], ["Hindi"],
  ]),
];

/**
 * Terms that are also everyday words ("go", "lean", "epic"), or are very short,
 * only match when written with their canonical casing.
 */
const CASE_SENSITIVE = new Set(["Go", "R", "Epic", "Lean", "Swift", "Rust", "Express", "Spring Boot", "Oracle", "Tally", "Helm", "Looker", "Tax", "Coaching"]);

export function isCaseSensitive(alias: string, canonical: string): boolean {
  return alias.length <= 2 || (alias === canonical.toLowerCase() && CASE_SENSITIVE.has(canonical));
}

export interface TermIndex {
  /** lowercase alias → canonical name */
  aliasToName: Map<string, string>;
  /** all lowercase aliases sorted longest first (so "react native" wins over "react") */
  aliases: string[];
}

export function buildIndex(extraTerms: string[] = []): TermIndex {
  const aliasToName = new Map<string, string>();
  for (const term of TAXONOMY) {
    for (const a of [term.name, ...(term.aliases ?? [])]) aliasToName.set(a.toLowerCase(), term.name);
  }
  for (const e of extraTerms) {
    const k = e.trim().toLowerCase();
    if (k && !aliasToName.has(k)) aliasToName.set(k, e.trim());
  }
  const aliases = [...aliasToName.keys()].sort((a, b) => b.length - a.length);
  return { aliasToName, aliases };
}
