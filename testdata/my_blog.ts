import blog from "../blog.tsx";

blog({
  author: "Dino",
  title: "My Blog",
  description: "The blog description.",
  avatar: "https://deno-avatar.hmalinch.deno.net/avatar/blog.svg",
  avatarClass: "rounded-full",
  links: [
    { title: "bot@deno.com", url: "mailto:bot@deno.com" },
    { title: "GitHub", url: "https://github.com/denobot" },
    { title: "Twitter", url: "https://twitter.com/denobot" },
  ],
});
