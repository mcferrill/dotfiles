import { View, div } from "gpui-kit";
import { run, props, closeOverlay, theme } from "herdr";

const actions = {
  "\\": ["pane.split", { direction: "right" }],
  backslash: ["pane.split", { direction: "right" }],
  "-": ["pane.split", { direction: "down" }],
  minus: ["pane.split", { direction: "down" }],
  h: ["pane.go", { direction: "left" }],
  j: ["pane.go", { direction: "down" }],
  k: ["pane.go", { direction: "up" }],
  l: ["pane.go", { direction: "right" }],
  z: ["pane.zoom", {}],
  x: ["pane.close", {}],
  c: ["tab.new", {}],
};

export default class Prefix extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.handle.focus();
  }

  key(event, cx) {
    cx.stop_propagation();
    const mods = event.modifiers ?? {};
    const action = !Object.values(mods).some(Boolean) && actions[event.key];
    // ponytail: one-shot prefix panel, no timeout; Escape or an unknown key cancels.
    closeOverlay(props().overlay);
    if (action) run(...action);
  }

  render() {
    const t = theme();
    return div().id("prefix").track_focus(this.handle)
      .on_key_down((event, cx) => this.key(event, cx))
      .size_full().p(16).rounded(8).bg(t.popover).text_color(t.foreground).text_size(13)
      .child("Ctrl+B → \\ right · - below · hjkl focus · z zoom · x close · c new tab · Esc cancel");
  }
}
