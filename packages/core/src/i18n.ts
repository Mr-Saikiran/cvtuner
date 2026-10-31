/** Section headings for the exported documents. Latin-script languages only for now (the bundled PDF fonts). */
export interface DocLabels {
  summary: string;
  skills: string;
  experience: string;
  projects: string;
  education: string;
  certifications: string;
  present: string;
}

export const DOC_LANGUAGES: Record<string, { name: string; labels: DocLabels }> = {
  en: { name: "English", labels: { summary: "Summary", skills: "Skills", experience: "Experience", projects: "Projects", education: "Education", certifications: "Certifications", present: "Present" } },
  es: { name: "Español", labels: { summary: "Perfil", skills: "Habilidades", experience: "Experiencia", projects: "Proyectos", education: "Formación", certifications: "Certificaciones", present: "Actualidad" } },
  fr: { name: "Français", labels: { summary: "Profil", skills: "Compétences", experience: "Expérience", projects: "Projets", education: "Formation", certifications: "Certifications", present: "Aujourd'hui" } },
  de: { name: "Deutsch", labels: { summary: "Profil", skills: "Kenntnisse", experience: "Berufserfahrung", projects: "Projekte", education: "Ausbildung", certifications: "Zertifikate", present: "Heute" } },
  pt: { name: "Português", labels: { summary: "Resumo", skills: "Competências", experience: "Experiência", projects: "Projetos", education: "Formação", certifications: "Certificações", present: "Atual" } },
  it: { name: "Italiano", labels: { summary: "Profilo", skills: "Competenze", experience: "Esperienza", projects: "Progetti", education: "Istruzione", certifications: "Certificazioni", present: "Oggi" } },
  nl: { name: "Nederlands", labels: { summary: "Profiel", skills: "Vaardigheden", experience: "Werkervaring", projects: "Projecten", education: "Opleiding", certifications: "Certificaten", present: "Heden" } },
};

export function docLabels(lang = "en"): DocLabels {
  return (DOC_LANGUAGES[lang] ?? DOC_LANGUAGES.en!).labels;
}

/** Translates "Present"/"Current" end dates for the chosen language. */
export function localizeDate(d: string | undefined, labels: DocLabels): string | undefined {
  return d && /^(present|current|now)$/i.test(d.trim()) ? labels.present : d;
}
