import { View, div } from "gpui-kit";
import { focused, panes, terminals, exec, run, nextCommand, notify } from "herdr";

const keys = { left: "h", down: "j", up: "k", right: "l" };

export default class SmartNav extends View {
  init(_props, cx) {
    cx.spawn(async () => {
      for (;;) {
        const command = await nextCommand();
        try {
          await this.navigate(command);
        } catch (error) {
          notify({ title: "Smart navigation failed", body: error.message, level: "error" });
        }
      }
    });
  }

  async navigate(command) {
    const focus = focused();
    if (!focus?.pane || !focus.terminal) return;
    if (!Object.hasOwn(keys, command)) return;
    const pane = panes().find((p) => p.pane === focus.pane);
    if (pane?.program?.key === "nvim" && !focus.terminal.includes("/")) {
      const labels = terminals().find((t) => t.address === focus.terminal)?.labels;
      const server = labels?.["herdr.nvim-server"];
      const executable = labels?.["herdr.nvim-bin"];
      if (!server || !executable) throw new Error("Restart Neovim to register its RPC server and executable");
      // RPC bypasses hc keys' human-typing quiet period and Desktop's keybindings.
      const result = await exec(executable, ["--server", server, "--remote-send", `<C-${keys[command]}>`]);
      if (result.code !== 0) throw new Error(result.stderr);
    } else {
      run("pane.go", { direction: command });
    }
  }

  render() {
    // ponytail: main-smart-nav keeps this listener in a visible 1px layout block.
    return div().h(1);
  }
}
