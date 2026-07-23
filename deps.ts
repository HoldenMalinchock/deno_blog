// Copyright 2022 the Deno authors. All rights reserved. MIT license.

export { serveDir } from "jsr:@std/http@^1.0.21/file-server";
export { walk, type WalkEntry } from "jsr:@std/fs@^1.0.19/walk";
export {
  dirname,
  fromFileUrl,
  join,
  relative,
} from "jsr:@std/path@^1.1.6";
export { extract as frontMatter } from "jsr:@std/front-matter@^1.0.9/any";

export * as gfm from "jsr:@deno/gfm@^0.12.0";
export { Fragment, h } from "./vendor/htm/mod.ts";
export {
  default as html,
  type HtmlOptions,
  type VNode,
} from "./vendor/htm/html.tsx";
import UnoCSS from "./vendor/htm/plugins/unocss.ts";
import ColorScheme from "./vendor/htm/plugins/color-scheme.ts";

export {
  createReporter,
  type Reporter as GaReporter,
} from "./vendor/g_a/mod.ts";
export { default as callsites } from "./vendor/callsites/mod.ts";
export { Feed, type Item as FeedItem } from "npm:feed@4.2.2";
export { default as removeMarkdown } from "npm:remove-markdown@0.6.4";

// Add syntax highlighting support for C by default
import "npm:prismjs@1.29.0/components/prism-c.js";

export { ColorScheme, UnoCSS };

/**
 * Configuration object accepted by the UnoCSS HTML plugin.
 */
export type UnoConfig = Parameters<typeof UnoCSS>[0];
