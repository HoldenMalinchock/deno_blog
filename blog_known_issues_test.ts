// Punch-list tests for findings in docs/jsr-prepublish-review.md.
// Each test is ignored until the corresponding bug is fixed. Un-ignore
// one test per fix; do not delete the case.
//
// These encode the *desired* 1.0 behavior, not the current behavior.

import { configureBlog, createBlogHandler, redirects } from "./blog.tsx";
import { assertEquals, assertFalse, assertStringIncludes } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const TESTDATA = fromFileUrl(new URL("./testdata/", import.meta.url));
const CONN_INFO: Deno.ServeHandlerInfo = {
  completed: Promise.resolve(),
  remoteAddr: { transport: "tcp", hostname: "127.0.0.1", port: 8001 },
};

async function makeHandler(
  settings: Parameters<typeof configureBlog>[2] = {},
  url = join(TESTDATA, "my_blog.ts"),
) {
  const state = await configureBlog(url, false, {
    title: "Review blog",
    ...settings,
  });
  const handler = createBlogHandler(state);
  return (href: string) => handler(new Request(href), CONN_INFO);
}

Deno.test({
  name: "known issue: missing posts/ is an empty blog, not a throw",
  ignore: true,
  fn: async () => {
    const tmp = await Deno.makeTempDir({ prefix: "blog-noposts-" });
    const handler = await makeHandler(
      { title: "empty" },
      join(tmp, "main.tsx"),
    );
    const resp = await handler("https://blog.example/");
    assertEquals(resp.status, 200);
    const body = await resp.text();
    assertStringIncludes(body, "empty");
  },
});

Deno.test({
  name: "known issue: configureBlog does not leak posts across rootDirectory",
  ignore: true,
  fn: async () => {
    await makeHandler({ title: "testdata" });
    const custom = await makeHandler({
      title: "custom only",
      rootDirectory: join(TESTDATA, "customRootDir"),
    });
    const body = await (await custom("https://blog.example/")).text();
    assertStringIncludes(body, "Custom post");
    assertFalse(body.includes("First post"));
  },
});

Deno.test({
  name: "known issue: relative links must not crash the index",
  ignore: true,
  fn: async () => {
    const handler = await makeHandler({
      links: [{ title: "About", url: "/about" }],
    });
    const resp = await handler("https://blog.example/");
    assertEquals(resp.status, 200);
    const body = await resp.text();
    assertStringIncludes(body, 'href="/about"');
    assertStringIncludes(body, "About");
  },
});

Deno.test({
  name: "known issue: quoted publish_date strings are honored",
  ignore: false,
  fn: async () => {
    const tmp = await Deno.makeTempDir({ prefix: "blog-date-" });
    await Deno.mkdir(join(tmp, "posts"));
    await Deno.writeTextFile(
      join(tmp, "posts/quoted.md"),
      `---
title: Quoted date
publish_date: "2020-01-01"
---
hello
`,
    );
    const handler = await makeHandler({ title: "dates" }, join(tmp, "main.ts"));
    const body = await (await handler("https://blog.example/quoted")).text();
    assertStringIncludes(body, `datetime="2020-01-01`);
    assertFalse(body.includes(new Date().toISOString().slice(0, 10)));
  },
});

Deno.test({
  name: "known issue: Atom feed id/link is the site root, not /blog",
  ignore: true,
  fn: async () => {
    const handler = await makeHandler({ title: "Feed blog" });
    const feed = await (await handler("https://blog.example/feed")).text();
    assertStringIncludes(feed, "<id>https://blog.example/</id>");
    assertFalse(feed.includes("<id>https://blog.example/blog</id>"));
  },
});

Deno.test({
  name:
    "known issue: protocol-relative redirects stay on-origin (already patched)",
  ignore: false,
  fn: async () => {
    const handler = await makeHandler({
      middlewares: [redirects({ "/evil": "//evil.example" })],
    });
    const resp = await handler("https://blog.example/evil");
    assertEquals(resp.status, 307);
    const loc = resp.headers.get("location") ?? "";
    assertFalse(loc.startsWith("//"));
    assertFalse(loc.startsWith("http"));
  },
});
