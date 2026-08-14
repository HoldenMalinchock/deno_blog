// Copyright 2022 the Deno authors. All rights reserved. MIT license.

import {
  configureBlog,
  createBlogHandler,
  ga,
  parsePublishDate,
  redirects,
  resolveColorScheme,
} from "./blog.tsx";
import {
  assert,
  assertEquals,
  assertFalse,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const BLOG_URL = new URL("./testdata/main.js", import.meta.url).href;
const TESTDATA_PATH = fromFileUrl(new URL("./testdata/", import.meta.url));
const BLOG_SETTINGS = await configureBlog(BLOG_URL, false, {
  author: "The author",
  title: "Test blog",
  description: "This is some description.",
  lang: "en-GB",
  middlewares: [
    redirects({
      "/to_second": "second",
      "/to_second_with_slash": "/second",
      "/external_redirect": "https://example.com",
      "second.html": "second",
    }),
  ],
  readtime: true,
});
const CONN_INFO: Deno.ServeHandlerInfo = {
  completed: Promise.resolve(),
  remoteAddr: {
    transport: "tcp" as const,
    hostname: "0.0.0.0",
    port: 8001,
  },
};

const blogHandler = createBlogHandler(BLOG_SETTINGS);
const testHandler = (req: Request): Response | Promise<Response> => {
  return blogHandler(req, CONN_INFO);
};

Deno.test("index page", async () => {
  const resp = await testHandler(new Request("https://blog.deno.dev"));
  assert(resp);
  assertEquals(resp.status, 200);
  assertEquals(resp.headers.get("content-type"), "text/html; charset=utf-8");
  const body = await resp.text();
  assertStringIncludes(body, `<html lang="en-GB">`);
  assertStringIncludes(
    body,
    `<link rel="canonical" href="https://blog.deno.dev/"/>`,
  );
  assertStringIncludes(body, `Test blog`);
  assertStringIncludes(body, `This is some description.`);
  assertStringIncludes(body, `href="/first"`);
  assertStringIncludes(body, `href="/second"`);
});

Deno.test("posts/ first", async () => {
  const resp = await testHandler(new Request("https://blog.deno.dev/first"));
  assert(resp);
  assertEquals(resp.status, 200);
  assertEquals(resp.headers.get("content-type"), "text/html; charset=utf-8");
  const body = await resp.text();
  assertStringIncludes(body, `<html lang="en-GB">`);
  assertStringIncludes(
    body,
    `<link rel="canonical" href="https://blog.deno.dev/first"/>`,
  );
  assertStringIncludes(body, `First post`);
  assertStringIncludes(body, `The author`);
  assertStringIncludes(body, `<time datetime="2022-03-20T00:00:00.000Z">`);
  assertStringIncludes(body, `<img src="first/hello.png" />`);
  assertStringIncludes(body, `<p>Lorem Ipsum is simply dummy text`);
  assertStringIncludes(body, `$100, $200, $300, $400, $500`);
  assertStringIncludes(body, `min read`);
});

Deno.test("posts/ first (check canonical with params)", async () => {
  const resp = await testHandler(
    new Request("https://blog.deno.dev/first?foo=bar"),
  );
  assert(resp);
  assertEquals(resp.status, 200);
  assertEquals(resp.headers.get("content-type"), "text/html; charset=utf-8");
  const body = await resp.text();
  assertStringIncludes(
    body,
    `<link rel="canonical" href="https://blog.deno.dev/first"/>`,
  );
});

Deno.test("posts/ second", async () => {
  const resp = await testHandler(new Request("https://blog.deno.dev/second"));
  assert(resp);
  assertEquals(resp.status, 200);
  assertEquals(resp.headers.get("content-type"), "text/html; charset=utf-8");
  const body = await resp.text();
  assertStringIncludes(body, `<html lang="en-GB">`);
  assertStringIncludes(
    body,
    `<link rel="canonical" href="https://blog.deno.dev/second"/>`,
  );
  assertStringIncludes(body, `Second post`);
  assertStringIncludes(body, `CUSTOM AUTHOR NAME`);
  assertStringIncludes(body, `<time datetime="2022-05-02T00:00:00.000Z">`);
  assertStringIncludes(body, `<img src="second/hello2.png" />`);
  assertStringIncludes(body, `<p>Lorem Ipsum is simply dummy text`);
});

Deno.test("posts/ third", async () => {
  const resp = await testHandler(new Request("https://blog.deno.dev/third"));
  assert(resp);
  assertEquals(resp.status, 200);
  assertEquals(resp.headers.get("content-type"), "text/html; charset=utf-8");
  const body = await resp.text();
  assertStringIncludes(body, `<html lang="en-GB">`);
  assertStringIncludes(
    body,
    `<link rel="canonical" href="https://blog.deno.dev/third"/>`,
  );
  assertStringIncludes(body, `Third post`);
  assertStringIncludes(body, `CUSTOM AUTHOR NAME`);
  assertStringIncludes(body, `<time datetime="2022-08-19T00:00:00.000Z">`);
  assertStringIncludes(body, `<iframe width="560" height="315"`);
  assertStringIncludes(body, `<p>Lorem Ipsum is simply dummy text`);
});

Deno.test("posts/ fourth", async () => {
  const resp = await testHandler(new Request("https://blog.deno.dev/fourth"));
  assert(resp);
  assertEquals(resp.status, 200);
  assertEquals(resp.headers.get("content-type"), "text/html; charset=utf-8");
  const body = await resp.text();
  assertStringIncludes(body, `<html lang="en-GB">`);
  assertStringIncludes(
    body,
    `<link rel="canonical" href="https://blog.deno.dev/fourth"/>`,
  );
  assertStringIncludes(body, `Fourth post`);
  assertStringIncludes(
    body,
    `<time datetime="2023-01-30T00:00:00.000Z">`,
  );
  assertStringIncludes(
    body,
    `<button onclick="alert('hi!')">Click me!!!!!!</button>`,
  );
});

Deno.test("posts/ seventh", async () => {
  const resp = await testHandler(
    new Request("https://blog.deno.dev/uses-pathname"),
  );
  assert(resp);
  assertEquals(resp.status, 200);
  assertEquals(resp.headers.get("content-type"), "text/html; charset=utf-8");
  const body = await resp.text();
  assertStringIncludes(body, `<html lang="en-GB">`);
  assertStringIncludes(
    body,
    `<link rel="canonical" href="https://blog.deno.dev/uses-pathname"/>`,
  );
  assertStringIncludes(body, `seventh post`);
  assertStringIncludes(body, `<time datetime="2022-05-02T00:00:00.000Z">`);
  assertStringIncludes(body, `<p>Lorem Ipsum is simply dummy text`);
});

Deno.test("posts/ 中文", async () => {
  const resp = await testHandler(new Request("https://blog.deno.dev/中文"));
  assert(resp);
  assertEquals(resp.status, 200);
  assertEquals(resp.headers.get("content-type"), "text/html; charset=utf-8");
  const body = await resp.text();
  assertStringIncludes(body, `<html lang="en-GB">`);
  assertStringIncludes(
    body,
    `<link rel="canonical" href="https://blog.deno.dev/%E4%B8%AD%E6%96%87"/>`,
  );
  assertStringIncludes(body, `中文`);
  assertStringIncludes(body, `<p>你好，世界！`);
});

Deno.test("posts/ sixth", async () => {
  const resp = await testHandler(new Request("https://blog.deno.dev/sixth"));
  assert(resp);
  assertEquals(resp.status, 200);
  assertEquals(resp.headers.get("content-type"), "text/html; charset=utf-8");
  const body = await resp.text();
  assertStringIncludes(
    body,
    `<a class="text-bluegray-500 font-bold" href="/?tag=sample">#sample</a>`,
  );
  assertStringIncludes(
    body,
    `<a class="text-bluegray-500 font-bold" href="/?tag=tags">#tags</a>`,
  );
  assertStringIncludes(body, `<html lang="en-GB">`);
  assertStringIncludes(
    body,
    `<link rel="canonical" href="https://blog.deno.dev/sixth"/>`,
  );
  assertStringIncludes(body, `Sixth post`);
  assertStringIncludes(body, `<time datetime="2023-08-17T00:00:00.000Z">`);
  assertStringIncludes(body, `Tags make it easier for readers`);
});

Deno.test("posts/ trailing slash redirects", async () => {
  const resp = await testHandler(new Request("https://blog.deno.dev/second/"));
  assert(resp);
  assertEquals(resp.status, 307);
  assertEquals(resp.headers.get("location"), "https://blog.deno.dev/second");
  await resp.text();
});

Deno.test("external redirects", async () => {
  const resp = await testHandler(
    new Request("https://blog.deno.dev/external_redirect"),
  );
  assert(resp);
  assertEquals(resp.status, 307);
  assertEquals(resp.headers.get("location"), "https://example.com");
  await resp.text();
});

Deno.test("redirect map", async () => {
  {
    const resp = await testHandler(
      new Request("https://blog.deno.dev/second.html"),
    );
    assert(resp);
    assertEquals(resp.status, 307);
    assertEquals(resp.headers.get("location"), "/second");
    await resp.text();
  }
  {
    const resp = await testHandler(
      new Request("https://blog.deno.dev/to_second"),
    );
    assert(resp);
    assertEquals(resp.status, 307);
    assertEquals(resp.headers.get("location"), "/second");
    await resp.text();
  }
  {
    const resp = await testHandler(
      new Request("https://blog.deno.dev/to_second_with_slash"),
    );
    assert(resp);
    assertEquals(resp.status, 307);
    assertEquals(resp.headers.get("location"), "/second");
    await resp.text();
  }
});

Deno.test("static files in posts/ directory", async () => {
  {
    const resp = await testHandler(
      new Request("https://blog.deno.dev/first/hello.png"),
    );
    assert(resp);
    assertEquals(resp.status, 200);
    assertEquals(resp.headers.get("content-type"), "image/png");
    const bytes = new Uint8Array(await resp.arrayBuffer());
    assertEquals(
      bytes,
      await Deno.readFile(join(TESTDATA_PATH, "./posts/first/hello.png")),
    );
  }
  {
    const resp = await testHandler(
      new Request("https://blog.deno.dev/second/hello2.png"),
    );
    assert(resp);
    assertEquals(resp.status, 200);
    assertEquals(resp.headers.get("content-type"), "image/png");
    const bytes = new Uint8Array(await resp.arrayBuffer());
    assertEquals(
      bytes,
      await Deno.readFile(join(TESTDATA_PATH, "./posts/second/hello2.png")),
    );
  }
});

Deno.test("static files in root directory", async () => {
  const resp = await testHandler(new Request("https://blog.deno.dev/cat.png"));
  assert(resp);
  assertEquals(resp.status, 200);
  assertEquals(resp.headers.get("content-type"), "image/png");
  const bytes = new Uint8Array(await resp.arrayBuffer());
  assertEquals(bytes, await Deno.readFile(join(TESTDATA_PATH, "./cat.png")));
});

Deno.test("RSS feed", async () => {
  const resp = await testHandler(new Request("https://blog.deno.dev/feed"));
  assert(resp);
  assertEquals(resp.status, 200);
  assertEquals(
    resp.headers.get("content-type"),
    "application/atom+xml; charset=utf-8",
  );
  const body = await resp.text();
  assertStringIncludes(body, `<title>Test blog</title>`);
  assertStringIncludes(body, `First post`);
  assertStringIncludes(body, `https://blog.deno.dev/first`);
  assertStringIncludes(body, `Second post`);
  assertStringIncludes(body, `https://blog.deno.dev/second`);
});

Deno.test(
  "theme-color meta tag when dark theme is used [index page]",
  async () => {
    const darkThemeBlogHandler = createBlogHandler({
      ...BLOG_SETTINGS,
      theme: "dark",
    });
    const darkThemeTestHandler = (req: Request) => {
      return darkThemeBlogHandler(req, CONN_INFO);
    };

    const resp = await darkThemeTestHandler(
      new Request("https://blog.deno.dev"),
    );
    const body = await resp.text();
    assertStringIncludes(body, `<meta name="theme-color" content="#000"/>`);
  },
);

Deno.test(
  "theme-color meta tag when dark theme is used [post page]",
  async () => {
    const darkThemeBlogHandler = createBlogHandler({
      ...BLOG_SETTINGS,
      theme: "dark",
    });
    const darkThemeTestHandler = (req: Request) => {
      return darkThemeBlogHandler(req, CONN_INFO);
    };

    const resp = await darkThemeTestHandler(
      new Request("https://blog.deno.dev/first"),
    );
    const body = await resp.text();
    assertStringIncludes(body, `<meta name="theme-color" content="#000"/>`);
  },
);

Deno.test("Plaintext response", async () => {
  const plaintext = new Headers({
    Accept: "text/plain",
  });
  const resp = await testHandler(
    new Request("https://blog.deno.dev/first", {
      headers: plaintext,
    }),
  );
  assert(resp);
  assertEquals(resp.status, 200);
  assertEquals(resp.headers.get("content-type"), "text/plain;charset=UTF-8");
  const body = await resp.text();
  assert(body.startsWith("It was popularised in the 1960s"));
});

Deno.test("missing post is 404", async () => {
  const resp = await testHandler(
    new Request("https://blog.deno.dev/does-not-exist"),
  );
  assertEquals(resp.status, 404);
  await resp.text();
});

Deno.test("posts/ fifth (math)", async () => {
  const resp = await testHandler(new Request("https://blog.deno.dev/fifth"));
  assertEquals(resp.status, 200);
  const body = await resp.text();
  assertStringIncludes(body, `Fifth post`);
  assertStringIncludes(body, `katex`);
  assertStringIncludes(body, `class="katex"`);
});

Deno.test(
  "custom root directory",
  async () => {
    const blogState = await configureBlog(BLOG_URL, false, {
      author: "The author",
      title: "Test blog",
      description: "This is some description.",
      lang: "en-GB",
      rootDirectory: join(TESTDATA_PATH, "./customRootDir"),
    });
    const customRootDirectoryBlogHandler = createBlogHandler(blogState);
    const customRootDirectoryTestHandler = (req: Request) => {
      return customRootDirectoryBlogHandler(req, CONN_INFO);
    };
    const resp = await customRootDirectoryTestHandler(
      new Request("https://blog.deno.dev/custom"),
    );
    assert(resp);
    assertEquals(resp.status, 200);
    assertEquals(resp.headers.get("content-type"), "text/html; charset=utf-8");
    const body = await resp.text();
    assertStringIncludes(body, `Custom post`);
    const respStaticFile = await customRootDirectoryTestHandler(
      new Request("https://blog.deno.dev/cat_custom_path.png"),
    );
    assertEquals(respStaticFile.status, 200);
    assertEquals(respStaticFile.headers.get("content-type"), "image/png");
    const bytes = new Uint8Array(await respStaticFile.arrayBuffer());
    assertEquals(
      bytes,
      await Deno.readFile(
        join(TESTDATA_PATH, "./customRootDir/cat_custom_path.png"),
      ),
    );
  },
);

Deno.test("quoted publish_date in front matter is honored", async () => {
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
  const state = await configureBlog(join(tmp, "main.ts"), false, {
    title: "dates",
  });
  const handler = createBlogHandler(state);
  const body = await (await handler(
    new Request("https://blog.example/quoted"),
    CONN_INFO,
  )).text();
  assertStringIncludes(body, `datetime="2020-01-01`);
});

Deno.test("protocol-relative redirects stay on-origin", async () => {
  const handler = createBlogHandler({
    ...BLOG_SETTINGS,
    middlewares: [redirects({ "/evil": "//evil.example" })],
  });
  const resp = await handler(
    new Request("https://blog.example/evil"),
    CONN_INFO,
  );
  assertEquals(resp.status, 307);
  const loc = resp.headers.get("location") ?? "";
  assertFalse(loc.startsWith("//"));
  assertFalse(loc.startsWith("http"));
});

Deno.test("parsePublishDate honors Date, string, and falls back to epoch", () => {
  const fromDate = parsePublishDate(new Date("2020-01-01T00:00:00.000Z"), "x");
  assertEquals(fromDate.toISOString(), "2020-01-01T00:00:00.000Z");

  const fromQuoted = parsePublishDate("2020-01-01", "quoted.md");
  assertEquals(fromQuoted.toISOString().startsWith("2020-01-01"), true);

  const missing = parsePublishDate(undefined, "nodate.md");
  assertEquals(missing.getTime(), 0);

  const invalid = parsePublishDate("not-a-date", "bad.md");
  assertEquals(invalid.getTime(), 0);

  const invalidDateObj = parsePublishDate(new Date(Number.NaN), "nan.md");
  assertEquals(invalidDateObj.getTime(), 0);
});

Deno.test("resolveColorScheme honors light, dark, and auto", () => {
  assertEquals(resolveColorScheme("light"), "light");
  assertEquals(resolveColorScheme("dark"), "dark");
  assertEquals(resolveColorScheme("auto"), "auto");
  assertEquals(resolveColorScheme(undefined), "auto");
});

Deno.test("ga injects gtag.js for GA4 measurement ids", async () => {
  const handler = createBlogHandler({
    ...BLOG_SETTINGS,
    middlewares: [ga("G-TEST1234")],
  });
  const resp = await handler(
    new Request("https://blog.deno.dev"),
    CONN_INFO,
  );
  assertEquals(resp.status, 200);
  const body = await resp.text();
  assertStringIncludes(
    body,
    "https://www.googletagmanager.com/gtag/js?id=G-TEST1234",
  );
  assertStringIncludes(body, 'gtag("config","G-TEST1234")');
});

Deno.test("ga does not inject gtag into non-HTML responses", async () => {
  const handler = createBlogHandler({
    ...BLOG_SETTINGS,
    middlewares: [ga("G-TEST1234")],
  });
  const resp = await handler(
    new Request("https://blog.deno.dev/first", {
      headers: { Accept: "text/plain" },
    }),
    CONN_INFO,
  );
  const body = await resp.text();
  assertFalse(body.includes("googletagmanager.com"));
});

Deno.test("ga ignores Universal Analytics ids", async () => {
  const handler = createBlogHandler({
    ...BLOG_SETTINGS,
    middlewares: [ga("UA-123456-1")],
  });
  const resp = await handler(
    new Request("https://blog.deno.dev"),
    CONN_INFO,
  );
  const body = await resp.text();
  assertFalse(body.includes("googletagmanager.com"));
});

Deno.test("ga rejects an empty key", () => {
  assertThrows(() => ga(""), Error, "GA key cannot be empty.");
});

Deno.test("ColorScheme light does not inject the auto dark-mode script", async () => {
  const { default: ColorScheme } = await import(
    "./vendor/htm/plugins/color-scheme.ts"
  );
  const emptyCtx = () => ({
    styles: [] as string[],
    scripts: [] as string[],
    classes: {} as { html?: string[] },
    body: "",
    status: 200,
    headers: new Headers(),
  });
  const light = emptyCtx();
  await ColorScheme("light")(light);
  assertEquals(light.scripts.length, 0);
  assertFalse((light.classes.html ?? []).includes("dark"));

  const auto = emptyCtx();
  await ColorScheme("auto")(auto);
  assert(auto.scripts.length > 0);
  assertStringIncludes(String(auto.scripts[0]), "setColorScheme");

  const dark = emptyCtx();
  await ColorScheme("dark")(dark);
  assertEquals(dark.classes.html?.includes("dark"), true);
  assertEquals(dark.scripts.length, 0);
});
