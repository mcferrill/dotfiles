// Markdown panel, by jlopezlira (https://github.com/jlopezlira/herdr-kanso). Apache-2.0.
//
// A Markdown file in a window over any layout: formatted, and edited where
// it reads (double-click a block; a table as a grid of cells), saved as you
// go without overwriting what an agent wrote meanwhile. It opens when a .md
// file is opened from outside Herdr (Cmd-click on a path in a terminal,
// Finder) once Kanso Markdown is the app for .md files (markdown-handler.sh):
// that app leaves the path in data/kanso-open and opens this mod. Opened by
// hand (mod.open), it lists the Markdown files in the focused pane's folder.
// The window remembers where you drop it.
// doc.js and blocks.js are copies of Kanso's (kanso-panel); edit those.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { appHome, exec, watchFolder, focused, props, closeOverlay, theme, home } from "herdr";
import { MarkdownDoc, tildePath } from "./doc.js";

const ICONS = "mods/markdown-panel/icons";
const isMarkdown = (path) => /\.(md|markdown|mdx)$/i.test(path);
const folderOf = (path) => path.replace(/[\\/][^\\/]*$/, "") || "/";
const nameOf = (path) => path.split(/[\\/]/).pop();

// Reads and removes the paths waiting in the inbox; returns the newest.
export async function takeOpens(dir) {
  const r = await exec("sh", ["-c", 'for f in "$1"/*.path; do [ -f "$f" ] || continue; cat "$f"; printf "\\0"; rm -f "$f"; done', "sh", dir]);
  const paths = (r.stdout ?? "").split("\0").map((p) => p.trim()).filter((p) => p.startsWith("/"));
  return paths.pop() ?? null;
}

// Markdown files under a folder, nearest first: what git tracks, else a
// shallow look (no node_modules), at most 40.
export function markdownIn(listing) {
  return listing.split("\n").map((l) => l.trim()).filter((l) => /\.(md|markdown|mdx)$/i.test(l))
    .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b)).slice(0, 40);
}

export default class MarkdownPanel extends View {
  init(_props, cx) {
    this.doc = null; this.files = null;
    this.folder = focused()?.cwd || home();
    this.handle = cx.focus_handle();
    this.watchOpens(cx);
    this.list(cx);
  }

  list(cx) {
    const folder = this.folder;
    cx.spawn(async (cx) => {
      const git = await exec("git", ["ls-files", "--", "*.md", "*.markdown", "*.mdx"], { cwd: folder }).catch(() => null);
      const out = git?.code === 0 && git.stdout.trim() ? git.stdout
        : (await exec("find", [".", "-maxdepth", "3", "-name", "node_modules", "-prune", "-o", "-type", "f", "(", "-iname", "*.md", "-o", "-iname", "*.mdx", ")", "-print"], { cwd: folder }).catch(() => null))?.stdout ?? "";
      this.files = markdownIn(out.replace(/^\.\//gm, ""));
      cx.notify();
    });
  }

  watchOpens(cx) {
    const dir = `${appHome()}/data/kanso-open`;
    cx.spawn(async (cx) => {
      try {
        await exec("mkdir", ["-p", dir]);
        for (;;) {
          const path = await takeOpens(dir);
          if (path && isMarkdown(path)) this.open(path, cx);
          await watchFolder(dir);
        }
      } catch { /* no inbox: nothing opens from outside */ }
    });
  }

  // Saves what you typed in the file shown before, then shows this one.
  open(path, cx) {
    const before = this.doc;
    cx.spawn(async (cx) => {
      if (before && !(await before.flush())) { cx.notify(); return; }
      before?.release();
      this.doc = new MarkdownDoc(path, null, (to) => { if (isMarkdown(to)) this.open(to, cx); }, ICONS);
      this.doc.load(cx);
      this.watch(path, cx);
      cx.notify();
    });
  }

  // The file is read again on every change in its folder, while it is shown.
  watch(path, cx) {
    const dir = folderOf(path);
    cx.spawn(async (cx) => {
      try { while (this.doc?.path === path) { await watchFolder(dir); if (this.doc?.path === path) this.doc.load(cx); } } catch {}
    });
  }

  close(cx) {
    const doc = this.doc, id = props()?.overlay;
    const done = () => { if (id) closeOverlay(id); };
    if (!doc) { done(); return; }
    cx.spawn(async (cx) => {
      if (!(await doc.flush())) { cx.notify(); return; }
      doc.release(); this.doc = null;
      done();
    });
  }

  // Back to the list of this folder's Markdown files.
  back(cx) {
    const doc = this.doc;
    if (!doc) return;
    cx.spawn(async (cx) => {
      if (!(await doc.flush())) { cx.notify(); return; }
      doc.release(); this.doc = null;
      cx.notify();
    });
  }

  render() {
    const t = theme();
    const doc = this.doc;
    const button = (id, icon, tip, action) => div().id(id).p(4).rounded(6).cursor_pointer().text_color(t.muted).tooltip(tip)
      .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click((_e, cx) => action(cx))
      .child(svg(`${ICONS}/${icon}.svg`).size(14));
    return v_flex().id("markdown-panel").track_focus(this.handle).size_full().min_h(0).bg(t.background).text_color(t.foreground).text_size(13)
      .on_key_down((e, cx) => doc?.key(e, cx))
      .child(h_flex().h(42).flex_none().px(10).gap(6).items_center().border_b(1).border_color(t.border)
        .when(Boolean(doc), (el) => el.child(button("md-back", "chevron-left", "Markdown in this folder", (cx) => this.back(cx))))
        .child(v_flex().flex_1().min_w(0).pl(doc ? 0 : 4)
          .child(div().truncate().font_semibold().child(doc ? nameOf(doc.path) : "Markdown"))
          .child(div().truncate().text_size(11).text_color(t.dim).child(tildePath(doc ? folderOf(doc.path) : this.folder, null))))
        .children(doc ? doc.controls(t, "md") : [])
        .when(Boolean(doc) && !doc.editing, (el) => el.child(button("md-refresh", "refresh", "Read again", (cx) => doc.load(cx))))
        .child(button("md-close", "close", "Close", (cx) => this.close(cx))))
      .child(doc ? doc.body(t, "md-doc") : this.listView(t));
  }

  listView(t) {
    const files = this.files;
    if (files === null) return div().p(16).text_size(12.5).text_color(t.dim).child("Looking for Markdown…");
    if (!files.length) return div().p(16).text_size(12.5).text_color(t.dim).child("No Markdown files in this folder. Cmd-click a .md path in a terminal to read it here.");
    return div().id("md-files").flex_1().min_h(0).overflow_y_scrollbar().p(6)
      .children(files.map((f, i) => h_flex().id(`md-file-${i}`).h(30).px(10).gap(8).items_center().rounded(6).cursor_pointer()
        .hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.open(`${this.folder}/${f}`, cx))
        .child(div().flex_none().truncate().child(nameOf(f)))
        .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.dim).child(f.includes("/") ? folderOf(f) : ""))));
  }
}
