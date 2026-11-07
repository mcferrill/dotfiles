import { View, div } from "gpui-kit";
import { focused, panes, terminals, exec, run, nextCommand, notify, shared, setShared, spaces } from "herdr";

/** @type {Record<string, string>} */
const keys = { left: "h", down: "j", up: "k", right: "l" };

export default class SmartNav extends View {
  /** @param {unknown} _props @param {import("gpui-kit").Context} cx */
  init(_props, cx) {
    if (shared("frame.welcomed") !== "finished") setShared("frame.welcomed", "finished");
    cx.spawn(async () => {
      for (;;) {
        const command = await nextCommand();
        try {
          await this.navigate(command);
        } catch (error) {
          notify({ title: "Smart navigation failed", body: error instanceof Error ? error.message : String(error), level: "error" });
        }
      }
    });
  }

  /** @param {string} command */
  async navigate(command) {
    const focus = focused();
    if (!focus?.pane || !focus.terminal) return;
    const handoff = command.startsWith("move-");
    const direction = handoff ? command.slice(5) : command;
    if (!Object.hasOwn(keys, direction)) return;
    const pane = panes().find((p) => p.pane === focus.pane);
    if (!handoff && pane?.program?.key === "nvim" && !focus.terminal.includes("/")) {
      const labels = terminals().find((t) => t.address === focus.terminal)?.labels;
      const server = labels?.["herdr.nvim-server"];
      const executable = labels?.["herdr.nvim-bin"];
      if (!server || !executable) throw new Error("Restart Neovim to register its RPC server and executable");
      // RPC bypasses hc keys' human-typing quiet period and Desktop's keybindings.
      const result = await exec(executable, ["--server", server, "--remote-send", `<C-${keys[direction]}>`]);
      if (result.code !== 0) throw new Error(result.stderr);
    } else if (pane?.zoomed) {
      // ponytail: CLI round-trips use fresh focus and let the unzoomed geometry render.
      /** @param {...string} args */
      const invoke = async (...args) => {
        const result = await exec("herdr-app", ["do", ...args]);
        if (result.code !== 0) throw new Error(result.stderr);
      };
      await invoke("pane.zoom", "--pane", focus.pane);
      try {
        await invoke("pane.go", "--direction", direction);
      } finally {
        await invoke("pane.zoom");
      }
    } else {
      run("pane.go", { direction });
    }
  }

  render() {
    const colors = { .../** @type {Record<string, string>} */ (shared("space.colors") ?? {}) };
    const palette = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];
    let changed = false;
    for (const space of spaces()) {
      if (colors[space.id] || space.name === "~") continue;
      /** @param {string} color */
      const uses = (color) => Object.values(colors).filter((value) => value === color).length;
      colors[space.id] = palette.reduce((best, color) => uses(color) < uses(best) ? color : best);
      changed = true;
    }
    if (changed) setShared("space.colors", colors);
    // ponytail: main-smart-nav keeps this listener in a visible 1px layout block.
    return div().h(1);
  }
}
