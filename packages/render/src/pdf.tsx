import type { Resume } from "@cvtuner/core";
import { Document, Font, Link, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import type { LayoutOptions } from "./options";

const ACCENT = "#1f3a5f";

// no mid-word hyphenation: it looks odd on a resume and splits keywords that ATS parsers look for
Font.registerHyphenationCallback((word) => [word]);

function styles(o: LayoutOptions) {
  return StyleSheet.create({
    page: { padding: o.margin, fontFamily: "Helvetica", fontSize: o.fontSize, lineHeight: o.lineHeight, color: "#1a1a1a" },
    name: { fontSize: o.fontSize * 2, fontFamily: "Helvetica-Bold", color: ACCENT, lineHeight: 1.1 },
    label: { fontSize: o.fontSize * 1.1, marginTop: 2, color: "#333" },
    contact: { marginTop: 3, fontSize: o.fontSize * 0.92, color: "#444" },
    section: { marginTop: o.gap * 1.4 },
    h2: {
      fontFamily: "Helvetica-Bold", fontSize: o.fontSize * 1.05, color: ACCENT, textTransform: "uppercase",
      letterSpacing: 0.6, borderBottomWidth: 0.75, borderBottomColor: ACCENT, paddingBottom: 1.5, marginBottom: o.gap * 0.6,
    },
    entry: { marginBottom: o.gap * 0.7 },
    row: { flexDirection: "row", justifyContent: "space-between" },
    bold: { fontFamily: "Helvetica-Bold" },
    muted: { color: "#555" },
    bullet: { flexDirection: "row", marginTop: 1 },
    dot: { width: o.fontSize * 0.9 },
    bulletText: { flex: 1 },
  });
}

const dates = (a?: string, b?: string) => [a, b].filter(Boolean).join(" – ");

export function ResumeDocument({ resume, layout }: { resume: Resume; layout: LayoutOptions }) {
  const s = styles(layout);
  const b = resume.basics;
  const contact = [b.email, b.phone, b.location, b.url].filter(Boolean);
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

        {b.summary ? (
          <View style={s.section}>
            <Text style={s.h2}>Summary</Text>
            <Text>{b.summary}</Text>
          </View>
        ) : null}

        {resume.skills.some((g) => g.keywords.length) ? (
          <View style={s.section}>
            <Text style={s.h2}>Skills</Text>
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
            <Text style={s.h2}>Experience</Text>
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
            <Text style={s.h2}>Projects</Text>
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
            <Text style={s.h2}>Education</Text>
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
            <Text style={s.h2}>Certifications</Text>
            <Bullets items={resume.certificates} />
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

/** Renders to PDF bytes. Works in the browser and in Node. */
export async function renderPdf(resume: Resume, layout: LayoutOptions): Promise<Uint8Array> {
  const blob = await pdf(<ResumeDocument resume={resume} layout={layout} />).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

/** Counts pages without a PDF parser: react-pdf (pdfkit) writes one "/Type /Page" object per page. */
export function countPdfPages(bytes: Uint8Array): number {
  const text = new TextDecoder("latin1").decode(bytes);
  return (text.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
}
