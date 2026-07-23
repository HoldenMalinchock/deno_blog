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
export { Fragment, h } from "https://deno.land/x/htm@0.1.3/mod.ts";
export {
  default as html,
  type HtmlOptions,
  type VNode,
} from "https://deno.land/x/htm@0.1.3/html.tsx";
import UnoCSS from "https://deno.land/x/htm@0.1.3/plugins/unocss.ts";
import ColorScheme from "https://deno.land/x/htm@0.1.3/plugins/color-scheme.ts";

export {
  createReporter,
  type Reporter as GaReporter,
} from "https://deno.land/x/g_a@0.1.2/mod.ts";
export { default as callsites } from "https://raw.githubusercontent.com/kt3k/callsites/v1.0.0/mod.ts";
export { Feed, type Item as FeedItem } from "npm:feed@4.2.2";
export { default as removeMarkdown } from "npm:remove-markdown@0.6.4";

// Add syntax highlighting support for C by default
import "npm:prismjs@1.29.0/components/prism-c.js";

export { ColorScheme, UnoCSS };
export type UnoConfig = typeof UnoCSS extends (
  arg: infer P | undefined,
) => unknown ? P
  : never;
