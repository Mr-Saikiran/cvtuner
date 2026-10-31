// Sends the selected text (or the page's main text) to CVTuner in the URL fragment,
// so the job description never touches a server.
const APP = "https://techswitch.in/cvtuner/share";
const MAX_CHARS = 20000;

function open(text, url, title) {
  const hash = new URLSearchParams({ text: (text || "").slice(0, MAX_CHARS), url: url || "", title: title || "" });
  chrome.tabs.create({ url: `${APP}#${hash.toString()}` });
}

function grabPage() {
  const selection = String(window.getSelection() || "").trim();
  if (selection.length > 80) return selection;
  const main = document.querySelector("main, article, [role=main], #job-details, .jobs-description, .job-description") || document.body;
  return main.innerText;
}

/** On LinkedIn, Naukri and Indeed the content script knows the job's fields; ask it first. */
async function fromContentScript(tab) {
  try {
    const job = await chrome.tabs.sendMessage(tab.id, { type: "cvtuner:job" });
    if (job && job.hasDescription) {
      const hash = new URLSearchParams({ text: job.text, url: job.url, title: job.title || "", company: job.company || "", source: "extension" });
      chrome.tabs.create({ url: `${APP}#${hash.toString()}` });
      return true;
    }
  } catch {
    // no content script on this page
  }
  return false;
}

chrome.action.onClicked.addListener(async (tab) => {
  if (await fromContentScript(tab)) return;
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: grabPage });
    open(res && res.result, tab.url, tab.title);
  } catch {
    // pages like chrome:// cannot be read; send the link only
    open("", tab.url, tab.title);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "cvtuner-selection", title: "Tune my resume for this job", contexts: ["selection", "page", "link"] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.selectionText) return open(info.selectionText, tab && tab.url, tab && tab.title);
  if (info.linkUrl) return open("", info.linkUrl, "");
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: grabPage });
    open(res && res.result, tab.url, tab.title);
  } catch {
    open("", tab && tab.url, tab && tab.title);
  }
});
