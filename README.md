# Note-for-life

**A private-by-default study notebook for text, PDFs, and images.** Paste text without losing the original, compare an imported PDF with an existing note, then decide what to add before creating a summary.

[Open the app](https://zumo1547.github.io/Note-for-life/) · [ภาษาไทย](README.th.md) · [Report an issue](https://github.com/zumo1547/Note-for-life/issues)

## Why use it?

- **Keep your source material:** Pasted PDF text stays in the editor as copied. Formatting and AI results appear separately until you choose to use them.
- **Compare before merging:** Import `.txt`, `.md`, or a text-based `.pdf`. See new and repeated lines, inspect the extracted text, and add either the new material or the full file.
- **Study with structure:** Draft an outline, tidy PDF line breaks, and create a concise summary. Add a compatible AI service for deeper analysis and idea prompts.
- **Keep useful images:** Paste screenshots from the clipboard or attach image files.
- **Take notes with you:** Export HTML, Markdown with images, a text summary, or a JSON backup. Import a JSON backup as a new note.

## Start using it

Open the [hosted app](https://zumo1547.github.io/Note-for-life/) in a current browser. Create a note, paste text into the editor, or use **Add file** to import study material. For a PDF, review the comparison panel and add its content before clicking **Summarize**.

Notes and images are saved automatically in **IndexedDB in your browser**. They remain available when you return on the same browser and site address. They are not uploaded to GitHub and do not sync across devices. Browser storage can be cleared by the user, the browser, or private browsing mode. Export JSON backups regularly, especially before changing browsers or devices.

### AI is optional

In **AI settings**, enter an HTTPS Chat Completions-compatible endpoint, model name, and API key. The key is kept only in the current page's memory; it is not committed, saved in IndexedDB, or included in exports. When you run AI analysis, the relevant note or imported file text is sent to the endpoint you chose. Use a provider you trust, and check its pricing, privacy policy, and browser CORS support. Without AI, local extraction and basic point suggestions still work.

## For educators and students

Use Note-for-life to collect lecture notes, excerpts from accessible PDFs, diagrams, and screenshots in one place. The comparison step is useful when adding a revised handout or combining readings: it helps identify repeated text before you update your note. The original material remains visible so you can check summaries against the source. Please respect copyright and your institution's rules when importing or sharing documents.

Text in scanned-image PDFs cannot be extracted without OCR. The app reports this instead of silently creating an empty note. The automatic duplicate check compares normalized text, so review the preview when wording differs.

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
| `styles.css`, `import.css` | General and file-import styles |
| `app.js` | Notes, IndexedDB, comparison, AI request, exports |
| `pdf-reader.mjs` | Extract text from PDF pages |
| `vendor/pdfjs/` | Bundled PDF.js files and their Apache 2.0 license |
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

The original project code is available under the [MIT License](LICENSE). The bundled PDF.js files retain their own [Apache 2.0 license](vendor/pdfjs/LICENSE).
