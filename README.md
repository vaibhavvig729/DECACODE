# Finora

**Support, money tools, and livelihood guidance in one place.**

A standalone, local-first website prototype for scheme discovery, document preparation, transaction review, and occupation-specific sales tracking.

## Files

- `index.html` — page structure
- `style.css` — responsive layout and visual styles
- `finora-logo.svg` — Finora rupee-symbol logo
- `script.js` — language support, scheme matching, transaction parsing and flags, and business records

## Run it

1. Extract the ZIP, or keep the three website files together in one folder.
2. Open that folder in VS Code.
3. Run the folder through a local web server (for example, install VS Code Live Server and choose **Go Live**). The PDF reader is a bundled JavaScript module and requires a local server; opening `index.html` directly as a `file://` page will not load it.
4. Choose English, हिन्दी, or ಕನ್ನಡ from the top-right selector. The choice is remembered in that browser.
5. Use **Load sample data** under Money tools to explore transaction summaries and rule-based warning flags. Try **Show possible matches** under Schemes and add a catalog item and sale under My business.

No account, API key, server, bank connection, or UPI access is used. Data is stored in the current browser's local storage. Clearing browser site data removes it.

## Frequently asked questions

The page ends with six FAQs about profiles, scheme eligibility, UPI privacy, supported statement PDFs, suspicious-activity flags, and livelihood suggestions. The FAQ text supports English, Hindi, and Kannada.

## AI help shortcut

Use the floating **AI help** button at the bottom right to choose a topic, copy a suggested question, and open ChatGPT. ChatGPT opens separately; the website does not send saved transactions, business records, or account details. Paste only information you are comfortable sharing, and never share payment credentials or OTPs.

## UPI statement PDF import

Choose a text-based UPI statement PDF (the upload is labeled specifically for UPI statements). The bundled PDF.js reader extracts selectable text locally in the browser and looks for dated transaction rows. Scanned/image-only PDFs need OCR and are not supported. Imported rows are combined with existing records. Review and edit each row's amount, direction, and category before relying on summaries. Statement formats vary; rows may be missed or misread. PNR, UTR, RRN, reference, transaction-ID, and similar labeled identifiers are excluded as amount candidates; long unformatted numbers are ignored too. If a line has both a transaction amount and running balance, the parser uses a best-effort positional heuristic. Direction defaults to outgoing unless the row includes a clear CR/Credit marker, and can be edited in the table.

The analyzer uses transparent keyword rules, not a connected AI model. Its transaction flags look for repeated matching entries, unusually large outflows relative to the imported sample, and clusters of outgoing entries on the same date. Statement PDFs usually do not provide reliable transaction times, so the site cannot establish whether transfers happened rapidly. The scam message helper checks a small set of wording patterns. These are review prompts, not definitive fraud detection; false positives and missed issues are possible. Never enter credentials, OTPs, PINs, or full payment details.

## Business records

The occupation-wise scheme finder includes starter listings for 15 work and life categories. Results are shown under the selected occupation heading, with schemes related to the selected support need first, followed by the rest of that occupation's list. Links lead to official portals or government scheme directories where available. Suggestions and checklists are not eligibility decisions or official document requirements; confirm current rules with the administering institution before applying.

The catalog tracks sale price and recorded per-unit cost for products and services. For farmers, shops, and artisans, stock can be added and sales reduce the saved quantity. Freelancers can track service units such as hours or projects without stock. Each sale records date, quantity, revenue, and gross margin. Insights describe patterns in the entered records and offer occupation-specific bookkeeping ideas; they are not earnings or business-success predictions. Gross margin excludes overhead and taxes.

## Scheme information

Scheme links point to official portals where available, but suggestions and checklists are starter examples rather than current eligibility decisions or official document requirements. Always confirm current rules with the linked portal or administering institution before applying.

## Privacy

This is a browser-only prototype. UPI PDF contents and business records are processed in the page and stored in local storage on the device. The bundled PDF.js library is licensed under Apache 2.0; its license is in `vendor/pdfjs/LICENSE`. Do not use a shared device for sensitive records. No live UPI account or payment integration is present.
