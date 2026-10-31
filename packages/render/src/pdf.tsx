import { docLabels, localizeDate, splitMetrics, type DocLabels, type Resume } from "@cvtuner/core";
import { Document, Font, Image, Link, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
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
      <Heading text={L.skills} t={t} o={o} p={main} />
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
        <View key={w.id} style={s.entry}>
          <View style={s.row} wrap={false} minPresenceAhead={30}>
            <Text style={{ flex: 1 }}>
              <Text style={s.bold}>{w.position}</Text>
              {w.name ? <Text>{w.position ? ", " : ""}{w.name}</Text> : null}
              {w.location ? <Text style={{ color: main.muted }}>, {w.location}</Text> : null}
            </Text>
            <Text style={{ color: main.muted, marginLeft: 8 }}>{dates(w.startDate, w.endDate)}</Text>
          </View>
          {w.summary ? <Text>{w.summary}</Text> : null}
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

  // ---------- single column ----------
  if (!t.sidebar) {
    return (
      <Document title={b.name || "Resume"} author={b.name} creator="CVTuner" producer="CVTuner">
        <Page size="A4" style={[s.page, { padding: o.margin }]}>
          <View style={t.band ? { marginTop: -o.margin, marginHorizontal: -o.margin } : {}}>{header}</View>
          {Summary}
          {SkillsInline}
          {Experience}
          {Projects}
          {EducationMain}
          {CertsMain}
          {LanguagesMain}
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
      {skillGroups.length ? (
        <SideBlock title={L.skills}>
          {skillGroups.flatMap((g) => g.keywords).map((k, i) => (
            <Text key={i} style={{ marginBottom: 1.5 }}>
              {k}
            </Text>
          ))}
        </SideBlock>
      ) : null}
      {resume.languages.length ? (
        <SideBlock title={L.languages}>
          {resume.languages.map((l, i) => (
            <Text key={i}>{l}</Text>
          ))}
        </SideBlock>
      ) : null}
      {resume.education.length ? (
        <SideBlock title={L.education}>
          {resume.education.map((e) => (
            <View key={e.id} style={{ marginBottom: o.gap * 0.6 }} wrap={false}>
              <Text style={s.bold}>{[e.studyType, e.area].filter(Boolean).join(", ") || e.institution}</Text>
              {e.studyType || e.area ? <Text>{e.institution}</Text> : null}
              <Text style={{ color: side.muted }}>{dates(e.startDate, e.endDate)}</Text>
            </View>
          ))}
        </SideBlock>
      ) : null}
      {resume.certificates.length ? (
        <SideBlock title={L.certifications}>
          {resume.certificates.map((c, i) => (
            <Text key={i} style={{ marginBottom: 2 }}>
              {c}
            </Text>
          ))}
        </SideBlock>
      ) : null}
    </View>
  );
  const mainCol = (
    <View style={{ flex: 1, paddingHorizontal: o.margin * 0.8 }}>
      {!t.band ? <View style={{ marginBottom: o.gap * 0.5 }}>{header}</View> : null}
      {Summary}
      {Experience}
      {Projects}
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
            top: 0,
            bottom: 0,
            [sb.side]: 0,
            width: sideW,
            backgroundColor: sb.bg,
            ...(light ? { [sb.side === "right" ? "borderLeftWidth" : "borderRightWidth"]: 0.75, [sb.side === "right" ? "borderLeftColor" : "borderRightColor"]: "#e5e5e5" } : {}),
          }}
        />
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
