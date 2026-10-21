# Note-for-life

**A private-by-default study notebook for text, PDFs, and images.** Drop a file and get an editable summary automatically. No account or API key is needed.

[Open the app](https://zumo1547.github.io/Note-for-life/) · [ภาษาไทย](README.th.md) · [Report an issue](https://github.com/zumo1547/Note-for-life/issues)

## Why use it?

- **One action to summarize:** Import `.txt`, `.md`, or a text-based `.pdf`. The full text is added to the note and an editable summary appears automatically.
- **Keep your source material:** The extracted text stays in the editor. You can correct it and press **Summarize again** at any time.
- **Read Thai text reliably:** UTF-8, UTF-16, and Thai Windows-874/TIS-620 text files are supported. A review panel appears if extraction contains replacement characters.
- **Optional AI on your device:** On browsers with WebGPU, one button downloads a small multilingual model to improve the summary locally. It does not require an API key.
- **Keep useful images:** Paste screenshots from the clipboard or attach image files.
- **Take notes with you:** Export an editable Markdown summary, a text summary, a print-ready PDF, HTML, Markdown with images, or a JSON backup. Import a JSON backup as a new note.

## Start using it

Open the [hosted app](https://zumo1547.github.io/Note-for-life/) in a current browser. Drag in a PDF or text file. The app extracts its text and creates a summary automatically. Correct the source or summary if needed, then download it.

Notes and images are saved automatically in **IndexedDB in your browser**. They remain available when you return on the same browser and site address. They are not uploaded to GitHub and do not sync across devices. Browser storage can be cleared by the user, the browser, or private browsing mode. Export JSON backups regularly, especially before changing browsers or devices.

### How local AI works

The instant summary is an **extractive summary**: it selects important passages from the original in the browser. It works without a model download, including on mobile. The **Improve with AI on this device** button loads [WebLLM](https://github.com/mlc-ai/web-llm) and a [Qwen2.5 0.5B model](https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC) on compatible WebGPU devices. The first use downloads model files from Hugging Face and may need substantial storage and time. Text is processed on the device; the model receives selected passages from the note, not the entire long PDF. After a successful run, later imports can improve automatically. If the model cannot run, the instant summary remains available.

## For educators and students

Use Note-for-life to collect lecture notes, excerpts from accessible PDFs, diagrams, and screenshots in one place. The original material remains visible so you can check summaries against the source. Please respect copyright and your institution's rules when importing or sharing documents.

Text in scanned-image PDFs cannot be extracted without OCR. Some PDFs with damaged font mappings may also yield incorrect characters; check the extracted text before relying on a summary.

## Run and edit locally

This is a small HTML/CSS/JavaScript project with no package installation or build framework. Node.js is needed only for the optional local web server and deployment checks.

```bash
node server.js
```

Open `http://127.0.0.1:8765/`. On Windows, `start.cmd` runs the same server. The local server binds to `127.0.0.1` and serves only the app's public files. PDF.js modules need HTTP; opening `index.html` directly through `file://` may prevent PDF import. Browser storage for `file://`, localhost, and GitHub Pages is separate. Export and re-import a JSON backup when moving between them.

Code map:

| File | Purpose |
| --- | --- |
| `index.html` | App layout and controls |
| `styles.css`, `typography.css` | App layout and Thai typography |
| `app.js` | Notes, IndexedDB, automatic summaries, exports |
| `local-ai.mjs` | Optional browser-local AI summary |
| `pdf-reader.mjs` | Extract text from PDF pages |
| `text-reader.mjs` | Decode UTF-8, UTF-16, and Thai legacy text |
| `fonts/` | Bundled IBM Plex Sans Thai and its Open Font License |
| `vendor/pdfjs/` | Bundled PDF.js files and their Apache 2.0 license |
| `vendor/webllm.mjs` | Bundled WebLLM runtime, loaded only when local AI is used |
| `scripts/build-site.mjs` | Copy only public files into the Pages artifact |

Run `node verify.mjs` to check the UI element references and comparison logic. Run `node --check app.js` and `node --check pdf-reader.mjs` for syntax checks.

## Deploy your own copy with GitHub Pages

1. Fork this repository.
2. In **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions**.
3. Push to `main` or run the **Deploy Note-for-life** workflow from the Actions tab.
4. Open the Pages URL shown in the deployment result. For a project fork, it is usually `https://<username>.github.io/<repository>/`.

The workflow publishes only the app files copied by `scripts/build-site.mjs`. Personal PDFs, exported notes, backups, and environment files are excluded from Git and the Pages artifact. Do not put API keys or private documents in source files.

## Contributing

Educational improvements, accessibility fixes, translations, and bug reports are welcome. Keep dependencies small and avoid storing user content on a server without a clear privacy model. Open an issue to discuss larger changes, or submit a focused pull request. Please test PDF import and note persistence in a browser before proposing changes.

## License

The original project code is available under the [MIT License](LICENSE). Bundled PDF.js and WebLLM retain their [Apache 2.0](vendor/pdfjs/LICENSE) and [Apache 2.0](vendor/webllm-LICENSE) licenses. Bundled loglevel retains its [MIT license](vendor/loglevel-LICENSE); IBM Plex Sans Thai retains its [Open Font License](fonts/OFL.txt). Model files are downloaded separately from Hugging Face when local AI is enabled.
