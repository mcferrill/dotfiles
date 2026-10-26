import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Inspired by dmmulroy/.dotfiles, git-interceptor.ts (29ebc43).
export default function gitInterceptor(pi: ExtensionAPI) {
  pi.on("tool_call", (event) => {
    if (event.toolName !== "bash") return;
    const command = event.input.command;
    if (typeof command !== "string" || !command.includes("git")) return;

    // ponytail: string matching is a convenience guard, not a shell sandbox.
    if (/--no-verify\b/.test(command)) {
      return {
        block: true,
        reason: "Git hook bypass blocked. Fix the hook failure or ask the user for help.",
      };
    }
    event.input.command =
      "export GIT_EDITOR=true GIT_SEQUENCE_EDITOR=true GIT_MERGE_AUTOEDIT=no\n" + command;
  });
}
