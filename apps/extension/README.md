# CVTuner browser extension

**On LinkedIn, Naukri and Indeed** a small bar appears on job pages:

- **Tune with CVTuner** opens CVTuner with the job's title, company, location, description and (on Naukri) key skills filled in.
- **Save to tracker** adds the job to CVTuner's Tracker, so you can tune for it later.

LinkedIn and Indeed open jobs in a side panel without reloading the page. The bar follows whichever job you have open.

**On any other site**, click the toolbar icon, or right-click and choose **Tune my resume for this job**. If you selected text first, only the selection is sent.

The extension reads only the page you are on, only when you click, in your own browser. The job travels in the URL fragment (`#…`), which browsers never send to a server.

## Install (Chrome, Edge, Brave)

1. Download `cvtuner-extension.zip` from CVTuner (Jobs tab → Get the extension), or use this folder.
2. Unzip it. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose the unzipped folder.

## Publish

Run `pnpm --filter @cvtuner/web zip-extension` to rebuild the zip. Upload it to the Chrome Web Store developer dashboard.

The permissions:
- `activeTab` and `scripting` let the toolbar button read the page you clicked on.
- `contextMenus` adds the right-click item.
- The content script runs only on LinkedIn jobs, Naukri and Indeed pages.

## Site selectors

LinkedIn, Naukri and Indeed change their markup from time to time. The selectors live in `content.js` under `EXTRACT`. Each site has fallbacks: schema.org JobPosting data, then the page's main text.
