# @hmalinchock/blog

[![JSR](https://jsr.io/badges/@hmalinchock/blog)](https://jsr.io/@hmalinchock/blog)
[![JSR Score](https://jsr.io/badges/@hmalinchock/blog/score)](https://jsr.io/@hmalinchock/blog/score)

Minimal boilerplate blogging for **Deno 2** and **Deno Deploy**.

Write Markdown in a `posts/` folder, add a few lines of TypeScript, and you have
a site:

```ts
import blog from "@hmalinchock/blog";

blog({
  title: "My Blog",
  description: "Thoughts and notes.",
  author: "You",
});
```

## Why this fork

[denoland/deno_blog](https://github.com/denoland/deno_blog) was one of the first
public demos of what Deno could do — a tiny library, from the people who built
the runtime, that turned a folder of Markdown into a real site on Deno Deploy.
It showed the pitch: no `node_modules` ritual, TypeScript that just ran, and
hosting that felt like saving a file.

The upstream repo has been quiet for a long time. I still use this library for
my own writing, and I did not want it stranded on Deno 1, `deno.land/x`, and
Universal Analytics. This fork is that library brought back to life:

- Deno 2 (`Deno.serve`, JSR / npm specifiers, current `@std`)
- Published as **`jsr:@hmalinchock/blog`**
- Same idea as the original: one entry file, a `posts/` directory, done

It remains MIT-licensed and is still based on the Deno authors' code. I am not
replacing that history — I am keeping a tool I rely on able to run on the Deno
that exists now.

## Getting started

```sh
deno run -A jsr:@hmalinchock/blog/init ./my_blog
cd my_blog
deno task dev
```

That creates:

- `main.tsx` — blog entrypoint
- `deno.json` — tasks + import map
- `posts/hello_world.md` — first post

### Tasks

| Task              | Description                                         |
| ----------------- | --------------------------------------------------- |
| `deno task dev`   | Local server with live reload (`--watch` + `--dev`) |
| `deno task serve` | Production-style serve (Deno Deploy friendly)       |

Port is `settings.port` (default 8000). A CLI `--port` flag is **not** read.

## Configuration

```ts
import blog, { ga, redirects } from "@hmalinchock/blog";

blog({
  author: "Dino",
  title: "My Blog",
  description: "The blog description.",
  avatar: "avatar.png",
  avatarClass: "rounded-full",
  theme: "auto", // "light" | "dark" | "auto"
  links: [
    { title: "Email", url: "mailto:bot@deno.com" },
    { title: "GitHub", url: "https://github.com/denobot" },
  ],
  lang: "en",
  dateFormat: (date) =>
    new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(date),
  middlewares: [
    ga("G-XXXXXXXXXX"), // GA4 Measurement ID, not a UA- property
    redirects({
      "/foo": "/my_post",
      bar: "my_post2",
    }),
  ],
  favicon: "favicon.ico",
});
```

### Theme

| `theme`   | Behavior                                                      |
| --------- | ------------------------------------------------------------- |
| `"auto"`  | Follow `prefers-color-scheme`; overridable via `localStorage` |
| `"light"` | Always light — no dark-mode script                            |
| `"dark"`  | Always dark                                                   |

### Analytics

`ga()` injects the official **gtag.js** snippet for a GA4 Measurement ID
(`G-XXXXXXXXXX`). Universal Analytics (`UA-…`) was shut down in 2023; those keys
log a warning and are ignored.

## Custom header / footer

Use a `.tsx` entry file:

```tsx
/** @jsx h */
import blog, { h } from "@hmalinchock/blog";

blog({
  title: "My Blog",
  header: <header>Your custom header</header>,
  showHeaderOnPostPage: true,
  section: (post) => <section>Custom section for {post.title}</section>,
  footer: <footer>Your custom footer</footer>,
});
```

## Post front matter

```md
---
title: Hello world!
publish_date: 2026-07-22
author: You
snippet: Optional summary for the index and feed.
tags:
  - deno
  - blog
---

Markdown body goes here.
```

`publish_date` may be an unquoted YAML date (`2026-07-22`) or a quoted ISO
string (`"2026-07-22"`). Both are honored. Missing or unparseable dates log a
warning and sort as 1970-01-01 so the post does not float to the top of the
index every day.

Other useful fields: `pathname`, `abstract` / `summary` / `description` (used if
`snippet` is omitted), `cover_html`, `og:image`, `tags`, `allow_iframes`,
`disable_html_sanitization`, `render_math`.

## Hosting with Deno Deploy

1. Push your project to GitHub.
2. Create a Deno Deploy project and link the repo.
3. Use the **`serve`** task (`deno task serve`).
4. Deploy to a public `$project.deno.dev` subdomain.

## Permissions

Typical run permissions:

```sh
deno run --allow-net --allow-read --allow-env main.tsx
```

`--allow-net` is required for the server (and for gtag's browser requests, which
do not need a Deno permission). `--allow-read` loads posts and static files.
`--allow-env` is reserved for future host integration.

## API

| Export                                 | Description                                     |
| -------------------------------------- | ----------------------------------------------- |
| `blog(settings?)`                      | Start the blog server                           |
| `configureBlog(url, isDev, settings?)` | Load posts and build state                      |
| `createBlogHandler(state)`             | Request handler without listening               |
| `ga(key)`                              | GA4 gtag middleware (`G-XXXXXXXXXX`)            |
| `redirects(map)`                       | Path redirect middleware                        |
| `h` / `Fragment`                       | JSX helpers for custom UI                       |
| `parsePublishDate(value, path)`        | Front-matter date parser                        |
| `resolveColorScheme(theme)`            | Maps `theme` to `"light"` / `"dark"` / `"auto"` |

## License

MIT — based on the original
[denoland/deno_blog](https://github.com/denoland/deno_blog) library by the Deno
authors.
