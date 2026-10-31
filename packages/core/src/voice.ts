import nlp from "compromise";
import { capitalize } from "./text";

export type Voice = "passive" | "active";

/** Past participles that differ from the simple past tense. */
const IRREGULAR_PARTICIPLE: Record<string, string> = {
  write: "written", rewrite: "rewritten", drive: "driven", take: "taken", undertake: "undertaken", give: "given",
  grow: "grown", show: "shown", begin: "begun", choose: "chosen", do: "done", see: "seen", oversee: "overseen",
  speak: "spoken", break: "broken", run: "run", know: "known", draw: "drawn", become: "become", go: "gone",
  forget: "forgotten", rise: "risen", throw: "thrown", wear: "worn", hide: "hidden", ride: "ridden", fly: "flown",
  overtake: "overtaken", forgive: "forgiven", redraw: "redrawn", mistake: "mistaken", shake: "shaken", steal: "stolen",
};

/**
 * Verbs that take no direct object, so "X was <verb>ed" is impossible.
 * Each maps to a noun-led passive frame; `{rest}` is the remainder of the phrase.
 */
const INTRANSITIVE: Record<string, string> = {
  work: "Work was carried out {rest}",
  collaborate: "Collaboration was carried out {rest}",
  partner: "Partnerships were formed {rest}",
  liaise: "Liaison was maintained {rest}",
  communicate: "Communication was maintained {rest}",
  engage: "Engagement was maintained {rest}",
  contribute: "Contributions were made {rest}",
  participate: "Participation was provided {rest}",
  report: "Reporting was provided {rest}",
  travel: "Travel was undertaken {rest}",
  interact: "Interaction was maintained {rest}",
  respond: "Responses were provided {rest}",
  advocate: "Advocacy was provided {rest}",
  focus: "Focus was placed {rest}",
  thrive: "Results were delivered {rest}",
};

const PREFIXES: RegExp[] = [
  /^(you will|you'll|you would|you are expected to|we expect you to|the candidate will|the successful candidate will|candidates? will|the role will|this role will|you'll be expected to|you will be expected to)\s+/i,
  /^(be responsible for|responsible for|responsibilities include|accountable for|in charge of|tasked with)\s+/i,
  /^(help|helping|assist|assisting) (to )?(?=\w+\s)/i,
  /^(ability to|able to|willingness to|you can|you know how to)\s+/i,
];

/** Phrases that state a requirement, not an action — they cannot become a resume bullet. */
const NON_ACTION = /^(experience|knowledge|understanding|familiarity|proficiency|degree|bachelor|master|\d+\+?\s*years?|strong|excellent|proven|solid|deep|good|great|demonstrated|track record|exposure|background|certification|certified|fluency|fluent|a |an |must|preferred|nice|bonus|we |our |you are|you have|is |are )/i;

const firstWord = (s: string) => s.split(/\s+/)[0] ?? "";

interface Conj {
  Infinitive: string;
  PastTense?: string;
  Gerund?: string;
}

function conjugate(word: string): Conj | null {
  const c = nlp(word).verbs().conjugate()[0] as Conj | undefined;
  return c && c.Infinitive ? c : null;
}

function isVerbStart(phrase: string): boolean {
  const doc = nlp(phrase);
  if (doc.match("^#Verb").found) return true;
  // compromise sometimes tags imperative "own", "drive", "lead" as nouns/adjectives at the start
  const w = firstWord(phrase).toLowerCase();
  return /^(own|lead|drive|design|build|plan|scope|champion|mentor|pilot|staff|chair|model|map|test|audit|budget|forecast|source|market|partner|host|code|ship|launch|shape|spearhead|steer|coach|author|draft|triage|script|program|price|file|chart|index|track|benchmark|document|support|service|host|process)$/.test(w);
}

/**
 * Normalises a JD line into an imperative action phrase:
 * "You will be responsible for managing vendor contracts." → "manage vendor contracts".
 * Returns null when the line is a requirement ("5+ years of Python") rather than an action.
 */
export function toActionPhrase(line: string): string | null {
  let s = line.trim().replace(/[.;:!]+$/, "").replace(/\s+/g, " ");
  // keep the first clause only — long JD sentences make poor bullets
  s = s.split(/(?<=\w)[.;]\s|\s[–—]\s|\s\(/)[0]!.trim();
  for (let i = 0; i < 3; i++) for (const re of PREFIXES) s = s.replace(re, "");
  s = s.replace(/^(be )?(actively |closely |directly )?/i, "");
  if (!s || NON_ACTION.test(s)) return null;

  // gerund → infinitive ("managing" → "manage"); also third person ("manages" → "manage")
  const w = firstWord(s);
  if (/ing$|s$/i.test(w)) {
    const c = conjugate(w);
    if (c && c.Infinitive.toLowerCase() !== w.toLowerCase()) s = c.Infinitive + s.slice(w.length);
  }
  if (!isVerbStart(s)) return null;
  const words = s.split(" ");
  if (words.length < 2) return null;
  if (words.length > 22) s = words.slice(0, 22).join(" ");
  s = s
    .replace(/\b(our|your|their)\b/gi, "the")
    .replace(/\b(you|we)\b\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function participle(verb: string): string {
  const c = conjugate(verb);
  const inf = (c?.Infinitive ?? verb).toLowerCase();
  if (IRREGULAR_PARTICIPLE[inf]) return IRREGULAR_PARTICIPLE[inf]!;
  if (c?.PastTense) return c.PastTense;
  return /e$/.test(inf) ? `${inf}d` : `${inf}ed`;
}

function pastTense(verb: string): string {
  return conjugate(verb)?.PastTense ?? (/e$/.test(verb) ? `${verb}d` : `${verb}ed`);
}

/** Splits "develop, test and deploy features and reduce costs" into verb groups sharing an object. */
interface Clause {
  verbs: string[];
  object: string;
}

function splitClauses(phrase: string): Clause[] {
  const parts = phrase.split(/,\s*(?:and\s+)?|\s+and\s+|\s+&\s+/);
  const clauses: Clause[] = [];
  let pendingVerbs: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!.trim();
    if (!part) continue;
    const startsWithVerb = isVerbStart(part) && conjugate(firstWord(part)) !== null;
    if (!startsWithVerb) {
      // a noun list item, e.g. "manage budgets, schedules and vendors" — glue back to the previous object
      const last = clauses[clauses.length - 1];
      if (last && pendingVerbs.length === 0) {
        last.object += (i === parts.length - 1 ? " and " : ", ") + part;
        continue;
      }
      if (pendingVerbs.length) {
        clauses.push({ verbs: pendingVerbs, object: part });
        pendingVerbs = [];
        continue;
      }
      return [{ verbs: [firstWord(phrase)], object: phrase.slice(firstWord(phrase).length).trim() }];
    }
    const [verb, ...rest] = part.split(" ");
    const object = rest.join(" ").trim();
    if (!object) pendingVerbs.push(verb!);
    else {
      clauses.push({ verbs: [...pendingVerbs, verb!], object });
      pendingVerbs = [];
    }
  }
  if (pendingVerbs.length && clauses.length) clauses[clauses.length - 1]!.verbs.push(...pendingVerbs);
  return clauses;
}

const joinList = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** Where the object noun phrase ends and the adverbial tail ("for clients", "to cut costs") begins. */
const TAIL = /\s+(?=(for|to|with|across|within|into|through|by|using|via|in order to|on|at|from|under|so that|while|ensuring)\b)/i;

function isPlural(nounPhrase: string): boolean {
  let head = nounPhrase.split(TAIL)[0]!.trim();
  if (/^(a|an|one|each|every|the whole)\s/i.test(head)) return false;
  if (/^(they|these|those|both|all|many|several|multiple|various)\b/i.test(head)) return true;
  if (/^(it|this|that|he|she)\b/i.test(head)) return false;
  // "the quality of products" — the head noun comes before "of"
  head = head.split(/\s+of\s+/i)[0]!;
  if (/\b(and|&)\b|,/.test(head)) return true;
  const nouns = nlp(head).nouns();
  if (nouns.found) return (nouns.last() as unknown as { isPlural(): { found: boolean } }).isPlural().found;
  return /s$/i.test(head.split(" ").pop() ?? "");
}

/** Object pronouns become subjects in the passive: "coach them" → "they were coached". */
const SUBJECT_PRONOUN: Record<string, string> = { them: "they", him: "he", her: "she", us: "we", me: "I" };

function passiveClause(c: Clause): string {
  const main = c.verbs[0]!.toLowerCase();
  const inf = conjugate(main)?.Infinitive.toLowerCase() ?? main;
  if (INTRANSITIVE[inf] && c.verbs.length === 1) return INTRANSITIVE[inf]!.replace("{rest}", c.object).trim();
  if (/^(with|on|to|closely|alongside|across|in|into|towards?)\b/i.test(c.object)) {
    return `Work was carried out to ${c.verbs.join(" and ")} ${c.object}`;
  }
  const object = c.object.replace(/^(them|him|her|us|me)\b/i, (p) => SUBJECT_PRONOUN[p.toLowerCase()]!);
  const be = isPlural(object) ? "were" : "was";
  const participles = joinList(c.verbs.map(participle));
  const [head, ...tail] = object.split(TAIL);
  const tailText = tail.length ? " " + object.slice(head!.length).trim() : "";
  return `${capitalize(head!)} ${be} ${participles}${tailText}`;
}

/**
 * Frames an action phrase as a resume sentence.
 * passive: "manage vendor contracts and reduce costs" → "Vendor contracts were managed and costs were reduced."
 * active:  → "Managed vendor contracts and reduced costs."
 */
export function frameSentence(phrase: string, voice: Voice = "passive", context?: string): string {
  const clauses = splitClauses(phrase);
  let sentence: string;
  if (voice === "active") {
    // one subject ("I", implied) with a compound predicate — no comma before "and"
    sentence = capitalize(
      joinList(clauses.map((c) => `${joinList(c.verbs.map(pastTense))} ${c.object}`.trim())),
    );
  } else {
    sentence = clauses
      .map((c, i) => {
        const p = passiveClause(c);
        return i === 0 ? p : p.charAt(0).toLowerCase() + p.slice(1);
      })
      .join(", and ");
  }
  if (context) sentence += ` ${context}`;
  return sentence.replace(/\s+/g, " ").replace(/\s+([,.])/g, "$1").trim().replace(/[.,;]?$/, ".");
}

/** Passive summary line, e.g. "Expertise has been built in Python, SQL and Airflow." */
export function frameSkillsSummary(skills: string[], voice: Voice = "passive"): string {
  const list = joinList(skills.slice(0, 5));
  return voice === "passive"
    ? `Hands-on expertise has been built in ${list}.`
    : `Brings hands-on expertise in ${list}.`;
}
