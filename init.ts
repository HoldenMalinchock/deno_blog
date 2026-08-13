// Copyright 2022 the Deno authors. All rights reserved. MIT license.

/**
 * CLI to scaffold a new blog project.
 *
 * @module
 * @example
 * ```sh
 * deno run -A jsr:@hmalinchock/blog/init ./my_blog
 * ```
 */

import { join, resolve } from "@std/path";

const HELP = `deno_blog

Initialize a new blog project. This will create all the necessary files for
a new blog.

To generate a blog in the './my_blog' subdirectory:
  deno run -A jsr:@hmalinchock/blog/init ./my_blog

To generate a blog in the current directory:
  deno run -A jsr:@hmalinchock/blog/init .

Print this message:
  deno run -A jsr:@hmalinchock/blog/init --help
`;

const CURRENT_DATE = new Date();
const CURRENT_DATE_STRING = CURRENT_DATE.toISOString().slice(0, 10);

const FIRST_POST_CONTENTS = `---
title: Hello world!
publish_date: ${CURRENT_DATE_STRING}
---

This is my first blog post!
`;

const MAIN_NAME = "main.tsx";
const MAIN_CONTENTS = `/** @jsx h */

import blog, { ga, redirects, h } from "@hmalinchock/blog";

blog({
  title: "My Blog",
  description: "This is my new blog.",
  // header: <header>Your custom header</header>,
  // section: (post) => <section>Your custom section with access to Post props.</section>,
  // footer: <footer>Your custom footer</footer>,
  avatar: "https://deno-avatar.deno.dev/avatar/blog.svg",
  avatarClass: "rounded-full",
  author: "An author",

  // middlewares: [

    // If you want to set up Google Analytics 4, paste your Measurement ID here.
    // ga("G-XXXXXXXXXX"),

    // If you want to provide some redirections, you can specify them here,
    // pathname specified in a key will redirect to pathname in the value.
    // redirects({
    //  "/hello_world.html": "/hello_world",
    // }),

  // ]
});
`;

const DENO_JSON_NAME = "deno.json";
const DENO_JSON_CONTENTS = `{
  "tasks": {
    "dev": "deno run --allow-net --allow-read --allow-env --watch main.tsx --dev",
    "serve": "deno run --allow-net --allow-read --allow-env main.tsx"
  },
  "imports": {
    "@hmalinchock/blog": "jsr:@hmalinchock/blog@^1.0.0"
  },
  "compilerOptions": {
    "jsx": "react",
    "jsxFactory": "h",
    "jsxFragmentFactory": "Fragment"
  }
}
`;

/**
 * Create a new blog project in `directory`.
 *
 * Writes `main.tsx`, `deno.json`, and a starter post under `posts/`.
 *
 * @param directory Target directory (created if missing)
 */
export async function init(directory: string): Promise<void> {
  directory = resolve(directory);

  console.log(`Initializing blog in ${directory}...`);
  try {
    const dir = [...Deno.readDirSync(directory)];
    if (dir.length > 0) {
      const confirmed = confirm(
        "You are trying to initialize blog in an non-empty directory, do you want to continue?",
      );
      if (!confirmed) {
        throw new Error("Directory is not empty, aborting.");
      }
    }
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) {
      throw err;
    }
  }

  await Deno.mkdir(join(directory, "posts"), { recursive: true });
  await Deno.writeTextFile(
    join(directory, "posts/hello_world.md"),
    FIRST_POST_CONTENTS,
  );
  await Deno.writeTextFile(join(directory, MAIN_NAME), MAIN_CONTENTS);
  await Deno.writeTextFile(
    join(directory, DENO_JSON_NAME),
    DENO_JSON_CONTENTS,
  );

  console.log("Blog initialized, run `deno task dev` to get started.");
}

function printHelp() {
  console.log(HELP);
  Deno.exit(0);
}

if (import.meta.main) {
  if (Deno.args.includes("-h") || Deno.args.includes("--help")) {
    printHelp();
  }

  const directory = Deno.args[0];
  if (directory == null) {
    printHelp();
  }

  await init(directory);
}
