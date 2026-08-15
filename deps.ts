// Copyright 2022 the Deno authors. All rights reserved. MIT license.

export { serveDir } from "@std/http/file-server";
export { walk, type WalkEntry } from "@std/fs/walk";
export { dirname, fromFileUrl, join, relative } from "@std/path";
export { extract as frontMatter } from "@std/front-matter/any";

export * as gfm from "@deno/gfm";
export { Fragment, h } from "./vendor/htm/mod.ts";
export {
  default as html,
  type HtmlOptions,
  type VNode,
} from "./vendor/htm/html.tsx";
import UnoCSS from "./vendor/htm/plugins/unocss.ts";
import ColorScheme from "./vendor/htm/plugins/color-scheme.ts";

export { default as callsites } from "./vendor/callsites/mod.ts";
export { Feed, type Item as FeedItem } from "feed";
export { default as removeMarkdown } from "remove-markdown";

// Add syntax highlighting support for C by default
import "prismjs/components/prism-c.js";

export { ColorScheme, UnoCSS };

/**
 * Configuration object accepted by the UnoCSS HTML plugin.
 *
 * Typed as a generic record so public docs do not leak UnoCSS private types.
 */
export type UnoConfig = Record<string, unknown>;
