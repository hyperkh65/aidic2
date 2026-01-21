import * as cheerio from "cheerio";
import { fetchHtml } from "@/lib/fetchers/http";
import { normalizeUrl } from "@/lib/utils";

export type Candidate = {
  type: "TOOL" | "MODEL";
  name: string;
  url: string;
  rawText: string;
  source: string;
  sourceUrl: string;
};

function absUrl(url: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return "https://www.toolify.ai" + url;
  return "https://www.toolify.ai/" + url.replace(/^\/+/, "");
}

function pickName($: cheerio.CheerioAPI, a: cheerio.Element) {
  const $a = $(a);
  const title = ($a.attr("title") ?? "").trim();
  if (title) return title.slice(0, 80);

  // Often the anchor wraps a card; look for heading inside
  const heading =
    ($a.find("h1,h2,h3").first().text() ?? "").trim() ||
    ($a.find("[data-testid='title']").first().text() ?? "").trim();

  const text = (heading || $a.text() || "").trim().replace(/\s+/g, " ");
  return text.slice(0, 80);
}

function pickDesc($: cheerio.CheerioAPI, a: cheerio.Element) {
  const $a = $(a);
  // Try to grab a short description in the same card
  const card = $a.closest("article, li, div");
  const desc =
    (card.find("p").first().text() ?? "").trim() ||
    (card.find("[data-testid='desc']").first().text() ?? "").trim();

  const clean = (desc || "").trim().replace(/\s+/g, " ");
  return clean.slice(0, 400);
}

function uniqueByUrl(items: Candidate[]) {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const it of items) {
    const key = normalizeUrl(it.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...it, url: key });
  }
  return out;
}

export async function fetchToolifyNew(limit = 40): Promise<Candidate[]> {
  const sourceUrl = "https://www.toolify.ai/new";
  const html = await fetchHtml(sourceUrl);
  if (!html) return [];
  const $ = cheerio.load(html);

  const items: Candidate[] = [];

  // Prefer explicit new-list selectors if present; fall back to broad selectors.
  const anchors = $("a[href^='/ai-tool/'], a[href^='/tool/']").toArray();

  for (const a of anchors) {
    if (items.length >= limit * 3) break;
    const href = $(a).attr("href") ?? "";
    const url = normalizeUrl(absUrl(href));
    if (!url) continue;

    const name = pickName($, a);
    if (!name) continue;

    const rawText =
      pickDesc($, a) || "Toolify 신규 목록에서 수집된 항목입니다.";

    items.push({
      type: "TOOL",
      name,
      url,
      rawText,
      source: "toolify",
      sourceUrl,
    });
  }

  return uniqueByUrl(items).slice(0, limit);
}

export async function fetchToolifyModels(limit = 40): Promise<Candidate[]> {
  const sourceUrl = "https://www.toolify.ai/ai-model";
  const html = await fetchHtml(sourceUrl);
  if (!html) return [];
  const $ = cheerio.load(html);

  const items: Candidate[] = [];
  const anchors = $("a[href^='/ai-model/'], a[href^='/model/']").toArray();

  for (const a of anchors) {
    if (items.length >= limit * 3) break;
    const href = $(a).attr("href") ?? "";
    const url = normalizeUrl(absUrl(href));
    if (!url) continue;

    const name = pickName($, a);
    if (!name) continue;

    const rawText =
      pickDesc($, a) || "Toolify 모델 목록에서 수집된 항목입니다.";

    items.push({
      type: "MODEL",
      name,
      url,
      rawText,
      source: "toolify",
      sourceUrl,
    });
  }

  return uniqueByUrl(items).slice(0, limit);
}
