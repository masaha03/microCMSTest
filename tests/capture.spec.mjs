import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";
import { test, expect } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("all page", async ({ page }, testInfo) => {
  const sitemap = await fs.readFile(path.resolve(__dirname, "../public/sitemap.xml"));
  const $ = cheerio.load(sitemap);
  const urls = $("url > loc")
    .toArray()
    .map((el) => $(el).text());
  urls.sort((a, b) => a.localeCompare(b));

  let count = 0;
  for (const url of urls) {
    count++;
    await page.goto("http://localhost:1313" + url);
    const dir = testInfo.outputDir;
    await fs.mkdir(dir, { recursive: true });
    const filename = `${`${count}`.padStart(4, "0")}_root${decodeURIComponent(url)
      .replaceAll("/", "_")
      .slice(0, -1)}.png`;
    await page.screenshot({ fullPage: true, path: path.join(dir, filename) });
  }
});
