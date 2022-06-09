import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "microcms-js-sdk";
import YAML from "yaml";
import parseArgs from "minimist";

const args = parseArgs(process.argv);

/**
 * @type {string=}
 * API Key
 */
const apiKey = args.apiKey ?? process.env.API_KEY;

/**
 * @type {string=}
 * Service Domain
 */
const serviceDomain = args.serviceDomain ?? process.env.SERVICE_DOMAIN;

/**
 * @type {string}
 * この日時(ISOString)以降に更新されたデータを取得
 * ex. 2022-06-02T08:23:05.896Z
 */
const date = args.date;

if (!serviceDomain) {
  throw new Error("domainの指定は必須です");
}

if (!apiKey) {
  throw new Error("keyの指定は必須です");
}

if (!date) {
  throw new Error("dateの指定は必須です");
}

/**
 * @typedef {object} ObjectResponse
 * @prop {string} id
 * @prop {string} createdAt
 * @prop {string} updatedAt
 * @prop {string} publishedAt
 * @prop {string} revisedAt
 * @prop {*} [content]
 * @prop {string} [title]
 * @prop {object} [category]
 * @prop {string} category.name
 */

/**
 * @typedef {object} ListResponse
 * @prop {Array<ObjectResponse>} contents
 * @prop {number} totalCount
 * @prop {number} offset
 * @prop {number} limit
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 投稿データを取得
 * @param {ReturnType<createClient>} client
 */
const getPosts = async (client) => {
  const limit = 100;
  let offset = 0;
  const postIds = [];

  const { totalCount } = await client.getList({
    endpoint: "blogs",
    queries: {
      limit: 0,
      filters: `revisedAt[greater_than]${date}`,
    },
  });

  do {
    /** @type {ListResponse} */
    const res = await client.getList({
      endpoint: "blogs",
      queries: {
        limit,
        offset,
        fields: "id",
        filters: `revisedAt[greater_than]${date}`,
      },
    });
    postIds.push(...res.contents.map(({ id }) => id));
    offset += limit;
  } while (postIds.length < totalCount);

  /**
   * @param {string} contentId
   * @returns {Promise<ObjectResponse>}
   */
  const getPost = (contentId) => {
    return client.getListDetail({
      endpoint: "blogs",
      contentId,
    });
  };

  for await (const res of postIds.map(getPost)) {
    const { content, category, createdAt, updatedAt, revisedAt, publishedAt, ...rest } = res;

    const frontMatter = {
      ...rest,
      categories: category ? [category.name] : undefined,
      date: publishedAt,
      lastmod: revisedAt,
      draft: false,
    };
    await fs.writeFile(
      path.resolve(__dirname, "../content/posts", `${rest.id}.html`),
      "---\n" + YAML.stringify(frontMatter) + "---\n" + content
    );
    console.log("Save post success:", {
      id: frontMatter.id,
      title: frontMatter.title,
    });
  }
};

/**
 * ウェブサイト情報データを取得
 * @param {ReturnType<createClient>} client
 */
const getWebsite = async (client) => {
  const website = await client.getObject({
    endpoint: "website",
  });

  await fs.writeFile(path.resolve(__dirname, "../data/data.json"), JSON.stringify(website, null, 2));
  console.log("Save website success:", website);
};

const client = createClient({ serviceDomain, apiKey });

await Promise.all([getPosts(client), getWebsite(client)]);
