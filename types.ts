// Copyright 2022 the Deno authors. All rights reserved. MIT license.

/**
 * Shared types for `@hmalinchock/blog`.
 *
 * @module
 */

import type { UnoConfig } from "./deps.ts";

/**
 * Opaque JSX node used for custom headers, footers, sections, and link icons.
 *
 * Kept as `unknown` so the public API does not leak Preact's private types
 * into JSR documentation.
 */
export type HtmlChild = unknown;

/** Request context passed to {@linkcode BlogMiddleware}. */
export interface BlogContext {
  /** Current blog state (settings + content directory). */
  state: BlogState;
  /** Deno serve connection info. */
  connInfo: Deno.ServeHandlerInfo;
  /** Invoke the next middleware / handler in the chain. */
  next: () => Promise<Response>;
}

/** Middleware function that can intercept or wrap blog responses. */
export interface BlogMiddleware {
  (req: Request, ctx: BlogContext): Promise<Response>;
}

/** Formats a {@linkcode Date} for display in the blog UI. */
export type DateFormat = (date: Date) => string;

/** User-facing configuration for {@linkcode blog}. */
export interface BlogSettings {
  /** The blog title */
  title?: string;
  /** The blog description */
  description?: string;
  /** URL to avatar. Can be relative. */
  avatar?: string;
  /** CSS classes to use with the avatar. */
  avatarClass?: string;
  /** URL to background cover. Can be relative. */
  cover?: string;
  /** Color of the text that goes on the background cover. */
  coverTextColor?: string;
  /** The author of the blog. Can be overridden by respective post settings. */
  author?: string;
  /** Social links */
  links?: {
    /** The link title */
    title: string;
    /** The link */
    url: string;
    /** The element to use as the icon of the link */
    icon?: HtmlChild;
    /** The link target */
    target?: "_self" | "_blank" | "_parent" | "_top";
  }[];
  /** The element to use as header */
  header?: HtmlChild;
  /** Whether to show the header on post pages */
  showHeaderOnPostPage?: boolean;
  /** The element to use as section. Access to Post props. */
  section?: (post: Post) => HtmlChild;
  /** The element to use as footer */
  footer?: HtmlChild;
  /** Custom CSS */
  style?: string;
  /** URL to open graph image. Can be relative. */
  ogImage?: string | {
    url: string;
    twitterCard: "summary" | "summary_large_image" | "app" | "player";
  };
  /** Functions that are called before rendering and can modify the content or make other changes. */
  middlewares?: BlogMiddleware[];
  /** The ISO code of the language the blog is in */
  lang?: string;
  /** Date appearance */
  dateFormat?: DateFormat;
  /** The canonical URL of the blog */
  canonicalUrl?: string;
  /** UnoCSS configuration */
  unocss?: UnoConfig;
  /**
   * Color scheme.
   *
   * - `"dark"` — always dark
   * - `"light"` — always light (no prefers-color-scheme script)
   * - `"auto"` (default) — follow the OS, overridable via `localStorage`
   */
  theme?: "dark" | "light" | "auto";
  /**
   * URL to favicon. Can be relative.
   * Supports dark and light mode variants through "prefers-color-scheme".
   */
  favicon?: string | { light?: string; dark?: string };
  /** The port to serve the blog on */
  port?: number;
  /** The hostname to serve the blog on */
  hostname?: string;
  /** Whether to display readtime or not */
  readtime?: boolean;
  /** The root directory of the blog contents */
  rootDirectory?: string;
}

/** Runtime blog state after configuration (settings + content directory). */
export interface BlogState extends BlogSettings {
  /** Absolute path to the blog root (contains `posts/`). */
  directory: string;
}

/** Represents a Post in the Blog. */
export interface Post {
  /** URL pathname for the post (e.g. `/hello-world`). */
  pathname: string;
  /** Raw Markdown body (without front matter). */
  markdown: string;
  /** Post title from front matter. */
  title: string;
  /** Publish date from front matter. */
  publishDate: Date;
  /** Optional author override for this post. */
  author?: string;
  /** Short summary used on the index and in feeds. */
  snippet?: string;
  /** Optional HTML cover inserted above the post body. */
  coverHtml?: string;
  /** An image URL which is used in the OpenGraph og:image tag. */
  ogImage?: string;
  /** Optional tags from front matter. */
  tags?: string[];
  /** Whether embedded iframes are allowed in this post. */
  allowIframes?: boolean;
  /** Disable HTML sanitization for this post (use carefully). */
  disableHtmlSanitization?: boolean;
  /** Estimated reading time in minutes. */
  readTime: number;
  /** Whether math rendering is enabled for this post. */
  renderMath?: boolean;
}
