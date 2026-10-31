# Send to CVTuner (browser extension)

Click the toolbar icon on any job page, or right-click and choose **Tune my resume for this job**. CVTuner opens with the description already pasted. If you selected text first, only the selection is sent.

The text travels in the URL fragment (`#…`), which browsers never send to a server. The page in your browser reads it.

## Install (Chrome, Edge, Brave)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose this `apps/extension` folder.

## Publish

Zip this folder's contents and upload the zip to the Chrome Web Store developer dashboard. The extension needs `activeTab` and `scripting` to read the page you clicked on, and only that page. It needs `contextMenus` for the right-click item.
