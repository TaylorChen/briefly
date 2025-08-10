# Briefly - One‑click Webpage AI Summarizer

Cross‑browser extension (Chrome/Firefox) that extracts the main content of the current page and generates a concise summary with LLMs. Supports DeepSeek and Qwen (DashScope OpenAI‑compatible endpoint).

## Features
- One‑click summarization of the current webpage
- Provider switch: DeepSeek / Qwen (configure API key and model in Options)
- Custom prompt for re‑summarization
- History: last 5 summaries for the same page
- Minimal permissions: injects content script only when needed
- Markdown output shown as raw Markdown (copyable)

## Install (Development)
- Chrome: open `chrome://extensions` → Enable Developer Mode → Load unpacked → select this repository folder
- Firefox: open `about:debugging#/runtime/this-firefox` → Load Temporary Add‑on → choose `manifest.json`

## Usage
1) Click the extension icon. Choose provider (DeepSeek/Qwen). First time, go to Options and set API key and default model
2) Open any http/https page and click “Summarize this page”
3) Optionally provide a custom prompt and click “Regenerate”
4) Click “View History” to see the latest 5 summaries for the same page

## Configuration
- DeepSeek
  - Endpoint: `https://api.deepseek.com/chat/completions`
  - Default model: `deepseek-chat`
- Qwen (DashScope / OpenAI‑compatible)
  - Endpoint: `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
  - Default model: `qwen2.5-7b-instruct`

Both use `Authorization: Bearer <API_KEY>`.

## Privacy & Security
- API keys are stored in browser `chrome.storage.sync`
- Summaries history is stored locally in `chrome.storage.local`
- Page content is extracted locally and sent directly from your browser to the chosen provider. The project does not collect or transmit your data to our servers
- See `webstore/privacy-policy.html` for details (host it on a public URL when publishing)

## Project Structure
```
manifest.json
background.js
content_script.js
popup.html / popup.js / popup.css
options.html / options.js / options.css
history.html / history.js / history.css
icons/briefly.svg
scripts/build.sh
webstore/privacy-policy.html
webstore/store-listing.md
```

## Build
Run:
```
./scripts/build.sh
```
This creates `dist/briefly-0.1.0.zip` for loading or submission.

## Chrome Web Store Publishing
1) Assets
   - Icon 512×512: see `icons/briefly.svg`
   - Screenshots (e.g., 1280×800 or 1365×1024): popup, options, history
   - Privacy policy: `webstore/privacy-policy.html` → host on a public URL (e.g., GitHub Pages)
   - Listing text: see `webstore/store-listing.md`
2) Permissions/minimalism
   - Keep only `activeTab`, `scripting`, `storage`, `tabs`
   - Avoid persistent `content_scripts` (we inject on demand)
3) Compliance
   - No data collection or sale; content goes directly to the selected provider
   - Clearly disclose permissions and data usage in the listing
4) Upload
   - Create a new item in the Chrome Web Store Developer Dashboard → upload the ZIP → fill in details
5) Review tips
   - Explicitly mention “only accesses the active tab when the user clicks”
   - Ensure screenshots show permissions, settings, and functionality clearly

## Firefox Notes
- MV3 support continues to improve in Firefox. If you hit MV3 limitations, you may temporarily load as a temporary add‑on while testing

## Contributing
See `CONTRIBUTING.md`.

## License
MIT — see `LICENSE`.
