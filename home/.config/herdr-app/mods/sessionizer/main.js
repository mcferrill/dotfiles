import { View, div } from "gpui-kit";
import { v_flex, InputState, Input } from "gpui-base";
import { exec, home, spaces, run, theme, props, closeOverlay } from "herdr";

export default class Sessionizer extends View {
  init(_props, cx) {
    this.dirs = [];
    this.filter = "";
    this.at = 0;
    this.message = "Loading projects…";
    this.handle = cx.focus_handle();
    this.input = InputState.new({ placeholder: "Find a project directory…" });
    this.input.on("change", (_e, cx) => {
      this.filter = this.input.value();
      this.at = 0;
      cx.notify();
    });
    this.input.on("submit", () => this.open(this.rows()[this.at]));
    this.input.focus();
    cx.spawn(async (cx) => {
      try {
        const result = await exec("find", [home(), `${home()}/projects`, "-mindepth", "1", "-maxdepth", "1", "-type", "d", "-print0"]);
        if (result.code !== 0) throw new Error(result.stderr);
        this.dirs = [...new Set(result.stdout.split("\0").filter(Boolean))].sort();
        this.message = "No matching directories";
      } catch (error) {
        this.message = `Could not list projects: ${error.message}`;
      }
      cx.notify();
    });
  }

  rows() {
    const needle = this.filter.toLowerCase();
    return this.dirs.filter((dir) => {
      let at = 0;
      for (const char of dir.toLowerCase()) {
        if (char === needle[at]) at++;
      }
      return at === needle.length;
    });
  }

  open(dir) {
    if (!dir) return;
    // ponytail: match the space's current folder; no separate project registry.
    const existing = spaces().find((space) => !space.machine && space.folder.replace(/\/+$/, "") === dir);
    if (existing) run("space.select", { id: existing.id });
    else run("space.new", { name: dir.split("/").pop(), folder: dir });
    closeOverlay(props().overlay);
  }

  render() {
    const t = theme();
    const rows = this.rows();
    const start = Math.max(0, this.at - 7);
    return v_flex().id("sessionizer").track_focus(this.handle)
      .on_key_down((event, cx) => {
        if (event.key === "escape") closeOverlay(props().overlay);
        else if (event.key === "down" && rows.length) this.at = (this.at + 1) % rows.length;
        else if (event.key === "up" && rows.length) this.at = (this.at + rows.length - 1) % rows.length;
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .w_full().p(16).gap(8).bg(t.popover).text_color(t.foreground)
      .child(div().text_size(15).child("Open project · ↑/↓ select · Enter open · Esc cancel"))
      .child(Input.new(this.input).h(36).px(10).rounded(8).bg(t.background).text_size(13))
      .children(rows.slice(start, start + 8).map((dir, index) => div()
        .id(`project-${start + index}`).px(10).py(7).rounded(6).text_size(13)
        .bg(start + index === this.at ? t.selected : t.popover)
        .cursor_pointer().hover((style) => style.bg(t.hover))
        .on_click(() => this.open(dir))
        .child(dir.startsWith(`${home()}/`) ? `~/${dir.slice(home().length + 1)}` : dir)))
      .when(!rows.length, (element) => element.child(div().text_size(13).child(this.message)));
  }
}
