// Copyright 2022 the Deno authors. All rights reserved. MIT license.

/**
 * Minimal blogging library for Deno.
 *
 * Create a blog with a few lines of code, write posts in Markdown, and serve
 * locally or on Deno Deploy.
 *
 * @module
 * @example
 * ```ts
 * import blog from "@hmalinchock/blog";
 *
 * blog({
 *   title: "My Blog",
 *   description: "Thoughts and notes.",
 *   author: "You",
 * });
 * ```
 */
/** @jsx jsx */

import {
  callsites,
  ColorScheme,
  dirname,
  Feed,
  Fragment as jsxFragment,
  fromFileUrl,
  frontMatter,
  gfm,
  h as jsx,
  html,
  type HtmlOptions,
  join,
  relative,
  removeMarkdown,
  serveDir,
  UnoCSS,
  walk,
  type WalkEntry,
} from "./deps.ts";
import { pooledMap } from "@std/async";
import { Index, PostPage } from "./components.tsx";
import type { FeedItem } from "./deps.ts";
import type {
  BlogContext,
  BlogMiddleware,
  BlogSettings,
  BlogState,
  Post,
} from "./types.ts";

/**
 * JSX element factory for custom headers, footers, and sections.
 *
 * Same runtime as Preact's `h`. The public signature is type-erased so
 * generated JSR docs do not pull in Preact's private types.
 */
export function h(
  type: string | ((props?: Record<string, unknown>) => unknown),
  props?: Record<string, unknown> | null,
  ...children: unknown[]
): unknown {
  return (jsx as (...args: unknown[]) => unknown)(
    type,
    props ?? null,
    ...children,
  );
}

/**
 * JSX fragment helper for custom headers, footers, and sections.
 *
 * Public type is erased for the same reason as {@linkcode h}.
 */
export const Fragment = jsxFragment as unknown as (
  props?: { children?: unknown },
) => unknown;

/** Blog configuration and runtime types. */
export type {
  BlogContext,
  BlogMiddleware,
  BlogSettings,
  BlogState,
  DateFormat,
  HtmlChild,
  Post,
} from "./types.ts";

/** UnoCSS config type accepted by {@linkcode BlogSettings.unocss}. */
export type { UnoConfig } from "./deps.ts";

const IS_DEV = Deno.args.includes("--dev") && "watchFs" in Deno;
const POSTS = new Map<string, Post>();
const HMR_SOCKETS: Set<WebSocket> = new Set();

const HMR_CLIENT = `let socket;
let reconnectTimer;

const wsOrigin = window.location.origin
  .replace("http", "ws")
  .replace("https", "wss");
const hmrUrl = wsOrigin + "/hmr";

hmrSocket();

function hmrSocket(callback) {
  if (socket) {
    socket.close();
  }

  socket = new WebSocket(hmrUrl);
  socket.addEventListener("open", callback);
  socket.addEventListener("message", (event) => {
    if (event.data === "refresh") {
      console.log("refreshings");
      window.location.reload();
    }
  });

  socket.addEventListener("close", () => {
    console.log("reconnecting...");
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      hmrSocket(() => {
        window.location.reload();
      });
    }, 1000);
  });
}
`;

function errorHandler(err: unknown) {
  console.error(err);
  return new Response("Internal server error", { status: 500 });
}

/**
 * Resolve {@linkcode BlogSettings.theme} to the color-scheme plugin mode.
 *
 * `"light"` and `"dark"` are forced. Anything else, including `undefined`,
 * is `"auto"` (system preference + `localStorage`).
 */
export function resolveColorScheme(
  theme?: BlogSettings["theme"],
): "dark" | "light" | "auto" {
  if (theme === "dark" || theme === "light") {
    return theme;
  }
  return "auto";
}

/**
 * Start the blog HTTP server.
 *
 * Reads Markdown posts from a `posts/` directory next to the caller, then
 * serves the index, post pages, static assets, and an Atom feed.
 *
 * @param settings Optional blog configuration (title, author, theme, etc.)
 *
 * @example
 * ```ts
 * import blog, { ga, redirects } from "@hmalinchock/blog";
 *
 * blog({
 *   title: "My Blog",
 *   description: "The blog description.",
 *   avatar: "./avatar.png",
 *   middlewares: [
 *     ga("G-XXXXXXXXXX"),
 *     redirects({ "/old": "/new-post" }),
 *   ],
 * });
 * ```
 */
export default async function blog(settings?: BlogSettings): Promise<void> {
  html.use(UnoCSS(settings?.unocss)); // Load custom unocss module if provided
  html.use(ColorScheme(resolveColorScheme(settings?.theme)));

  const url = callsites()[1].getFileName()!;
  const blogState = await configureBlog(url, IS_DEV, settings);

  const blogHandler = createBlogHandler(blogState);
  Deno.serve({
    handler: blogHandler as Deno.ServeHandler,
    port: blogState.port,
    hostname: blogState.hostname ?? "0.0.0.0",
    onError: errorHandler,
  });
}

/**
 * Create a request handler for the blog without starting a server.
 *
 * Useful for tests and embedding the blog inside another server.
 *
 * @param state Configured blog state from {@linkcode configureBlog}
 */
export function createBlogHandler(
  state: BlogState,
): (req: Request, info: Deno.ServeHandlerInfo) => Response | Promise<Response> {
  const inner = handler;
  const withMiddlewares = composeMiddlewares(state);
  return function blogRequestHandler(
    req: Request,
    info: Deno.ServeHandlerInfo,
  ) {
    // Redirect requests that end with a trailing slash
    // to their non-trailing slash counterpart.
    // Ex: /about/ -> /about
    const url = new URL(req.url);
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
      return Response.redirect(url.href, 307);
    }
    return withMiddlewares(req, info, inner);
  };
}
function composeMiddlewares(state: BlogState) {
  return (
    req: Request,
    info: Deno.ServeHandlerInfo,
    inner: (req: Request, ctx: BlogContext) => Promise<Response>,
  ) => {
    const mws = state.middlewares?.slice().reverse();

    const handlers: (() => Response | Promise<Response>)[] = [];

    const ctx = {
      next() {
        const handler = handlers.shift()!;
        return Promise.resolve(handler());
      },
      connInfo: info,
      state,
    };

    if (mws) {
      for (const mw of mws) {
        handlers.push(() => mw(req, ctx));
      }
    }

    handlers.push(() => inner(req, ctx));

    const handler = handlers.shift()!;
    return handler();
  };
}

/**
 * Load posts and build the runtime {@linkcode BlogState}.
 *
 * @param url File URL or path of the blog entry module (usually the caller)
 * @param isDev When true, watches `posts/` for changes and enables HMR
 * @param settings Optional blog settings
 */
export async function configureBlog(
  url: string,
  isDev: boolean,
  settings?: BlogSettings,
): Promise<BlogState> {
  let directory;

  try {
    const blogPath = URL.canParse(url) ? fromFileUrl(url) : url;
    directory = dirname(blogPath);
  } catch (e) {
    console.error(e);
    throw new Error("Cannot run blog from a remote URL.");
  }

  // Override blog directory, if `rootDirectory` is provided
  directory = settings?.rootDirectory ?? directory;

  const state: BlogState = {
    directory,
    ...settings,
  };

  await loadContent(directory, isDev);

  return state;
}

async function loadContent(blogDirectory: string, isDev: boolean) {
  // Read posts from the current directory and store them in memory.
  const postsDirectory = join(blogDirectory, "posts");

  const traversal: WalkEntry[] = [];
  for await (const entry of walk(postsDirectory)) {
    if (entry.isFile && entry.path.endsWith(".md")) {
      traversal.push(entry);
    }
  }

  const pool = pooledMap(
    25,
    traversal,
    (entry) => loadPost(postsDirectory, entry.path),
  );

  for await (const _ of pool) {
    // noop
  }

  if (isDev) {
    watchForChanges(postsDirectory).catch(() => {});
  }
}

// Watcher watches for .md file changes and updates the posts.
async function watchForChanges(postsDirectory: string) {
  const watcher = Deno.watchFs(postsDirectory);
  for await (const event of watcher) {
    if (event.kind === "modify" || event.kind === "create") {
      for (const path of event.paths) {
        if (path.endsWith(".md")) {
          try {
            await loadPost(postsDirectory, path);
            HMR_SOCKETS.forEach((socket) => {
              socket.send("refresh");
            });
          } catch (err) {
            console.error(`loadPost ${path} error:`, (err as Error).message);
          }
        }
      }
    }
  }
}

async function loadPost(postsDirectory: string, path: string) {
  const contents = await Deno.readTextFile(path);
  let pathname = "/" + relative(postsDirectory, path);
  // Remove .md extension.
  pathname = pathname.slice(0, -3);

  const { body: content, attrs: _data } = frontMatter<Record<string, unknown>>(
    contents,
  );

  const data = recordGetter(_data);

  let snippet: string | undefined = data.get("snippet") ??
    data.get("abstract") ??
    data.get("summary") ??
    data.get("description");
  if (!snippet) {
    const maybeSnippet = content.split("\n\n")[0];
    if (maybeSnippet) {
      snippet = removeMarkdown(maybeSnippet.replace("\n", " "));
    } else {
      snippet = "";
    }
  }

  // Note: users can override path of a blog post using
  // pathname in front matter.
  pathname = data.get("pathname") ?? pathname;

  const post: Post = {
    title: data.get("title") ?? "Untitled",
    author: data.get("author"),
    pathname,
    publishDate: parsePublishDate(data.get("publish_date"), path),
    snippet,
    markdown: content,
    coverHtml: data.get("cover_html"),
    ogImage: data.get("og:image"),
    tags: data.get("tags"),
    allowIframes: data.get("allow_iframes"),
    disableHtmlSanitization: data.get("disable_html_sanitization"),
    readTime: readingTime(content),
    renderMath: data.get("render_math"),
  };

  if (POSTS.get(pathname)) {
    console.warn(`Duplicate blog post path: ${pathname}`);
  }
  POSTS.set(pathname, post);
}

/**
 * Core blog request handler (index, posts, feed, static files, HMR).
 *
 * Prefer {@linkcode createBlogHandler} unless you are composing middleware yourself.
 *
 * @param req Incoming request
 * @param ctx Blog context with state and `next`
 */
export async function handler(
  req: Request,
  ctx: BlogContext,
): Promise<Response> {
  const { state: blogState } = ctx;
  const { pathname, searchParams } = new URL(req.url);
  const canonicalUrl = blogState.canonicalUrl || new URL(req.url).origin;
  const ogImage = typeof blogState.ogImage !== "string"
    ? blogState.ogImage?.url
    : blogState.ogImage;
  const twitterCard = typeof blogState.ogImage !== "string"
    ? blogState.ogImage?.twitterCard
    : "summary_large_image";

  if (pathname === "/feed") {
    return serveRSS(req, blogState, POSTS);
  }

  if (IS_DEV) {
    if (pathname == "/hmr.js") {
      return new Response(HMR_CLIENT, {
        headers: {
          "content-type": "application/javascript",
        },
      });
    }

    if (pathname == "/hmr") {
      const { response, socket } = Deno.upgradeWebSocket(req);
      HMR_SOCKETS.add(socket);
      socket.onclose = () => {
        HMR_SOCKETS.delete(socket);
      };

      return response;
    }
  }

  const sharedHtmlOptions: HtmlOptions = {
    lang: blogState.lang ?? "en",
    scripts: IS_DEV ? [{ src: "/hmr.js" }] : undefined,
    links: [
      { href: `${canonicalUrl}${new URL(req.url).pathname}`, rel: "canonical" },
    ],
  };

  const sharedMetaTags = {
    "theme-color": blogState.theme === "dark" ? "#000" : null,
  };

  if (typeof blogState.favicon === "string") {
    sharedHtmlOptions.links?.push({
      href: blogState.favicon,
      type: "image/x-icon",
      rel: "icon",
    });
  } else {
    if (blogState.favicon?.light) {
      sharedHtmlOptions.links?.push({
        href: blogState.favicon.light,
        type: "image/x-icon",
        media: "(prefers-color-scheme:light)",
        rel: "icon",
      });
    }

    if (blogState.favicon?.dark) {
      sharedHtmlOptions.links?.push({
        href: blogState.favicon.dark,
        type: "image/x-icon",
        media: "(prefers-color-scheme:dark)",
        rel: "icon",
      });
    }
  }

  if (pathname === "/") {
    return html({
      ...sharedHtmlOptions,
      title: blogState.title ?? "My Blog",
      meta: {
        ...sharedMetaTags,
        "description": blogState.description,
        "og:title": blogState.title,
        "og:description": blogState.description,
        "og:image": ogImage ?? blogState.cover,
        "twitter:title": blogState.title,
        "twitter:description": blogState.description,
        "twitter:image": ogImage ?? blogState.cover,
        "twitter:card": ogImage ? twitterCard : undefined,
      },
      styles: [
        ...(blogState.style ? [blogState.style] : []),
      ],
      body: (
        <Index
          state={blogState}
          posts={filterPosts(POSTS, searchParams)}
        />
      ),
    });
  }

  const post = POSTS.get(decodeURIComponent(pathname));
  if (post) {
    // Check for an Accept: text/plain header
    if (
      req.headers.has("Accept") && req.headers.get("Accept") === "text/plain"
    ) {
      return new Response(post.markdown);
    }
    return html({
      ...sharedHtmlOptions,
      title: post.title,
      meta: {
        ...sharedMetaTags,
        "description": post.snippet,
        "og:title": post.title,
        "og:description": post.snippet,
        "og:image": post.ogImage,
        "twitter:title": post.title,
        "twitter:description": post.snippet,
        "twitter:image": post.ogImage,
        "twitter:card": post.ogImage ? twitterCard : undefined,
      },
      styles: [
        gfm.CSS,
        `.markdown-body { --color-canvas-default: transparent !important; --color-canvas-subtle: #edf0f2; --color-border-muted: rgba(128,128,128,0.2); } .markdown-body img + p { margin-top: 16px; }`,
        ...(blogState.style ? [blogState.style] : []),
        ...(post.renderMath ? [gfm.KATEX_CSS] : []),
      ],
      body: <PostPage post={post} state={blogState} />,
    });
  }

  let fsRoot = blogState.directory;
  try {
    await Deno.lstat(join(blogState.directory, "./posts", pathname));
    fsRoot = join(blogState.directory, "./posts");
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) {
      console.error(e);
      return new Response("Internal server error", { status: 500 });
    }
  }

  return serveDir(req, { fsRoot });
}

/** Serves the rss/atom feed of the blog. */
function serveRSS(
  req: Request,
  state: BlogState,
  posts: Map<string, Post>,
): Response {
  const url = state.canonicalUrl
    ? new URL(state.canonicalUrl)
    : new URL(req.url);
  const origin = url.origin;
  const copyright = `Copyright ${new Date().getFullYear()} ${origin}`;
  const feed = new Feed({
    title: state.title ?? "Blog",
    description: state.description,
    id: `${origin}/blog`,
    link: `${origin}/blog`,
    language: state.lang ?? "en",
    favicon: `${origin}/favicon.ico`,
    copyright: copyright,
    generator: "Feed (https://github.com/jpmonette/feed) for Deno",
    feedLinks: {
      atom: `${origin}/feed`,
    },
  });

  for (const [_key, post] of posts.entries()) {
    const item: FeedItem = {
      id: `${origin}${post.pathname}`,
      title: post.title,
      description: post.snippet,
      date: post.publishDate,
      link: `${origin}${post.pathname}`,
      author: post.author?.split(",").map((author: string) => ({
        name: author.trim(),
      })),
      image: post.ogImage,
      copyright,
      published: post.publishDate,
    };
    feed.addItem(item);
  }

  const atomFeed = feed.atom1();
  return new Response(atomFeed, {
    headers: {
      "content-type": "application/atom+xml; charset=utf-8",
    },
  });
}

/** GA4 / gtag measurement IDs (`G-`, `GT-`, `AW-`, `DC-`). */
const GA4_MEASUREMENT_ID = /^(G|GT|AW|DC)-[A-Z0-9]+$/i;

/**
 * Build the gtag snippet for a validated GA4 measurement ID.
 *
 * The ID is restricted to {@linkcode GA4_MEASUREMENT_ID} before interpolation.
 */
function gtagSnippet(measurementId: string): string {
  return (
    `<script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>` +
    `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","${measurementId}");</script>`
  );
}

async function injectGtag(
  res: Response,
  measurementId: string,
): Promise<Response> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    return res;
  }
  const body = await res.text();
  const snippet = gtagSnippet(measurementId);
  const html = body.includes("</head>")
    ? body.replace("</head>", `${snippet}</head>`)
    : `${snippet}${body}`;
  const headers = new Headers(res.headers);
  headers.delete("content-length");
  return new Response(html, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

/**
 * Google Analytics 4 middleware.
 *
 * Injects the official gtag.js snippet into HTML responses. Pass a GA4
 * Measurement ID (`G-XXXXXXXXXX`). Universal Analytics (`UA-…`) IDs are
 * rejected with a warning — UA collection shut down in 2023.
 *
 * @param gaKey GA4 Measurement ID (must be non-empty)
 * @returns Middleware that adds gtag to HTML pages
 *
 * @example
 * ```ts
 * import blog, { ga } from "@hmalinchock/blog";
 * blog({ middlewares: [ga("G-XXXXXXXXXX")] });
 * ```
 */
export function ga(gaKey: string): BlogMiddleware {
  if (gaKey.length === 0) {
    throw new Error("GA key cannot be empty.");
  }

  const measurementId = gaKey.trim();
  const isGa4 = GA4_MEASUREMENT_ID.test(measurementId);
  if (!isGa4) {
    console.warn(
      `ga(): "${gaKey}" is not a GA4 Measurement ID (G-XXXXXXXXXX). ` +
        `Universal Analytics (UA-…) was shut down in 2023 and is ignored.`,
    );
  }

  return async function (
    _request: Request,
    ctx: BlogContext,
  ): Promise<Response> {
    try {
      const res = await ctx.next();
      if (!isGa4) {
        return res;
      }
      return await injectGtag(res, measurementId);
    } catch (e) {
      console.error(e);
      return new Response("Internal server error", { status: 500 });
    }
  };
}

/**
 * Path redirect middleware.
 *
 * Keys may be with or without a leading slash. Values may be absolute paths
 * or full `http(s)` URLs.
 *
 * @param redirectMap Map of request path → destination
 *
 * @example
 * ```ts
 * import blog, { redirects } from "@hmalinchock/blog";
 * blog({
 *   middlewares: [redirects({ "/old-post": "/new-post", "home": "/" })],
 * });
 * ```
 */
export function redirects(redirectMap: Record<string, string>): BlogMiddleware {
  return async function (req: Request, ctx: BlogContext): Promise<Response> {
    const { pathname } = new URL(req.url);

    let maybeRedirect = redirectMap[pathname];

    if (!maybeRedirect) {
      // trim leading slash
      maybeRedirect = redirectMap[pathname.slice(1)];
    }

    if (maybeRedirect) {
      if (!maybeRedirect.startsWith("/") && !maybeRedirect.startsWith("http")) {
        maybeRedirect = "/" + maybeRedirect;
      }
      // Block protocol-relative URLs (e.g. //evil.com) which bypass the check above
      if (maybeRedirect.startsWith("//")) {
        maybeRedirect = "/" + maybeRedirect.replace(/^\/+/, "");
      }

      return new Response(null, {
        status: 307,
        headers: {
          "location": maybeRedirect,
        },
      });
    }
    try {
      return await ctx.next();
    } catch (e) {
      console.error(e);
      return new Response("Internal server error", { status: 500 });
    }
  };
}

function filterPosts(
  posts: Map<string, Post>,
  searchParams: URLSearchParams,
) {
  const tag = searchParams.get("tag");
  if (!tag) {
    return posts;
  }
  return new Map(
    Array.from(posts.entries()).filter(([, p]) => p.tags?.includes(tag)),
  );
}

function recordGetter(data: Record<string, unknown>) {
  return {
    get<T>(key: string): T | undefined {
      return data[key] as T;
    },
  };
}

/** Stable fallback so undated posts sort to the bottom, not "today". */
const MISSING_PUBLISH_DATE = new Date(0);

/**
 * Parse a front-matter `publish_date`.
 *
 * Accepts a `Date` (unquoted YAML) or an ISO / RFC 2822 string (quoted YAML).
 * Invalid or missing values log a warning and become 1970-01-01 so the post
 * does not jump to the top of the index every day.
 */
export function parsePublishDate(value: unknown, path: string): Date {
  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) {
      return value;
    }
    console.warn(`Invalid publish_date in ${path}: Invalid Date`);
    return MISSING_PUBLISH_DATE;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const fromNumber = new Date(value);
    if (!Number.isNaN(fromNumber.getTime())) {
      return fromNumber;
    }
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      const fromString = new Date(trimmed);
      if (!Number.isNaN(fromString.getTime())) {
        return fromString;
      }
    }
    console.warn(
      `Invalid publish_date in ${path}: ${JSON.stringify(value)}`,
    );
    return MISSING_PUBLISH_DATE;
  }
  if (value == null) {
    console.warn(
      `Missing publish_date in ${path}; sorting as 1970-01-01`,
    );
    return MISSING_PUBLISH_DATE;
  }
  console.warn(
    `Invalid publish_date in ${path}: ${JSON.stringify(value)}`,
  );
  return MISSING_PUBLISH_DATE;
}

function readingTime(text: string) {
  const wpm = 225;
  const words = text.split(/\s+/).length;
  return Math.ceil(words / wpm);
}
