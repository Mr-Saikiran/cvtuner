import { docLabels, localizeDate, type Resume } from "@cvtuner/core";
import { Document, Font, Link, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { TEMPLATES, type DocStyle, type LayoutOptions, type Theme } from "./options";

// no mid-word hyphenation: it looks odd on a resume and splits keywords that ATS parsers look for
Font.registerHyphenationCallback((word) => [word]);

function styles(o: LayoutOptions, t: Theme) {
  return StyleSheet.create({
    page: { padding: o.margin, fontFamily: t.font, fontSize: o.fontSize, lineHeight: o.lineHeight, color: "#1a1a1a" },
    header: { textAlign: t.align, ...(t.heading === "bar" ? { borderLeftWidth: 4, borderLeftColor: t.accent, paddingLeft: 10 } : {}) },
    name: { fontSize: o.fontSize * 2, fontFamily: t.bold, color: t.accent, lineHeight: 1.1 },
    label: { fontSize: o.fontSize * 1.1, marginTop: 2, color: "#333" },
    contact: { marginTop: 3, fontSize: o.fontSize * 0.92, color: "#444" },
    section: { marginTop: o.gap * 1.4 },
    h2:
      t.heading === "bar"
        ? { fontFamily: t.bold, fontSize: o.fontSize * 1.05, color: t.accent, textTransform: "uppercase", letterSpacing: 0.6, borderLeftWidth: 3, borderLeftColor: t.accent, paddingLeft: 6, marginBottom: o.gap * 0.6 }
        : {
            fontFamily: t.bold, fontSize: o.fontSize * 1.05, color: t.accent, textTransform: "uppercase", letterSpacing: 0.6,
            borderBottomWidth: 0.75, borderBottomColor: t.accent, paddingBottom: 1.5, marginBottom: o.gap * 0.6,
            textAlign: t.align,
          },
    entry: { marginBottom: o.gap * 0.7 },
    row: { flexDirection: "row", justifyContent: "space-between" },
    bold: { fontFamily: t.bold },
    muted: { color: "#555" },
    bullet: { flexDirection: "row", marginTop: 1 },
    dot: { width: o.fontSize * 0.9 },
    bulletText: { flex: 1 },
    para: { marginBottom: o.gap },
  });
}

export function ResumeDocument({ resume, layout, style = {} }: { resume: Resume; layout: LayoutOptions; style?: DocStyle }) {
  const theme = TEMPLATES[style.template ?? "classic"];
  const L = docLabels(style.lang);
  const s = styles(layout, theme);
  const b = resume.basics;
  const contact = [b.email, b.phone, b.location, b.url].filter(Boolean);
  const dates = (a?: string, c?: string) => [localizeDate(a, L), localizeDate(c, L)].filter(Boolean).join(" – ");
  const Bullets = ({ items }: { items: string[] }) => (
    <>
      {items.map((h, i) => (
        <View key={i} style={s.bullet} wrap={false}>
          <Text style={s.dot}>•</Text>
          <Text style={s.bulletText}>{h}</Text>
        </View>
      ))}
    </>
  );
  return (
    <Document title={`${b.name || "Resume"}`} author={b.name} creator="CVTuner" producer="CVTuner">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.name}>{b.name}</Text>
          {b.label ? <Text style={s.label}>{b.label}</Text> : null}
          {contact.length ? (
            <Text style={s.contact}>
              {contact.map((c, i) => (
                <Text key={i}>
                  {i ? "  |  " : ""}
                  {/^https?:|\.com|\.in|\.io/.test(c!) && !c!.includes("@") ? <Link src={c!.startsWith("http") ? c! : `https://${c}`}>{c}</Link> : c}
                </Text>
              ))}
            </Text>
          ) : null}
        </View>

        {b.summary ? (
          <View style={s.section}>
            <Text style={s.h2}>{L.summary}</Text>
            <Text>{b.summary}</Text>
          </View>
        ) : null}

        {resume.skills.some((g) => g.keywords.length) ? (
          <View style={s.section}>
            <Text style={s.h2}>{L.skills}</Text>
            {resume.skills.filter((g) => g.keywords.length).map((g) => (
              <Text key={g.id}>
                {resume.skills.length > 1 ? <Text style={s.bold}>{g.name}: </Text> : null}
                {g.keywords.join(" · ")}
              </Text>
            ))}
          </View>
        ) : null}

        {resume.work.length ? (
          <View style={s.section}>
            <Text style={s.h2}>{L.experience}</Text>
            {resume.work.map((w) => (
              <View key={w.id} style={s.entry}>
                <View style={s.row} wrap={false} minPresenceAhead={30}>
                  <Text>
                    <Text style={s.bold}>{w.position}</Text>
                    {w.name ? <Text>{w.position ? ", " : ""}{w.name}</Text> : null}
                    {w.location ? <Text style={s.muted}>, {w.location}</Text> : null}
                  </Text>
                  <Text style={s.muted}>{dates(w.startDate, w.endDate)}</Text>
                </View>
                {w.summary ? <Text>{w.summary}</Text> : null}
                <Bullets items={w.highlights} />
              </View>
            ))}
          </View>
        ) : null}

        {resume.projects.length ? (
          <View style={s.section}>
            <Text style={s.h2}>{L.projects}</Text>
            {resume.projects.map((p) => (
              <View key={p.id} style={s.entry}>
                <Text style={s.bold}>{p.name}</Text>
                {p.description ? <Text>{p.description}</Text> : null}
                <Bullets items={p.highlights} />
              </View>
            ))}
          </View>
        ) : null}

        {resume.education.length ? (
          <View style={s.section}>
            <Text style={s.h2}>{L.education}</Text>
            {resume.education.map((e) => (
              <View key={e.id} style={[s.row, s.entry]} wrap={false}>
                <Text>
                  <Text style={s.bold}>{[e.studyType, e.area].filter(Boolean).join(", ") || e.institution}</Text>
                  {e.studyType || e.area ? <Text>, {e.institution}</Text> : null}
                  {e.score ? <Text style={s.muted}> ({e.score})</Text> : null}
                </Text>
                <Text style={s.muted}>{dates(e.startDate, e.endDate)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {resume.certificates.length ? (
          <View style={s.section}>
            <Text style={s.h2}>{L.certifications}</Text>
            <Bullets items={resume.certificates} />
          </View>
        ) : null}
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
