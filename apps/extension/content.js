// CVTuner on LinkedIn, Naukri and Indeed: adds "Tune with CVTuner" and "Save to tracker" buttons
// to job pages. It reads only the job you are looking at, in your own browser, when you click.
(() => {
  const APP = "https://techswitch.in/cvtuner/share";
  const MAX = 20000;
  const host = location.hostname;
  const site = /linkedin\./.test(host) ? "LinkedIn" : /naukri\./.test(host) ? "Naukri" : /indeed\./.test(host) ? "Indeed" : null;
  if (!site) return;

  const $ = (sel) => {
    for (const s of sel.split("||")) {
      const el = document.querySelector(s.trim());
      if (el && el.innerText && el.innerText.trim()) return el;
    }
    return null;
  };
  const text = (sel) => ($(sel)?.innerText || "").replace(/\s+\n/g, "\n").trim();

  /** schema.org JobPosting, when the page carries it (public LinkedIn and Indeed pages do). */
  function jsonLd() {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(s.textContent);
        const list = [].concat(data["@graph"] || data);
        const job = list.find((x) => x && [].concat(x["@type"]).includes("JobPosting"));
        if (job) {
          const div = document.createElement("div");
          div.innerHTML = job.description || "";
          return { title: job.title, company: job.hiringOrganization && job.hiringOrganization.name, description: div.innerText };
        }
      } catch (e) {
        // not JSON
      }
    }
    return null;
  }

  const EXTRACT = {
    LinkedIn: () => {
      const id = new URLSearchParams(location.search).get("currentJobId") || (location.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d+)/) || [])[1];
      return {
        url: id ? `https://www.linkedin.com/jobs/view/${id}/` : location.href,
        title: text(".job-details-jobs-unified-top-card__job-title || .jobs-unified-top-card__job-title || .top-card-layout__title || h1"),
        company: text(".job-details-jobs-unified-top-card__company-name || .jobs-unified-top-card__company-name || .topcard__org-name-link"),
        location: text(".job-details-jobs-unified-top-card__primary-description-container .tvm__text || .jobs-unified-top-card__bullet || .topcard__flavor--bullet"),
        description: text("#job-details || .jobs-description__content || .jobs-description-content__text || .description__text"),
        ready: !!(id || /\/jobs\/view\//.test(location.pathname)),
      };
    },
    Naukri: () => ({
      url: location.href.split("?")[0],
      title: text('[class*="jd-header-title"] || h1'),
      company: text('[class*="jd-header-comp-name"] a || [class*="jd-header-comp-name"]'),
      location: text('[class*="jhc__location"] || [class*="location"] a'),
      skills: [...document.querySelectorAll('[class*="key-skill"] a, [class*="key-skill"] span, [class*="chip"]')].map((e) => e.innerText.trim()).filter((s) => s && s.length < 40),
      description: text('[class*="JDC__dang-inner-html"] || [class*="job-desc"] || section[class*="job-desc"]'),
      ready: /job-listings-/.test(location.pathname),
    }),
    Indeed: () => {
      const jk = new URLSearchParams(location.search).get("jk") || new URLSearchParams(location.search).get("vjk");
      return {
        url: jk ? `${location.origin}/viewjob?jk=${jk}` : location.href,
        title: text('[data-testid="jobsearch-JobInfoHeader-title"] || .jobsearch-JobInfoHeader-title || h1'),
        company: text('[data-testid="inlineHeader-companyName"] || [data-company-name] || .jobsearch-CompanyInfoContainer a'),
        location: text('[data-testid="inlineHeader-companyLocation"] || [data-testid="job-location"]'),
        description: text("#jobDescriptionText"),
        ready: !!jk || /viewjob/.test(location.pathname),
      };
    },
  };

  function currentJob() {
    const j = EXTRACT[site]();
    const ld = !j.description ? jsonLd() : null;
    // last resort when the site's markup changed: the page's main text, which CVTuner trims to the description
    const fallback = !j.description && !(ld && ld.description) && j.ready ? (document.querySelector("main") || document.body).innerText : "";
    const description = j.description || (ld && ld.description) || fallback;
    const title = j.title || (ld && ld.title) || document.title;
    const company = j.company || (ld && ld.company) || "";
    const head = [title, [company, j.location].filter(Boolean).join(" · ")].filter(Boolean).join("\n");
    const skills = j.skills && j.skills.length ? `\n\nKey skills\n${j.skills.join(", ")}` : "";
    return { ...j, title, company, text: `${head}\n\n${description}${skills}`.slice(0, MAX), hasDescription: description.length > 80 };
  }

  function send(action) {
    const j = currentJob();
    if (!j.hasDescription) {
      toast(`Open a job's details on ${site} first, then press the button again.`);
      return;
    }
    const params = new URLSearchParams({ text: j.text, url: j.url, title: j.title || "", company: j.company || "", source: site, action });
    window.open(`${APP}#${params.toString()}`, "_blank");
  }

  function toast(msg) {
    const t = document.createElement("div");
    t.textContent = msg;
    Object.assign(t.style, { position: "fixed", right: "20px", bottom: "84px", zIndex: 2147483647, background: "#161a23", color: "#fff", padding: "10px 14px", font: "13px system-ui, sans-serif", maxWidth: "300px" });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  function mount() {
    if (document.getElementById("cvtuner-bar")) return;
    const bar = document.createElement("div");
    bar.id = "cvtuner-bar";
    Object.assign(bar.style, { position: "fixed", right: "20px", bottom: "20px", zIndex: 2147483647, display: "flex", gap: "0", boxShadow: "6px 6px 0 rgba(0,0,0,.25)", font: "600 13px system-ui, sans-serif" });
    const mk = (label, action, primary) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      Object.assign(b.style, { padding: "10px 14px", border: "2px solid #161a23", background: primary ? "#161a23" : "#fff", color: primary ? "#fff" : "#161a23", cursor: "pointer", font: "inherit" });
      b.addEventListener("click", () => send(action));
      return b;
    };
    bar.append(mk("Tune with CVTuner", "tune", true), mk("Save to tracker", "save", false));
    document.body.appendChild(bar);
  }

  function unmount() {
    document.getElementById("cvtuner-bar")?.remove();
  }

  // LinkedIn and Indeed swap jobs without reloading the page, so re-check as the page changes
  let last = "";
  const check = () => {
    const key = location.href;
    const ready = EXTRACT[site]().ready;
    if (ready) mount();
    else unmount();
    last = key;
  };
  check();
  new MutationObserver(() => {
    if (location.href !== last) check();
  }).observe(document.documentElement, { childList: true, subtree: true });

  // the toolbar button and context menu ask the page for the job too
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg && msg.type === "cvtuner:job") reply(currentJob());
  });
})();
