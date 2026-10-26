import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Inspired by dmmulroy/.dotfiles, save-md (29ebc43).
export default function saveMarkdown(pi: ExtensionAPI) {
  pi.registerCommand("save-md", {
    description: "Save the latest assistant response as Markdown: /save-md path",
    handler: async (args, ctx) => {
      const name = args.trim();
      if (!name) {
        ctx.ui.notify("Usage: /save-md path", "warning");
        return;
      }
      await ctx.waitForIdle();
      const entry = ctx.sessionManager.getBranch().findLast(
        (entry) => entry.type === "message" && entry.message.role === "assistant",
      );
      if (entry?.type !== "message" || entry.message.role !== "assistant") {
        ctx.ui.notify("No assistant response to save", "warning");
        return;
      }
      const markdown = entry.message.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n\n");
      if (!markdown.trim()) {
        ctx.ui.notify("The latest assistant response has no Markdown text", "warning");
        return;
      }
      const path = resolve(ctx.cwd, /\.md$/i.test(name) ? name : name + ".md");
      try {
        await writeFile(path, markdown.endsWith("\n") ? markdown : markdown + "\n", {
          encoding: "utf8",
          flag: "wx",
        });
      } catch (error) {
        const exists = error instanceof Error && "code" in error && error.code === "EEXIST";
        ctx.ui.notify(exists ? `File already exists: ${path}` : `Cannot save Markdown: ${String(error)}`, "error");
        return;
      }
      const content = `Saved Markdown to ${path}`;
      pi.sendMessage({ customType: "save-md", content, display: true }, { deliverAs: "nextTurn" });
      ctx.ui.notify(content, "info");
    },
  });
}
