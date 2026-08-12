# JSR 1.0.0 pre-publish review

**Target:** `@hmalinchock/blog@1.0.0` on `origin/main` (`de40544`) **Date:**
2026-08-12 **Runtime:** Deno 2.8.2 (V8 14.9.207.2, TypeScript 6.0.3) **Claim
reviewed:** the Deno 2 / JSR modernization “appears to work” and is ready to
publish as 1.0.0.

## Verdict

**Needs work before a 1.0.0 JSR publish.**

The in-repo happy path is real: tests pass, `deno check` / `lint` / `fmt` pass,
`deno publish --dry-run` succeeds, and a live `testdata/my_blog.ts` server
renders index, posts, math, tags, static files, and the Atom feed. That is not
the same as “safe to stamp 1.0.0.”

The only real app that already imports this library
(`/Users/holdenmalinchock/dev/blog`) **does not typecheck or run** against this
tree. Several public APIs crash or silently lie, the scaffold points at a JSR
package that 404s, and documented features (`ga()`, `theme: "light"`, quoted
`publish_date`, `createBlogHandler` styling) do not do what the README says.

Do not treat a green `deno task test` as a ship gate. Those tests never start
`Deno.serve`, never register UnoCSS, never call `init`, and never isolate the
global `POSTS` map. This review added coverage for 404 and `/fifth`; the rest is
still a hole.

## What was actually run

| Check                                        | Result                                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `deno task test`                             | **22 passed, 5 ignored** (was 19; added 404 + `/fifth` + known-issue punch list)               |
| `deno task check`                            | **ok** (`blog.tsx`, `init.ts` only)                                                            |
| `deno lint`                                  | **ok** (12 files; `testdata/` excluded)                                                        |
| `deno fmt --check`                           | **ok** (28 files)                                                                              |
| `deno publish --dry-run`                     | **ok** — would publish `@hmalinchock/blog@1.0.0`                                               |
| `deno task doc`                              | **fail** — 1392 `deno doc --lint` errors, almost all from re-exporting Preact `h` / `Fragment` |
| Live server (`testdata/my_blog.ts`)          | **ok** on `:8000` — HTML + UnoCSS + KaTeX render                                               |
| `GET https://jsr.io/@hmalinchock/blog`       | **404** — not published (`@hmalinchock` scope exists; only `alpaca` is live)                   |
| `cd ../blog && deno check main.tsx`          | **141 errors** — bare specifiers not in the consumer import map                                |
| `deno run … testdata/my_blog.ts --port 8765` | still binds **`:8000`** (`--port` is ignored)                                                  |

Probes that are **not** in `blog_test.ts` were run via a one-off script against
`configureBlog` / `createBlogHandler`. Reproductions are in
[Reproductions](#reproductions) and encoded as ignored tests in
`blog_known_issues_test.ts`.

## What works (verified)

- Deno 2 `Deno.serve` + `Deno.ServeHandlerInfo` replacement for the old std
  `serve` / `ConnInfo` path.
- JSR/npm import map. No remaining `https://deno.land/x/…` runtime imports in
  the library itself (footer still _links_ there).
- Index, post pages, trailing-slash 307, redirects, Chinese path, custom
  `pathname`, tag filter, plaintext `Accept: text/plain`, static files in root
  and `posts/`.
- KaTeX on `/fifth` (`katex-html` + `katex-mathml` present).
- Path traversal (`/../deno.json`) returns 404.
- Protocol-relative redirect `//evil.example` is rewritten to `/evil.example`
  (no open redirect).
- `init()` writes `main.tsx`, `deno.json`, and `posts/hello_world.md`.
- Publish include list is tight: source + vendor + license/readme. Tests and
  testdata stay out.

## Concerns (ranked)

### 1. HIGH — the real consumer (`dev/blog`) is broken; bare specifiers undid file-path use

`/Users/holdenmalinchock/dev/blog/deno.json` maps
`"blog": "../deno_blog/blog.tsx"` and does **not** copy this library’s import
map. `deno check main.tsx` there is 141 errors, starting with:

```text
TS2307: Import "@std/async" not a dependency and not in import map
  at deno_blog/blog.tsx:44
```

`deno run --allow-net --allow-read --allow-env main.tsx` dies on the same
specifier. PR #2 claimed “Local `dev/blog` typecheck against local package” —
that claim is false on this tree.

History:

- `e33b08c` pinned full `jsr:@std/…` / `npm:…` URLs “so consumers work via raw
  GitHub or `file:` imports.”
- `ddb9d3a` rewrote those to bare specifiers (`@std/async`, `feed`, `preact`)
  “for deno lint.”

JSR _will_ rewrite bare specifiers for registry consumers after publish (implied
by `deno publish --dry-run`, not executed). Anyone still on a `file:`, relative
path, or raw GitHub URL — including the blog this fork is for — must duplicate
the entire library import map. That is a 1.0 regression versus the pinned-URL
commit.

**Fix (pick one):**

- Restore fully-qualified `jsr:` / `npm:` specifiers in `deps.ts` / `blog.tsx` /
  `vendor/` (best for file/git consumers).
- Or document that consumers **must** `deno add jsr:@hmalinchock/blog` and
  cannot `file:`-import the repo. Update `dev/blog` to do that _after_ publish
  (or vendor the import map now so the live blog works today).

### 2. HIGH — `createBlogHandler` / `configureBlog` share one process-global `POSTS` map

`POSTS` is a module-level `Map` in `blog.tsx`. `loadContent()` never clears it.
Every `configureBlog()` call merges into the same map and prints
`Duplicate blog post path: …`.

Consequences:

- Two configured blogs in one process (tests, embeds, `rootDirectory` swaps)
  leak posts into each other.
- The existing `custom root directory` test only asserts `/custom` exists. It
  does **not** assert that `/first` is gone. After that test runs, both trees
  live in `POSTS`.
- HMR `watchForChanges` never handles `remove`, so deleted posts stay served
  until process restart.

This is load-bearing for the **public** `configureBlog` + `createBlogHandler`
API advertised in the README.

**Fix:** put posts on `BlogState`. Clear (or replace) on load. Handle watcher
`remove`.

### 3. HIGH — missing `posts/` directory crashes startup

`walk(join(blogDirectory, "posts"))` is unguarded. `configureBlog()` on a
directory without `posts/` throws:

```text
No such file or directory (os error 2): stat '…/posts'
```

`init` creates `posts/`, but any consumer who deletes it, points `rootDirectory`
at an empty folder, or calls `configureBlog` before scaffolding, gets an
uncaught startup failure instead of an empty blog.

**Fix:** if `posts/` is missing, create it or treat it as empty and log a
warning.

### 4. HIGH — `links` with a relative or invalid URL 500s the entire index

`components.tsx` does `new URL(link.url)` with no base and no try/catch.
Verified:

| `links[].url` | Result                            |
| ------------- | --------------------------------- |
| `/about`      | throws `Invalid URL: '/about'`    |
| `not a url`   | throws `Invalid URL: 'not a url'` |

`blog()`’s `onError` turns that into a 500 for `/`. Absolute `https://` and
`mailto:` work (demo).

**Fix:** `new URL(link.url, "https://example.invalid")` or catch and fall back
to the generic icon.

### 5. HIGH — `publish_date` only accepts a YAML _Date_ object

```ts
publishDate: data.get("publish_date") instanceof Date
  ? data.get("publish_date")!
  : new Date(),
```

Verified against `@std/front-matter`:

| Front matter                                 | Stored date                                    |
| -------------------------------------------- | ---------------------------------------------- |
| omitted                                      | **now**                                        |
| `publish_date: not-a-date`                   | **now**                                        |
| `publish_date: "2020-01-01"` (quoted string) | **now**                                        |
| `publish_date: 2020-01-01` (unquoted)        | 2020-01-01 (works; this is what testdata uses) |

Quoted ISO strings are the common case in Markdown tutorials. Those posts
silently jump to the top of the index and the feed every day. The source comment
even admits this: “no error when publish_date is wrong or missed.”

**Fix:** if the value is a `Date`, use it; if it is a string, `new Date(value)`
and reject `Invalid Date` with a warning; do not default to `now` for sorting.

### 6. HIGH — `ga()` is Universal Analytics, not GA4

The README and `init` template tell people to pass `G-XXXXXXXXXX`. The vendored
reporter POSTs to `https://www.google-analytics.com/collect` with `v=1` / `tid`
/ `t=pageview` (UA Measurement Protocol). UA collection is dead. The `init`
comment still says `ga("UA-XXXXXXXX-X")`.

This is not “best-effort analytics.” It is a documented middleware that will not
record GA4 pageviews.

**Fix:** implement GA4 MP (`/mp/collect` + measurement id + api secret), or mark
`ga()` deprecated and remove it from the 1.0 README/init examples.

### 7. HIGH — `createBlogHandler` does not apply theme / UnoCSS

`html.use(UnoCSS(…))` and `html.use(ColorScheme(…))` run only inside `blog()`.
Tests and any embedder using the documented `configureBlog` +
`createBlogHandler` path get unstyled HTML.

The live `blog()` server _does_ inject reset CSS + generated UnoCSS + the
color-scheme script (verified on `:8000`). That path is not what `blog_test.ts`
exercises.

Also: `html.use()` **appends** to a module-level plugin list. A second `blog()`
call in the same isolate would duplicate CSS.

**Fix:** register plugins in `configureBlog` / `createBlogHandler`
(idempotently), not as a `blog()` side effect.

### 8. MEDIUM — Atom feed `id` / `link` point at `/blog`, which 404s

```ts
id: `${origin}/blog`,
link: `${origin}/blog`,
```

Verified live: feed contains `<id>http://localhost:8000/blog</id>` and
`<link rel="alternate" href="http://localhost:8000/blog"/>`. `GET /blog` is
**404**. Feed items themselves are correct (`/first`, `/fifth`, …).
`favicon.ico` is also referenced and 404s unless the user adds one.

Pre-existing, but this is a new 1.0 package — do not ship a feed that disagrees
with the site.

**Fix:** use `origin/` (or `canonicalUrl`) for feed `id`/`link`. Only emit
favicon if configured.

### 9. MEDIUM — `theme: "light"` is treated as `"auto"`

```ts
html.use(ColorScheme(settings?.theme == "dark" ? "dark" : "auto"));
```

Light blogs still get the auto dark-mode script and `localStorage` override.
Forced light is not implemented.

### 10. MEDIUM — `IconX` is a 100×100 path in a 20×20 viewBox

`components.tsx` `IconX` uses `viewBox="0 0 20 20"` with path coordinates up to
`~103`. The glyph is clipped out of frame. `fill="black"` also ignores
`currentColor`, so it would be wrong in dark mode even if scaled. `x.com` links
in `BlogSettings.links` get a blank icon.

### 11. MEDIUM — `init` / README advertise a JSR package that 404s

`GET https://jsr.io/@hmalinchock/blog` is 404. Scaffolded `deno.json` pins
`jsr:@hmalinchock/blog@^1.0.0`. That is correct _after_ publish and a broken
first-run _until_ publish.

Also:

- `init` uses interactive `confirm()` on non-empty dirs and has no `--force`.
- `init` is untested.
- Footer still says “Powered by Deno Blog” → `https://deno.land/x/blog`.

Publish the library **before** telling anyone to run
`deno run -A jsr:@hmalinchock/blog/init`.

### 12. MEDIUM — JSR docs score will be poor

`deno task doc` (`deno doc --lint blog.tsx init.ts`) dies with **1392** errors
because public `h` / `Fragment` re-exports leak Preact private types
(`ClassAttributes`, `VNode`, JSX intrinsic maps, …).

`deno publish --dry-run` still succeeds (slow-types check is separate). JSR’s
generated docs / score will not match the README badges’ implication of a
polished 1.0.

**Fix:** wrap or type-erase the `h` / `Fragment` re-exports, or stop
re-exporting Preact’s types. Do not leave `deno task doc` in `deno.json` as if
it were green.

### 13. LOW — config / CLI leftovers

- Dual `deno.json` + `jsr.json` with copied `name` / `version` / `exports` /
  `publish.include`. Drift risk. Deno 2 can publish from `deno.json` alone —
  drop `jsr.json`.
- `compilerOptions.lib` includes `deno.unstable`. Nothing here needs unstable
  (`Deno.serve`, `watchFs`, `upgradeWebSocket` are stable in 2.8).
- `deno task check` does not typecheck `components.tsx`, `blog_test.ts`, or
  `vendor/`.
- `--port` on the CLI is ignored. Only `settings.port` works. Tasks should not
  imply otherwise.
- HMR client uses `origin.replace("http", "ws")`, which only works because
  `"https".replace("http", "ws") === "wss"`. Fragile.
- `watchForChanges(…).catch(() => {})` swallows watcher setup failures.
- Nested `<p>` in `PostPage` author block (invalid HTML).
- Footer `author` argument is unused (`_props`).
- `cover_html` is `dangerouslySetInnerHTML` with no sanitization (by design, but
  it is XSS if front matter is untrusted).
- testdata / README examples still mention `https://deno.land/x/blog`.

## Test coverage that is missing

`blog_test.ts` is a solid HTTP snapshot suite for the original library. It does
**not** cover the Deno 2 / JSR work:

- `blog()` / `Deno.serve` / `--dev` HMR / `watchFs`
- `init.ts` (the second export you are about to publish)
- `ga()`
- `/fifth` math rendering
- 404 body/status (live server returns 404; untested)
- missing `posts/`
- quoted / invalid `publish_date`
- relative `links`
- POSTS isolation / duplicate-path reload
- feed `id` / `link`
- `theme: "light"`
- `x.com` icon
- `html.use` plugin registration

`--allow-net` is granted to tests but unused except what `serveDir` might touch.
The suite can stay green while `blog()` is completely broken.

## JSR publish checklist

Do these before `deno publish` or tagging `v1.0.0`:

1. Fix or explicitly accept findings 1–7. Shipping a 1.0 that cannot be
   `file:`-imported by your own blog, 500s on `/about` links, and invents
   publish dates is how you burn the version number.
2. Decide version: keep `1.0.0` only if the HIGH items are fixed or documented
   as known limitations. Otherwise publish `0.8.0` or `1.0.0-rc.1`.
3. `@hmalinchock` already exists on JSR. Confirm GitHub OIDC (`id-token: write`
   in `publish.yml`) is linked for this repo.
4. Publish **then** tell people to `deno add jsr:@hmalinchock/blog` /
   `deno run -A jsr:@hmalinchock/blog/init`.
5. Drop duplicate `jsr.json` or add a test that the two manifests stay
   identical.
6. Either make `deno task doc` pass or stop advertising it.
7. Smoke-test a _fresh_ scaffold against the published spec, not `file:` / this
   repo.
8. Smoke-test Deno Deploy v2 with the generated `serve` task (called out as
   unchecked on PR #1 / #2).

## Suggested fix order

1. Restore fully-qualified `jsr:`/`npm:` specifiers **or** stop advertising
   `file:` imports and fix `dev/blog` to use the published package.
2. Isolate posts on `BlogState`; clear on load.
3. Empty/`posts/` missing → empty blog, not throw.
4. Parse string dates; warn on invalid.
5. Harden `links` URL parsing.
6. Register UnoCSS / color scheme in `createBlogHandler`.
7. Feed `id`/`link` → site root; footer → this package.
8. Fix or remove `ga()` and `IconX`.
9. Honor `theme: "light"`.
10. Tests for the above (un-ignore `blog_known_issues_test.ts`).
11. Then publish.

## Reproductions

All of these were executed on 2026-08-12 against this tree.

**Global POSTS / missing posts / dates / links / feed** — see
`blog_known_issues_test.ts` (currently `ignore: true` so CI stays green).
Un-ignore a test after the corresponding fix.

**Sibling blog (file: consumer)**

```sh
cd ../blog
deno check main.tsx
# TS2307: Import "@std/async" not a dependency … (141 errors)
```

**Live server**

```sh
deno run --allow-net --allow-read --allow-env testdata/my_blog.ts
# Listening on http://0.0.0.0:8000/  (--port is ignored)
curl -sI http://localhost:8000/feed          # 200 atom
curl -sI http://localhost:8000/blog          # 404
curl -sI http://localhost:8000/favicon.ico   # 404
curl -sI http://localhost:8000/fifth         # 200, KaTeX in body
```

**`--port` ignored**

```sh
deno run --allow-net --allow-read --allow-env testdata/my_blog.ts --port 8765
# still: Listening on http://0.0.0.0:8000/
```

**JSR**

```sh
curl -sI https://jsr.io/@hmalinchock/blog   # 404
```
