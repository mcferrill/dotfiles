// A Markdown file in the side panel, edited where it reads. The document is
// always shown formatted; a double-click on a block (a paragraph, a list, a heading,
// a table) opens just that block to edit, and the rest stays formatted. A
// heading is edited without its #, a table as a grid of cells. Changes are
// saved as you go, and only if the file on disk is still what was read, so a
// change an agent made meanwhile is never overwritten: you choose. "Source"
// edits the whole file as Markdown. Used by Kanso's preview panel and, as a
// copy (npm run sync:share), by the markdown-panel mod.
import { div, svg } from "gpui-kit";
import { v_flex, h_flex, Editor, EditorState, TextView, Textarea, TextareaState } from "gpui-base";
import { readTextFile, writeTextFile, theme, settings, home } from "herdr";
import { parseBlocks, joinBlocks, headingOf, headingLine, parseTable, tableLines } from "./blocks.js";

const MAX_TEXT = 400000;
const AUTOSAVE_MS = 700;
const HEADING_SIZE = [0, 22, 18, 16, 15, 14, 13.5];

// YAML front matter (skills, agents, docs sites) as a code block, so it
// reads as data instead of running into the first paragraph.
export function readable(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/.exec(text);
  const body = m ? "```yaml\n" + m[1] + "\n```\n\n" + text.slice(m[0].length) : text;
  return body.length > MAX_TEXT ? body.slice(0, MAX_TEXT) + "\n\n… (file truncated)" : body;
}

// Where a link in the document goes: a web page, another file (resolved
// against the document's folder, its #anchor dropped), or nothing.
export function linkTarget(url, docPath) {
  if (/^(https?:|mailto:)/i.test(url)) return { web: url };
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^file:/i.test(url)) return null;
  let p = decodeURIComponent(url.replace(/^file:\/\//i, "").replace(/[?#].*$/, ""));
  if (!p) return null;
  if (!p.startsWith("/")) p = docPath.replace(/\/[^/]*$/, "") + "/" + p;
  const out = [];
  for (const part of p.split("/")) {
    if (part === "..") out.pop(); else if (part && part !== ".") out.push(part);
  }
  return { file: "/" + out.join("/") };
}

export class MarkdownDoc {
  // path: absolute; on: the machine (null here). onOpen(path) follows a link
  // to another file; without it, links to files do nothing.
  // icons: the folder of close.svg (Kanso's, or the standalone mod's own).
  constructor(path, on, onOpen, icons = "mods/kanso-chrome/icons") {
    this.path = path; this.on = on ?? null; this.onOpen = onOpen ?? null; this.icons = icons;
    this.saved = null;   // the file on disk, as last read or written
    this.text = null;    // the document as it is now
    this.blocks = [];
    this.active = null;  // the block being edited
    this.box = null;     // its text, or a table's cells
    this.cells = null;
    this.source = null;  // the whole file as Markdown, while "Source" is on
    this.conflict = false; this.saving = false; this.seq = 0;
    this.error = null; this.big = false;
  }

  get canEdit() { return !this.on && this.saved !== null && !this.big; }
  get dirty() { return this.text !== null && this.text !== this.saved; }
  get editing() { return this.active !== null || Boolean(this.source); }

  load(cx) {
    const path = this.path;
    cx.spawn(async (cx) => {
      try {
        const text = await readTextFile(path, { on: this.on });
        if (this.path !== path) return;
        if (text === null) { this.error = "This file is no longer available"; return; }
        if (text.includes("\0")) { this.error = "Binary file: nothing to show"; return; }
        this.error = null;
        if (text === this.saved) return;
        // Yours, not saved yet, and the file moved on: you choose which stays.
        if (this.dirty) { this.conflict = true; this.disk = text; return; }
        this.saved = text; this.big = text.length > MAX_TEXT;
        this.setText(text);
      } catch (e) { this.error = `Cannot read this file: ${e?.message ?? e}`; }
      finally { cx.notify(); }
    });
  }

  // The document is replaced (read from disk, or taken back): nothing stays open.
  setText(text) {
    this.close();
    this.text = text;
    this.blocks = parseBlocks(text);
    this.source?.set_value(text);
  }

  // ---- Editing one block -----------------------------------------------------

  open(i, cx) {
    if (!this.canEdit || this.conflict) return;
    if (this.active === i) return;
    this.close();
    const b = this.blocks[i];
    if (!b) return;
    this.active = i;
    if (b.kind === "table") this.openTable(b, cx);
    else {
      const value = b.kind === "heading" ? headingOf(b.lines[0]).text : b.lines.join("\n");
      const box = TextareaState.new({ value, placeholder: b.kind === "heading" ? "Heading" : "Write…" });
      box.set_auto_grow(1, 40);
      box.on("change", (_e, cx) => {
        const v = box.value();
        b.lines = b.kind === "heading" ? [headingLine(headingOf(b.lines[0]).level, v)] : v.split("\n");
        this.changed(cx);
      });
      this.box = box;
      box.focus();
    }
    cx.notify();
  }

  openTable(b, cx) {
    const table = parseTable(b.lines);
    const cell = (value, put) => {
      const s = TextareaState.new({ value });
      s.set_auto_grow(1, 8);
      s.on("change", (_e, cx) => { put(s.value()); b.lines = tableLines(table); this.changed(cx); });
      return s;
    };
    this.cells = {
      table, block: b,
      head: table.head.map((v, c) => cell(v, (x) => { table.head[c] = x; })),
      rows: table.rows.map((r, ri) => r.map((v, c) => cell(v, (x) => { table.rows[ri][c] = x; }))),
    };
    this.cells.head[0]?.focus();
  }

  // A row or a column added or removed: the grid is built again from the table.
  reshape(fn, cx) {
    const { table, block } = this.cells;
    fn(table);
    block.lines = tableLines(table);
    this.releaseCells();
    this.openTable(block, cx);
    this.changed(cx);
  }

  releaseCells() {
    if (!this.cells) return;
    for (const s of [...this.cells.head, ...this.cells.rows.flat()]) s.release();
    this.cells = null;
  }

  // Leaves the open block; the document is read into blocks again, so a
  // paragraph you split with an empty line becomes two.
  close() {
    this.box?.release(); this.box = null;
    this.releaseCells();
    if (this.active !== null && this.text !== null) this.blocks = parseBlocks(this.text);
    this.active = null;
  }

  // A new paragraph at the end of the document.
  append(cx) {
    if (!this.canEdit || this.conflict) return;
    this.close();
    const last = this.blocks[this.blocks.length - 1];
    if (last && last.kind !== "blank") this.blocks.push({ kind: "blank", lines: [""] });
    this.blocks.push({ kind: "paragraph", lines: [""] });
    this.blocks.push({ kind: "blank", lines: [""] }); // the file ends with a newline
    this.open(this.blocks.length - 2, cx);
  }

  changed(cx) {
    this.text = joinBlocks(this.blocks);
    this.later(cx);
    cx.notify();
  }

  // ---- Saving ----------------------------------------------------------------

  later(cx) {
    const seq = ++this.seq;
    cx.timer.after(AUTOSAVE_MS, (cx) => { if (seq === this.seq) this.save(cx); });
  }

  save(cx) {
    if (!this.dirty || this.saving || this.conflict || this.on) return;
    const text = this.text, expected = this.saved;
    this.saving = true; cx.notify();
    cx.spawn(async (cx) => {
      try {
        await writeTextFile(this.path, text, expected);
        this.saved = text; this.savedAt = Date.now();
      } catch {
        // The file changed on disk after it was read: read it to show the choice.
        const disk = await readTextFile(this.path, { on: this.on }).catch(() => null);
        if (disk !== null && disk !== expected) { this.conflict = true; this.disk = disk; }
      } finally {
        this.saving = false;
        if (this.dirty && !this.conflict) this.later(cx);
        cx.notify();
      }
    });
  }

  // Saves now, before the panel closes or shows another file. False when
  // it could not (the file changed on disk: the choice is shown).
  async flush() {
    this.seq++;
    if (!this.dirty || this.on) return !this.conflict;
    if (this.conflict) return false;
    try { await writeTextFile(this.path, this.text, this.saved); this.saved = this.text; return true; }
    catch {
      const disk = await readTextFile(this.path, { on: this.on }).catch(() => null);
      if (disk !== null) { this.conflict = true; this.disk = disk; }
      return false;
    }
  }

  // The file changed on disk while you edited: keep yours (written over it)
  // or take the file's.
  keepMine(cx) {
    if (!this.conflict) return;
    this.saved = this.disk; this.conflict = false; this.disk = null;
    this.save(cx);
  }

  takeTheirs(cx) {
    if (!this.conflict) return;
    this.saved = this.disk; this.conflict = false; this.disk = null;
    this.setText(this.saved);
    cx.notify();
  }

  // ---- The whole file as Markdown -------------------------------------------

  toggleSource(cx) {
    if (!this.canEdit) return;
    if (this.source) {
      this.source.release(); this.source = null;
      this.blocks = parseBlocks(this.text);
    } else {
      this.close();
      const t = theme();
      this.source = EditorState.new({ language: "markdown", value: this.text, soft_wrap: true, line_numbers: false, folding: false,
        font_family: settings().font_family, font_size: 12.5,
        syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6, punctuation: t.dim } });
      this.source.on("change", (_e, cx) => { this.text = this.source.value(); this.later(cx); cx.notify(); });
    }
    cx.notify();
  }

  // Cmd+S saves now; Escape closes the block being edited.
  key(e, cx) {
    const cmd = e.modifiers?.platform || e.modifiers?.control;
    if (cmd && e.key === "s") { this.seq++; this.save(cx); cx.stop_propagation(); }
    else if (e.key === "escape" && this.active !== null) { this.close(); cx.notify(); cx.stop_propagation(); }
  }

  follow(url, cx) {
    const to = linkTarget(url, this.path);
    if (to?.web) { try { cx.open_url(to.web); } catch {} }
    else if (to?.file && this.onOpen) this.onOpen(to.file);
  }

  // ---- Drawing ---------------------------------------------------------------

  // The header's part: where the saving is, and Source.
  controls(t, prefix) {
    const out = [];
    const state = this.on ? "Read only" : this.big ? "Too large to edit" : this.conflict ? "" : this.saving ? "Saving…" : this.dirty ? "Edited" : this.savedAt ? "Saved" : "";
    if (state) out.push(div().text_size(11.5).text_color(t.dim).child(state));
    if (this.canEdit) {
      out.push(div().id(`${prefix}-source`).h(24).px(9).flex().items_center().rounded(6).cursor_pointer().text_size(12).font_medium()
        .when(Boolean(this.source), (el) => el.bg(t.selected).text_color(t.foreground))
        .when(!this.source, (el) => el.text_color(t.muted))
        .hover((s) => s.bg(t.hover).text_color(t.foreground))
        .tooltip(this.source ? "Back to the formatted document" : "Edit the whole file as Markdown")
        .on_click((_e, cx) => this.toggleSource(cx)).child(this.source ? "Formatted" : "Source"));
    }
    return out;
  }

  body(t, id) {
    if (this.error) return div().p(16).text_color(t.dim).child(this.error);
    if (this.text === null) return div().p(16).text_color(t.dim).child("Reading…");
    const conflict = this.conflict ? h_flex().flex_none().px(16).py(8).gap(8).items_center().border_b(1).border_color(t.border)
      .child(div().flex_1().min_w(0).text_size(12).text_color(t.blocked).child("The file changed on disk while you edited it."))
      .child(this.pill(`${id}-mine`, "Keep mine", t, (cx) => this.keepMine(cx), true))
      .child(this.pill(`${id}-theirs`, "Take the file's", t, (cx) => this.takeTheirs(cx))) : null;
    const main = this.source
      ? div().flex_1().min_h(0).px(6).py(4).child(Editor.new(this.source).size_full())
      : div().id(`${id}-scroll`).flex_1().min_h(0).overflow_y_scrollbar()
        .child(v_flex().w_full().max_w(760).px(16).pt(14).pb(8).gap(10)
          .children(this.blocks.map((b, i) => this.block(b, i, t, id)).filter(Boolean)))
        .when(this.canEdit, (el) => el.child(div().id(`${id}-append`).h(120).w_full()
          .on_mouse_down("left", (e, cx) => { if (e.click_count === 2) this.append(cx); })));
    return v_flex().flex_1().min_h(0).when(Boolean(conflict), (el) => el.child(conflict)).child(main);
  }

  pill(id, label, t, action, strong) {
    return div().id(id).h(24).px(9).flex().items_center().rounded(6).cursor_pointer().text_size(12).font_medium()
      .when(strong, (el) => el.bg(t.solid).text_color(t.solid_foreground).hover((s) => s.opacity(0.88)))
      .when(!strong, (el) => el.text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground)))
      .on_click((_e, cx) => action(cx)).child(label);
  }

  block(b, i, t, id) {
    if (b.kind === "blank") return null;
    if (i === this.active && this.cells) return this.tableEditor(t, id);
    if (i === this.active && this.box) {
      const mono = b.kind === "code" || b.kind === "front";
      const size = b.kind === "heading" ? HEADING_SIZE[headingOf(b.lines[0]).level] : mono ? 12.5 : 13.5;
      return Textarea.new(this.box).w_full().px(8).py(6).rounded(6).border_1().border_color(t.input).bg(t.raised)
        .text_size(size).text_color(t.foreground).when(b.kind === "heading", (el) => el.font_semibold())
        .when(mono, (el) => el.font_family(settings().font_family));
    }
    const md = b.kind === "front" ? readable(b.lines.join("\n")) : b.lines.join("\n");
    return div().id(`${id}-b${i}`).w_full().px(8).py(2).rounded(6).text_size(13.5).text_color(t.foreground)
      .when(this.canEdit && !this.conflict, (el) => el.hover((s) => s.bg(t.hover))
        .on_mouse_down("left", (e, cx) => { if (e.click_count === 2) { this.open(i, cx); cx.stop_propagation(); } }))
      .child(TextView.markdown(`${id}-v${i}`, md).on_link_click((url, cx) => this.follow(url, cx)));
  }

  tableEditor(t, id) {
    const { head, rows, table } = this.cells;
    const n = head.length;
    const icon = (key, tip, action) => div().id(key).size(20).flex_none().flex().items_center().justify_center().rounded(4).cursor_pointer()
      .text_color(t.dim).hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tip).on_click((_e, cx) => action(cx))
      .child(svg(`${this.icons}/close.svg`).size(11));
    const cell = (s, key, strong) => div().id(key).flex_1().min_w(96).border_r(1).border_color(t.border)
      .child(Textarea.new(s).w_full().px(8).py(5).text_size(12.5).text_color(t.foreground).when(strong, (el) => el.font_semibold()));
    const line = (cells, key, strong, end) => h_flex().id(key).w_full().items_start().border_b(1).border_color(t.border)
      .when(strong, (el) => el.bg(t.raised)).children(cells).child(div().w(26).flex_none().pt(4).flex().justify_center().child(end));
    const removeCol = h_flex().w_full().children(head.map((_s, c) => div().flex_1().min_w(96).flex().justify_center()
      .child(n > 1 ? icon(`${id}-col-x-${c}`, "Remove this column", (cx) => this.reshape((tb) => { tb.head.splice(c, 1); tb.align.splice(c, 1); tb.rows.forEach((r) => r.splice(c, 1)); }, cx)) : div())))
      .child(div().w(26).flex_none());
    return v_flex().w_full().gap(6)
      .child(div().id(`${id}-grid`).w_full().overflow_x_scrollbar()
        .child(v_flex().min_w(n * 96 + 26).child(removeCol)
          .child(v_flex().rounded(6).border_1().border_color(t.input).overflow_hidden()
            .child(line(head.map((s, c) => cell(s, `${id}-h${c}`, true)), `${id}-hrow`, true, div()))
            .children(rows.map((r, ri) => line(r.map((s, c) => cell(s, `${id}-c${ri}-${c}`)), `${id}-row${ri}`, false,
              icon(`${id}-row-x-${ri}`, "Remove this row", (cx) => this.reshape((tb) => { tb.rows.splice(ri, 1); }, cx))))))))
      .child(h_flex().gap(6)
        .child(this.pill(`${id}-add-row`, "Add row", t, (cx) => this.reshape((tb) => { tb.rows.push(Array(n).fill("")); }, cx)))
        .child(this.pill(`${id}-add-col`, "Add column", t, (cx) => this.reshape((tb) => { tb.head.push(""); tb.align.push(null); tb.rows.forEach((r) => r.push("")); }, cx)))
        .child(div().flex_1())
        .child(this.pill(`${id}-done`, "Done", t, (cx) => { this.close(); cx.notify(); })));
  }

  release() { this.close(); this.source?.release(); this.source = null; }
}

export const tildePath = (dir, on) => {
  const h = home();
  if (on) return `${on}: ${dir}`;
  return dir === h ? "~" : dir.startsWith(h + "/") ? "~" + dir.slice(h.length) : dir;
};
