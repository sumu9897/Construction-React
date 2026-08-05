# Fonts

**Fraunces**, Latin subset, static instances from the `@fontsource/fraunces` npm
package (v5.3.0). The display face — carries the PMCC brand voice from the website
into print. Used only for the project name, hero figures and appendix titles.

| File | Weight |
|---|---|
| `fraunces-400.woff2` | Regular — large dates where SemiBold is too heavy |
| `fraunces-600.woff2` | SemiBold — project name, hero figures, appendix titles |

**IBM Plex Sans**, Latin1 subset, from the `@ibm/plex-sans` npm package.

Licensed under the [SIL Open Font License 1.1](https://openfontlicense.org/) — full
text in `OFL.txt`; redistribution with the report output is permitted. Source:
<https://github.com/IBM/plex>.

| File | Weight |
|---|---|
| `ibm-plex-sans-400.woff2` | Regular — body copy |
| `ibm-plex-sans-500.woff2` | Medium — labels, emphasis |
| `ibm-plex-sans-600.woff2` | SemiBold — headings, figures |

**These are static instances, not the variable font, and that is deliberate.**
Chromium cannot emit a TrueType subset for an instance of a variable font, so it
falls back to Type3 glyph procedures. The report still looks correct, but the PDF
text becomes unselectable and unsearchable and the file roughly doubles in size.
Static weights produce properly embedded, subsetted TrueType.

The Latin1 subset covers ASCII, Latin-1 Supplement, and the punctuation the report
uses (em dash, middot, curly quotes). It does **not** cover geometric shapes such
as `▲`/`▼` — using those in the template would silently fall back to another
typeface, so the report words its deltas instead.

These are committed deliberately rather than fetched at render time. Two reasons:

1. **The report must render identically everywhere.** This container has no
   professional fonts at all — `fc-match` resolves Georgia, Charter, Inter and Source
   Serif all to DejaVu *Sans*, so a missing serif silently becomes a sans rather than
   failing loudly. A Mac mini has an entirely different set. Embedding removes the
   variable.
2. **A client report should not depend on a network fetch** at the moment you need to
   issue it.

They are base64-inlined into the HTML by `src/report/html/fonts.js`, so the generated
report is a single self-contained file.

To refresh, download the latin-subset woff2 from the Google Fonts CSS API and replace
these files — no code change needed.
