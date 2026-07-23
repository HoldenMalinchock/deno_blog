# @hmalinchock/blog

[![JSR](https://jsr.io/badges/@hmalinchock/blog)](https://jsr.io/@hmalinchock/blog)
[![JSR Score](https://jsr.io/badges/@hmalinchock/blog/score)](https://jsr.io/@hmalinchock/blog/score)

Minimal boilerplate blogging for **Deno 2** and **Deno Deploy**.

All you need is a small entry file:

```ts
import blog from "@hmalinchock/blog";

blog({
  title: "My Blog",
  description: "Thoughts and notes.",
  author: "You",
});
```

Write posts as Markdown in a `posts/` directory next to that file.

## Install

```sh
deno add jsr:@hmalinchock/blog
```

Or pin in `deno.json`:

```json
{
  "imports": {
    "@hmalinchock/blog": "jsr:@hmalinchock/blog@^1.0.0"
  }
}
```

## Getting started (scaffold)

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

| Task | Description |
|------|-------------|
| `deno task dev` | Local server with live reload (`--watch` + `--dev`) |
| `deno task serve` | Production-style serve (Deno Deploy friendly) |

## Configuration

```ts
import blog, { ga, redirects } from "@hmalinchock/blog";

blog({
  author: "Dino",
  title: "My Blog",
  description: "The blog description.",
  avatar: "avatar.png",
  avatarClass: "rounded-full",
  links: [
    { title: "Email", url: "mailto:bot@deno.com" },
    { title: "GitHub", url: "https://github.com/denobot" },
  ],
  lang: "en",
  dateFormat: (date) =>
    new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(date),
  middlewares: [
    ga("G-XXXXXXXXXX"),
    redirects({
      "/foo": "/my_post",
      bar: "my_post2",
    }),
  ],
  favicon: "favicon.ico",
});
```

## Custom header / footer

Use a `.tsx` entry file:

```tsx
/** @jsx h */
import blog, { h } from "@hmalinchock/blog";

blog({
  title: "My Blog",
  header: <header>Your custom header</header>,
  showHeaderOnPostPage: true,
  section: (post) => (
    <section>Custom section for {post.title}</section>
  ),
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

## API

| Export | Description |
|--------|-------------|
| `blog(settings?)` | Start the blog server |
| `configureBlog(url, isDev, settings?)` | Load posts and build state |
| `createBlogHandler(state)` | Request handler without listening |
| `ga(key)` | Google Analytics middleware |
| `redirects(map)` | Path redirect middleware |
| `h` / `Fragment` | JSX helpers for custom UI |

## License

MIT — based on the original [denoland/deno_blog](https://github.com/denoland/deno_blog) library.
