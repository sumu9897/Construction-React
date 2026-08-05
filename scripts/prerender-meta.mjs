/**
 * Bake per-route metadata into static HTML, after `vite build`.
 *
 * A single-page app serves the same index.html for every URL, so every URL
 * shares one <title>, one description and one preview image. Google renders
 * JavaScript and would eventually see the right ones — but link scrapers do
 * not. WhatsApp, Facebook, LinkedIn, iMessage and Slack fetch the raw HTML,
 * read <head>, and never execute a line of JS.
 *
 * That matters here more than the search ranking does: a link to the
 * development forwarded on WhatsApp is the single likeliest way a buyer meets
 * this project, and without this step that message would show the company
 * homepage title instead of the apartments.
 *
 * Writes one HTML file per route with its own head. render.yaml maps the URL
 * to the file; everything else still falls through to index.html.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

// Imported from the app so the copy can never drift between the baked HTML
// and what the client sets on navigation.
const { PAGES, PROJECT_LD, SITE } = await import(path.join(root, "src/lib/seo.js"));

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Replace the whole <head> block of one tag, or append it if absent. */
function upsert(html, pattern, replacement) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace("</head>", `    ${replacement}\n  </head>`);
}

function applyMeta(html, page, extraLd) {
  const url = `${SITE}${page.path}`;
  let out = html;

  out = upsert(out, /<title>[\s\S]*?<\/title>/, `<title>${esc(page.title)}</title>`);
  out = upsert(
    out,
    /<meta\s+name="description"[\s\S]*?\/?>/,
    `<meta name="description" content="${esc(page.description)}" />`,
  );
  out = upsert(out, /<link\s+rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}" />`);

  const og = [
    ["og:type", "website"],
    ["og:site_name", "PMCC"],
    ["og:title", page.title],
    ["og:description", page.description],
    ["og:image", page.image],
    ["og:image:width", "2400"],
    ["og:image:height", "1260"],
    ["og:image:alt", page.imageAlt],
    ["og:url", url],
  ];
  for (const [property, content] of og) {
    out = upsert(
      out,
      new RegExp(`<meta\\s+property="${property}"[^>]*>`),
      `<meta property="${property}" content="${esc(content)}" />`,
    );
  }

  const twitter = [
    ["twitter:card", "summary_large_image"],
    ["twitter:title", page.title],
    ["twitter:description", page.description],
    ["twitter:image", page.image],
  ];
  for (const [name, content] of twitter) {
    out = upsert(
      out,
      new RegExp(`<meta\\s+name="${name}"[^>]*>`),
      `<meta name="${name}" content="${esc(content)}" />`,
    );
  }

  if (extraLd) {
    out = out.replace(
      "</head>",
      `    <script type="application/ld+json">${JSON.stringify(extraLd)}</script>\n  </head>`,
    );
  }

  return out;
}

const index = await readFile(path.join(dist, "index.html"), "utf8");

// The homepage: rewrite in place.
await writeFile(path.join(dist, "index.html"), applyMeta(index, PAGES.home), "utf8");

// The development: its own file, with the listing structured data attached.
await writeFile(
  path.join(dist, "daher-el-souane-563.html"),
  applyMeta(index, PAGES.project, PROJECT_LD),
  "utf8",
);

console.log("  meta   index.html + daher-el-souane-563.html");

// The sitemap, re-stamped with the build date: <lastmod> is what tells
// Google a page changed and is worth recrawling — without it, a stale
// search snippet can linger for weeks after a copy change.
const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE}/daher-el-souane-563</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>
`;
await writeFile(path.join(dist, "sitemap.xml"), sitemap, "utf8");
console.log("  sitemap  lastmod " + today);
