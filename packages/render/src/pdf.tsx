import { docLabels, isHidden, localizeDate, sectionOrder, splitMetrics, type CustomSection, type DocLabels, type Resume } from "@cvtuner/core";
import { Defs, Document, Font, Image, LinearGradient, Link, Page, Rect, Stop, StyleSheet, Svg, Text, View, pdf } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { TEMPLATES, type DocStyle, type LayoutOptions, type Theme } from "./options";

// no mid-word hyphenation: it looks odd on a resume and splits keywords that ATS parsers look for
Font.registerHyphenationCallback((word) => [word]);

interface Palette {
  fg: string;
  muted: string;
  accent: string;
}

function makeStyles(o: LayoutOptions, t: Theme) {
  return StyleSheet.create({
    page: { fontFamily: t.font, fontSize: o.fontSize, lineHeight: o.lineHeight, color: "#1a1a1a" },
    name: { fontSize: o.fontSize * 2, fontFamily: t.bold, lineHeight: 1.1 },
    label: { fontSize: o.fontSize * 1.1, marginTop: 2 },
    contact: { marginTop: 3, fontSize: o.fontSize * 0.92 },
    section: { marginTop: o.gap * 1.4 },
    entry: { marginBottom: o.gap * 0.7 },
    row: { flexDirection: "row", justifyContent: "space-between" },
    bold: { fontFamily: t.bold },
    bullet: { flexDirection: "row", marginTop: 1 },
    dot: { width: o.fontSize * 0.9 },
    bulletText: { flex: 1 },
  });
}
type S = ReturnType<typeof makeStyles>;

function Heading({ text, t, o, p, align = t.align }: { text: string; t: Theme; o: LayoutOptions; p: Palette; align?: "left" | "center" }) {
  const base = { fontFamily: t.bold, fontSize: o.fontSize * 1.05, color: p.accent, textTransform: "uppercase" as const, letterSpacing: 0.6, marginBottom: o.gap * 0.6, textAlign: align };
  if (t.heading === "bar") return <Text style={{ ...base, borderLeftWidth: 3, borderLeftColor: p.accent, paddingLeft: 6 }}>{text}</Text>;
  if (t.heading === "plain") return <Text style={{ ...base, textTransform: "none", fontSize: o.fontSize * 1.2, letterSpacing: 0 }}>{text}</Text>;
  return <Text style={{ ...base, borderBottomWidth: 0.75, borderBottomColor: p.accent, paddingBottom: 1.5 }}>{text}</Text>;
}

function Bullets({ items, s, boldMetrics }: { items: string[]; s: S; boldMetrics: boolean }) {
  return (
    <>
      {items.map((h, i) => (
        <View key={i} style={s.bullet} wrap={false}>
          <Text style={s.dot}>•</Text>
          <Text style={s.bulletText}>
            {boldMetrics
              ? splitMetrics(h).map((r, j) =>
                  r.bold ? (
                    <Text key={j} style={s.bold}>
                      {r.text}
                    </Text>
                  ) : (
                    r.text
                  ),
                )
              : h}
          </Text>
        </View>
      ))}
    </>
  );
}

/** A gradient fill behind a block (react-pdf Views take only flat colours). */
function GradientFill({ id, from, to, vertical, width, height }: { id: string; from: string; to: string; vertical?: boolean; width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2={vertical ? "0" : "1"} y2={vertical ? "1" : "0"}>
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill={`url(#${id})`} />
    </Svg>
  );
}

/** Sections that belong in the main column of sidebar templates. */
const MAIN_IDS = new Set(["summary", "experience", "projects"]);

const contactLines = (r: Resume) => [r.basics.email, r.basics.phone, r.basics.location, r.basics.url].filter((x): x is string => !!x);
const isLink = (c: string) => /^https?:|\.com|\.in|\.io/.test(c) && !c.includes("@");
const href = (c: string) => (c.startsWith("http") ? c : `https://${c}`);

export function ResumeDocument({ resume, layout: o, style = {} }: { resume: Resume; layout: LayoutOptions; style?: DocStyle }) {
  const t = TEMPLATES[style.template ?? "classic"] ?? TEMPLATES.classic;
  const L = docLabels(style.lang);
  const s = makeStyles(o, t);
  const boldMetrics = style.boldMetrics !== false;
  const b = resume.basics;
  const main: Palette = { fg: "#1a1a1a", muted: "#555", accent: t.accent };
  const side: Palette = t.sidebar ? { fg: t.sidebar.fg, muted: t.sidebar.fg === "#ffffff" ? "#c9d6ea" : "#555", accent: t.sidebar.accent } : main;
  const dates = (a?: string, c?: string) => [localizeDate(a, L), localizeDate(c, L)].filter(Boolean).join(" – ");
  const photo = t.photo && b.image ? b.image : undefined;
  const sideW = t.sidebar?.width ?? 0;
  const contact = contactLines(resume);

  // ---------- header ----------
  const nameColor = t.band ? t.band.fg : (t.nameColor ?? t.accent);
  const headerText = (
    <View style={{ flex: 1, textAlign: t.align }}>
      <Text style={[s.name, { color: nameColor }]}>{b.name}</Text>
      {b.label ? <Text style={[s.label, { color: t.band ? t.band.fg : "#333" }]}>{b.label}</Text> : null}
      {!t.contactRight && !t.sidebar && contact.length ? (
        <Text style={[s.contact, { color: t.band ? t.band.fg : "#444" }]}>
          {contact.map((c, i) => (
            <Text key={i}>
              {i ? "  |  " : ""}
              {isLink(c) ? <Link src={href(c)}>{c}</Link> : c}
            </Text>
          ))}
        </Text>
      ) : null}
    </View>
  );
  const rightContact =
    t.contactRight && !t.sidebar ? (
      <View style={{ width: 190, textAlign: "right", fontSize: o.fontSize * 0.9, color: t.band ? t.band.fg : t.accent }}>
        {contact.map((c, i) => (
          <Text key={i}>{isLink(c) ? <Link src={href(c)}>{c}</Link> : c}</Text>
        ))}
      </View>
    ) : null;
  const photoEl = photo ? <Image src={photo} style={{ width: 64, height: 64, borderRadius: 32, marginRight: 12, objectFit: "cover" }} /> : null;
  const header = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        ...(t.band
          ? { backgroundColor: t.band.bg, paddingVertical: o.margin * 0.55, paddingHorizontal: o.margin, marginBottom: o.gap }
          : t.heading === "bar"
            ? { borderLeftWidth: 4, borderLeftColor: t.accent, paddingLeft: 10 }
            : {}),
      }}
    >
      {photoEl}
      {headerText}
      {rightContact}
    </View>
  );

  // a gradient plate at the top of the main column holding name, title and summary (Spectrum)
  const bandedMainHeader = t.mainBand ? (
    <View style={{ marginTop: -o.margin * 0.4, marginRight: -o.margin * 0.8, padding: o.margin * 0.55, paddingRight: o.margin * 0.8, color: "#ffffff", overflow: "hidden" }}>
      <GradientFill id="band" from={t.mainBand[0]} to={t.mainBand[1]} width={600} height={400} />
      {/* text sits in its own view so the gradient layer never takes part in line layout */}
      <View>
        <Text style={[s.name, { color: "#ffffff", letterSpacing: 1.5, textTransform: "uppercase" }]}>{b.name}</Text>
        {b.label ? <Text style={{ fontSize: o.fontSize * 1.1, letterSpacing: 2.2, marginTop: 3 }}>{b.label}</Text> : null}
        {b.summary && !isHidden(resume, "summary") ? <Text style={{ marginTop: o.gap, fontSize: o.fontSize, lineHeight: o.lineHeight }}>{b.summary}</Text> : null}
      </View>
    </View>
  ) : null;

  // ---------- sections ----------
  const Summary = b.summary ? (
    <View style={s.section}>
      <Heading text={L.summary} t={t} o={o} p={main} />
      <Text>{b.summary}</Text>
    </View>
  ) : null;

  const skillGroups = resume.skills.filter((g) => g.keywords.length);
  const SkillsInline = skillGroups.length ? (
    <View style={s.section}>
      <Heading text={skillGroups.length === 1 && skillGroups[0]!.name !== "Skills" ? skillGroups[0]!.name : L.skills} t={t} o={o} p={main} />
      {skillGroups.map((g) => (
        <Text key={g.id}>
          {skillGroups.length > 1 ? <Text style={s.bold}>{g.name}: </Text> : null}
          {g.keywords.join(" · ")}
        </Text>
      ))}
    </View>
  ) : null;

  const Experience = resume.work.length ? (
    <View style={s.section}>
      <Heading text={L.experience} t={t} o={o} p={main} />
      {resume.work.map((w) => (
        <View key={w.id} style={[s.entry, t.timeline ? { borderLeftWidth: 1, borderLeftColor: t.accent, paddingLeft: 12, marginLeft: 3 } : {}]}>
          {t.timeline ? <View style={{ position: "absolute", left: -4.5, top: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: t.accent }} /> : null}
          <View style={s.row} wrap={false} minPresenceAhead={30}>
            <Text style={{ flex: 1 }}>
              <Text style={s.bold}>{w.position}</Text>
              {w.name ? <Text>{w.position ? ", " : ""}{w.name}</Text> : null}
              {w.location ? <Text style={{ color: main.muted }}>, {w.location}</Text> : null}
            </Text>
            <Text style={{ color: main.muted, marginLeft: 8 }}>{dates(w.startDate, w.endDate)}</Text>
          </View>
          {w.summary ? <Text style={{ color: main.muted }}>{w.summary}</Text> : null}
          <Bullets items={w.highlights} s={s} boldMetrics={boldMetrics} />
        </View>
      ))}
    </View>
  ) : null;

  const Projects = resume.projects.length ? (
    <View style={s.section}>
      <Heading text={L.projects} t={t} o={o} p={main} />
      {resume.projects.map((p) => (
        <View key={p.id} style={s.entry}>
          <Text style={s.bold}>{p.name}</Text>
          {p.description ? <Text>{p.description}</Text> : null}
          <Bullets items={p.highlights} s={s} boldMetrics={boldMetrics} />
        </View>
      ))}
    </View>
  ) : null;

  const EducationMain = resume.education.length ? (
    <View style={s.section}>
      <Heading text={L.education} t={t} o={o} p={main} />
      {resume.education.map((e) => (
        <View key={e.id} style={[s.row, s.entry]} wrap={false}>
          <Text style={{ flex: 1 }}>
            <Text style={s.bold}>{[e.studyType, e.area].filter(Boolean).join(", ") || e.institution}</Text>
            {e.studyType || e.area ? <Text>, {e.institution}</Text> : null}
            {e.score ? <Text style={{ color: main.muted }}> ({e.score})</Text> : null}
            {e.note ? <Text style={{ color: main.muted }}>. {e.note}</Text> : null}
          </Text>
          <Text style={{ color: main.muted, marginLeft: 8 }}>{dates(e.startDate, e.endDate)}</Text>
        </View>
      ))}
    </View>
  ) : null;

  const CertsMain = resume.certificates.length ? (
    <View style={s.section}>
      <Heading text={L.certifications} t={t} o={o} p={main} />
      <Bullets items={resume.certificates} s={s} boldMetrics={false} />
    </View>
  ) : null;

  const LanguagesMain = resume.languages.length ? (
    <View style={s.section}>
      <Heading text={L.languages} t={t} o={o} p={main} />
      <Text>{resume.languages.join(" · ")}</Text>
    </View>
  ) : null;

  const CustomMain = (c: CustomSection) =>
    c.items.length || c.text ? (
      <View style={s.section}>
        <Heading text={c.title} t={t} o={o} p={main} />
        {c.kind === "text" ? <Text>{c.text}</Text> : <Bullets items={c.items} s={s} boldMetrics={false} />}
      </View>
    ) : null;

  const order = sectionOrder(resume).filter((id) => !isHidden(resume, id));
  const customOf = (id: string) => resume.custom.find((c) => c.id === id);
  const mainSection = (id: string): ReactNode => {
    switch (id) {
      case "summary":
        // the banded header of some templates already carries the summary
        return t.summaryInHeader ? null : Summary;
      case "skills":
        return SkillsInline;
      case "experience":
        return Experience;
      case "projects":
        return Projects;
      case "education":
        return EducationMain;
      case "certifications":
        return CertsMain;
      case "languages":
        return LanguagesMain;
      default: {
        const c = customOf(id);
        return c ? CustomMain(c) : null;
      }
    }
  };

  // ---------- single column ----------
  if (!t.sidebar) {
    return (
      <Document title={b.name || "Resume"} author={b.name} creator="CVTuner" producer="CVTuner">
        <Page size="A4" style={[s.page, { padding: o.margin }]}>
          <View style={t.band ? { marginTop: -o.margin, marginHorizontal: -o.margin } : {}}>{header}</View>
          {order.map((id) => <View key={id}>{mainSection(id)}</View>)}
        </Page>
      </Document>
    );
  }

  // ---------- sidebar layouts ----------
  const sb = t.sidebar;
  const SideBlock = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ marginBottom: o.gap * 1.6 }}>
      <Text style={{ fontFamily: t.bold, fontSize: o.fontSize * 1.05, color: side.accent, marginBottom: o.gap * 0.5, textTransform: "uppercase", letterSpacing: 0.6 }}>{title}</Text>
      {children}
    </View>
  );
  const sideSection = (id: string): ReactNode => {
    switch (id) {
      case "skills":
        return skillGroups.map((g) => (
          <SideBlock key={g.id} title={skillGroups.length === 1 && g.name === "Skills" ? L.skills : g.name}>
            {/* comma lists read better than one skill per line once there are many */}
            {g.keywords.length > 10 ? (
              <Text>{g.keywords.join(", ")}</Text>
            ) : (
              g.keywords.map((k, i) => (
                <Text key={i} style={{ marginBottom: 1.5 }}>
                  {k}
                </Text>
              ))
            )}
          </SideBlock>
        ));
      case "languages":
        return resume.languages.length ? (
          <SideBlock title={L.languages}>
            {resume.languages.map((l, i) => (
              <Text key={i}>{l}</Text>
            ))}
          </SideBlock>
        ) : null;
      case "education":
        return resume.education.length ? (
          <SideBlock title={L.education}>
            {resume.education.map((e) => (
              <View key={e.id} style={{ marginBottom: o.gap * 0.6 }} wrap={false}>
                <Text style={s.bold}>{[e.studyType, e.area].filter(Boolean).join(", ") || e.institution}</Text>
                {e.studyType || e.area ? <Text>{e.institution}</Text> : null}
                {e.note ? <Text style={{ color: side.muted }}>{e.note}</Text> : null}
                {e.startDate || e.endDate ? <Text style={{ color: side.muted }}>{dates(e.startDate, e.endDate)}</Text> : null}
              </View>
            ))}
          </SideBlock>
        ) : null;
      case "certifications":
        return resume.certificates.length ? (
          <SideBlock title={L.certifications}>
            {resume.certificates.map((c, i) => (
              <Text key={i} style={[s.bold, { marginBottom: 2 }]}>
                {c}
              </Text>
            ))}
          </SideBlock>
        ) : null;
      default: {
        const c = customOf(id);
        if (!c || (!c.items.length && !c.text)) return null;
        return (
          <SideBlock title={c.title}>
            {c.kind === "text" ? (
              <Text>{c.text}</Text>
            ) : (
              c.items.map((it, i) => (
                <Text key={i} style={{ marginBottom: 2 }}>
                  {it}
                </Text>
              ))
            )}
          </SideBlock>
        );
      }
    }
  };
  const inMain = (id: string) => MAIN_IDS.has(id) || customOf(id)?.placement === "main";
  const sidebar = (
    <View style={{ width: sideW, paddingHorizontal: 16, paddingTop: t.band ? 4 : 0, color: side.fg, fontSize: o.fontSize * 0.95 }}>
      {contact.length ? (
        <SideBlock title={L.contact}>
          {contact.map((c, i) => (
            <Text key={i} style={{ marginBottom: 2 }}>
              {isLink(c) ? (
                <Link src={href(c)} style={{ color: side.fg }}>
                  {c}
                </Link>
              ) : (
                c
              )}
            </Text>
          ))}
        </SideBlock>
      ) : null}
      {order.filter((id) => !inMain(id)).map((id) => (
        <View key={id}>{sideSection(id)}</View>
      ))}
    </View>
  );
  const mainCol = (
    <View style={{ flex: 1, paddingHorizontal: o.margin * 0.8 }}>
      {!t.band ? <View style={{ marginBottom: o.gap * 0.5 }}>{t.mainBand ? bandedMainHeader : header}</View> : null}
      {order.filter(inMain).map((id) => (
        <View key={id}>{mainSection(id)}</View>
      ))}
    </View>
  );
  const light = sb.bg.toLowerCase() === "#ffffff";
  return (
    <Document title={b.name || "Resume"} author={b.name} creator="CVTuner" producer="CVTuner">
      <Page size="A4" style={[s.page, { paddingVertical: o.margin }]}>
        {/* sidebar background, repeated on every page */}
        <View
          fixed
          style={{
            position: "absolute",
            overflow: "hidden",
            top: 0,
            bottom: 0,
            [sb.side]: 0,
            width: sideW,
            backgroundColor: sb.gradient ? sb.gradient[1] : sb.bg,
            ...(light ? { [sb.side === "right" ? "borderLeftWidth" : "borderRightWidth"]: 0.75, [sb.side === "right" ? "borderLeftColor" : "borderRightColor"]: "#e5e5e5" } : {}),
          }}
        >
          {sb.gradient ? <GradientFill id="side" from={sb.gradient[0]} to={sb.gradient[1]} vertical width={sideW} height={842} /> : null}
        </View>
        {t.band ? <View style={{ marginTop: -o.margin }}>{header}</View> : null}
        <View style={{ flexDirection: sb.side === "left" ? "row" : "row-reverse" }}>
          {sidebar}
          {mainCol}
        </View>
      </Page>
    </Document>
  );
}

/** Renders to PDF bytes. Works in the browser and in Node. */
export async function renderPdf(resume: Resume, layout: LayoutOptions, style?: DocStyle): Promise<Uint8Array> {
  const blob = await pdf(<ResumeDocument resume={resume} layout={layout} style={style} />).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

/** Counts pages without a PDF parser: react-pdf (pdfkit) writes one "/Type /Page" object per page. */
export function countPdfPages(bytes: Uint8Array): number {
  const text = new TextDecoder("latin1").decode(bytes);
  return (text.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
}

export type { DocLabels };
