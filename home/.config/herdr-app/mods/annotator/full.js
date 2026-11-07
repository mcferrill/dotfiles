import { div, list } from "gpui-kit";
import { v_flex, h_flex, h_resizable, resizable_panel, v_virtual_list, Scrollbar, Textarea } from "gpui-base";
import { theme, settings, setShared } from "herdr";
import { splitRows, splitSelectionRow, selected, pendingComments, unreadItems, visibleComments, fileStats, diffReaderEntries, commentStatus, commentLocation, deliveryBlocker, reviewTargetReady } from "./review.js";

function pageCards(self, id, items, render) {
  self.cardPages ??= new Map();
  const pages = Math.max(1, Math.ceil(items.length / 20));
  const page = Math.min(self.cardPages.get(id) ?? 0, pages - 1);
  return v_flex().gap(3)
    .children(items.slice(page * 20, (page + 1) * 20).map(render))
    .when(pages > 1, el => el.child(h_flex().p(8).gap(6).items_center()
      .child(self.button(`${id}-previous`, "Previous", cx => { self.cardPages.set(id, page - 1); cx.notify(); }, page > 0))
      .child(div().text_size(11).child(`${page + 1} / ${pages}`))
      .child(self.button(`${id}-next`, "Next", cx => { self.cardPages.set(id, page + 1); cx.notify(); }, page + 1 < pages))));
}

// Pure row builders: deferred native list renderers cannot register handlers.
function codeCell(row, side, selection, t, marks, self, highlights) {
  if (!row) return div().flex_1().min_w(0).bg(t.raised);
  const active = selected(row, selection) && (!side || selection?.side === side);
  const color = row.kind === "add" ? t.ansi2 : row.kind === "delete" ? t.ansi1 : t.dim;
  const number = side ? row[side] : null;
  const count = marks.get(`${side ?? (row.new != null ? "new" : "old")}:${number ?? row.new ?? row.old}`) ?? 0;
  return h_flex().flex_1().min_w(0).min_h(26).py(3).pr(12).gap(9).items_start()
    .bg(active ? t.selected : row.kind === "add" ? t.ansi2 + "18" : row.kind === "delete" ? t.ansi1 + "18" : t.background)
    .border_l(2).border_color(active ? t.accent : t.border)
    .when(!side, el => el.child(div().w(44).flex_none().text_right().text_color(t.dim).child(row.old == null ? "" : String(row.old))))
    .child(div().w(44).flex_none().text_right().text_color(t.dim).child(side ? String(number ?? "") : String(row.new ?? "")))
    .child(div().w(10).flex_none().text_color(color).child(row.kind === "add" ? "+" : row.kind === "delete" ? "−" : ""))
    .child(self.codeText(row, side, t, highlights))
    .when(count > 0, el => el.child(div().text_color(t.accent).text_size(11).child(`● ${count}`)));
}

function diffRow(row, split, selection, t, font, marks, self, highlights) {
  if (row.kind === "hunk" || row.kind === "meta") {
    return div().w_full().min_h(29).px(14).py(5).bg(t.raised).text_color(t.muted)
      .font_family(font).text_size(11).child(row.text);
  }
  return h_flex().w_full().min_h(26).font_family(font).text_size(13).cursor_pointer()
    .when(split, el => el.child(codeCell(row.old, "old", selection, t, marks, self, highlights)).child(codeCell(row.new, "new", selection, t, marks, self, highlights)))
    .when(!split, el => el.child(codeCell(row, null, selection, t, marks, self, highlights)));
}

function inlineNote(comment, active, t, self) {
  const status = commentStatus(comment);
  return v_flex().id(`full-inline-${comment.id}`).mx(10).my(4).p(8).gap(4).rounded(6).bg(t.surface)
    .border_1().border_color(active ? t.accent : t.border).cursor_pointer()
    .child(h_flex().gap(8).items_center().text_size(11)
      .child(div().text_color(comment.read ? t.dim : t.accent).child(comment.read ? "Read" : "● Unread"))
      .child(div().flex_1().text_color(t.muted).child(commentLocation(comment)))
      .child(div().text_color(t[status.tone]).child(status.label)))
    .child(self.selectableText(`inline-body-${comment.id}`, comment.body).text_size(12));
}

export function renderFull(self, cx) {
  const t = theme(), font = settings().font ?? "JetBrains Mono";
  const data = self.data, snapshot = data?.snapshot, files = self.reviewFiles(snapshot), allComments = data?.comments ?? [];
  const comments = visibleComments(allComments, self.showResolved);
  const draftPaths = self.draftPaths();
  const file = files.find(f => f.path === self.open), fileIndex = files.indexOf(file);
  const fileComments = comments.filter(c => c.path === self.open);
  const threads = visibleComments(self.github?.threads ?? [], self.showResolved);
  const counts = new Map(), marks = new Map();
  for (const c of comments) counts.set(c.path, (counts.get(c.path) ?? 0) + 1);
  for (const c of fileComments) if (!c.stale && c.position) {
    const key = `${c.position.side}:${c.position.end}`;
    marks.set(key, (marks.get(key) ?? 0) + 1);
  }
  const split = self.diffStyle === "split";
  const rows = file ? split ? splitRows(file.rows) : file.rows : [];
  const entries = diffReaderEntries(rows, unreadItems(fileComments, self.onlyUnread), split);
  const byKey = new Map(entries.map(entry => [entry.key, entry]));
  const activeComments = fileComments.filter(comment => comment.id === self.activeComment || self.activeCommentIds?.includes(comment.id));
  const highlights = self.syntaxCache?.key === JSON.stringify([snapshot?.revision, file?.path]) ? self.syntaxCache.tokens : null;
  const stats = file ? fileStats(file) : null;
  const hasDraft = self.hasDraft(), hasNoteDraft = Boolean(self.editor.value().trim()), selection = self.selection;
  const reviewDrafts = self.hasReviewDrafts();
  const pending = pendingComments(allComments), batch = pending.length + self.threadQueue.size + (self.reviewNote.editor.value().trim() ? 1 : 0);
  const target = self.currentSession(), unread = comments.filter(c => !c.read).length + threads.filter(c => !c.read).length;
  const sendBlocked = deliveryBlocker(target, reviewDrafts, self.reviewNote.uncertain);
  const listId = `full-diff-${file?.path ?? "empty"}-${self.diffStyle}`;
  const diff = v_flex().id("full-diff-frame").relative().flex_1().min_h(0)
    .on_mouse_down("left", event => { self.diffPress = { event, path: file?.path, revision: snapshot?.revision }; self.diffRelease = null; })
    .on_mouse_down("right", event => { self.diffPress = { event, path: file?.path, revision: snapshot?.revision }; })
    .on_mouse_up("left", event => { self.diffRelease = event; })
    .child(list(listId, entries.length, index => entries[index].key, index => {
      const entry = entries[index];
      if (entry.row) return diffRow(entry.row, split, selection, t, font, marks, self, highlights);
      return entry.comments.length ? v_flex().children(entry.comments.map(comment => inlineNote(comment, comment.id === self.activeComment, t, self))) : div().h(0);
    })
      .size_full().on_item_click((key, cx) => {
        if (!file || self.open !== file.path || self.data?.snapshot.revision !== snapshot.revision) return;
        const down = self.diffPress?.event.local_position, up = self.diffRelease?.local_position;
        if (down && up && Math.hypot(up.x - down.x, up.y - down.y) > 3) return;
        const entry = byKey.get(key);
        if (!entry) return;
        if (entry.comments) {
          if (!entry.comments.length) return;
          if (hasDraft) { self.notice = "Save or cancel your draft before opening a comment."; cx.notify(); return; }
          const comment = entry.comments[0];
          self.activeCommentIds = entry.comments.map(comment => comment.id);
          // Keep readonly text mounted for word/drag selection. Editing is an
          // explicit action, not a side effect of trying to copy a comment.
          self.activeComment = comment.id; self.composerOpen = false; self.selection = null; cx.notify();
          return;
        }
        if (file.truncated) return;
        const item = entry.row;
        const captured = self.diffPress;
        const press = captured?.path === file.path && captured?.revision === snapshot.revision ? captured.event : null;
        let row = item;
        if (split) {
          if (!press?.bounds || !press?.local_position) return;
          row = splitSelectionRow(item, press.local_position.x < press.bounds.width / 2 ? "old" : "new");
        }
        if (row && (row.old != null || row.new != null)) self.selectLine(row, press, cx);
        self.diffPress = null;
      }).on_item_secondary_click((key, cx) => {
        if (!file || self.open !== file.path || self.data?.snapshot.revision !== snapshot.revision) return;
        const entry = byKey.get(key);
        if (!entry?.row || file.truncated) return;
        const item = entry.row;
        if (item.kind === "hunk") { self.beginQuestion({ kind: "hunk", row: split ? item.sourceIndex : file.rows.indexOf(item) }, cx); return; }
        const press = self.diffPress?.path === file.path && self.diffPress?.revision === snapshot.revision ? self.diffPress.event : null;
        const row = split ? press?.bounds && press?.local_position
          ? splitSelectionRow(item, press.local_position.x < press.bounds.width / 2 ? "old" : "new") : null : item;
        if (row?.old != null || row?.new != null) {
          const side = row.new != null ? "new" : "old", line = row[side];
          self.beginQuestion({ kind: "selection", selection: { side, start: line, end: line } }, cx);
        }
        self.diffPress = null;
      }))
    .child(Scrollbar.vertical(listId).absolute().inset_0());

  const main = v_flex().size_full().min_w(0).min_h(0)
    .child(h_flex().id("full-view-toolbar").h(34).flex_none().px(10).gap(5).items_center().bg(t.chrome).border_b(1).border_color(t.border)
      .child(self.button("full-toggle-files", self.filesOpen ? "▾ Files" : "▸ Files", cx => { self.filesOpen = !self.filesOpen; self.rememberFull({ filesOpen: self.filesOpen }); cx.notify(); }))
      .child(self.button("full-code", "Code", cx => { self.view = "diff"; cx.notify(); }, true, self.view === "diff" ? "secondary" : "quiet"))
      .child(self.button("full-comments", `Comments · ${comments.length}`, cx => { self.view = "comments"; cx.notify(); }, true, self.view === "comments" ? "secondary" : "quiet"))
      .child(self.button("full-github", `GitHub · ${threads.length}`, cx => { self.view = "github"; self.refreshGithub(cx); cx.notify(); }, true, self.view === "github" ? "secondary" : "quiet"))
      .child(div().flex_1())
      .when(self.view === "diff", el => el
        .child(self.button("full-unified", "Unified", cx => { self.diffStyle = "unified"; self.rememberFull({ diffStyle: "unified" }); setShared("annotator.diffStyle", "unified"); cx.notify(); }, true, !split ? "secondary" : "quiet"))
        .child(self.button("full-split", "Split", cx => { self.diffStyle = "split"; self.rememberFull({ diffStyle: "split" }); setShared("annotator.diffStyle", "split"); cx.notify(); }, true, split ? "secondary" : "quiet"))))
    .when(self.view === "diff", el => el
      .child(v_flex().flex_none().bg(t.surface).border_b(1).border_color(t.border)
        .child(h_flex().id("full-file-toolbar").h(34).px(12).gap(5).items_center()
          .child(self.selectableText("full-file-path", file?.path ?? self.snapshotError?.title ?? (snapshot ? "No changes to review" : "Loading checkout…")).flex_1().min_w(0).truncate().font_semibold())
          .when(Boolean(stats?.added), el => el.child(self.badge(`+${stats.added}`, t.ansi2)))
          .when(Boolean(stats?.removed), el => el.child(self.badge(`−${stats.removed}`, t.ansi1)))
          .child(self.button("full-prev-file", "‹", cx => self.selectFile(files[fileIndex - 1].path, cx), fileIndex > 0))
          .child(self.button("full-next-file", "›", cx => self.selectFile(files[fileIndex + 1].path, cx), fileIndex >= 0 && fileIndex + 1 < files.length))
          .child(self.button("full-file-actions", "File ▾", cx => { self.fileActionsOpen = !self.fileActionsOpen; cx.notify(); })))
        .when(self.fileActionsOpen, el => el.child(h_flex().id("full-file-options").px(10).py(4).gap(4).flex_wrap().items_center()
          .child(self.button("full-context-more", "+20 context", cx => self.expandContext(Math.min(1000000, self.contextLines + 20), cx), Boolean(file) && self.contextLines < 1000000))
          .child(self.button("full-context-all", "Full context", cx => self.expandContext(1000000, cx), Boolean(file) && self.contextLines < 1000000))
          .child(self.button("full-context-collapse", "Collapse", cx => self.expandContext(3, cx), self.contextLines > 3))
          .child(self.button("full-new-file-comment", "File comment", cx => {
            self.fileNote(cx);
          }, Boolean(file)))
          .child(self.button("copy-full-menu", "Copy…", cx => { self.copyMenuOpen = !self.copyMenuOpen; cx.notify(); }))
          .child(self.button("full-ask-file", "Ask about diff", cx => self.beginQuestion({ kind: "file" }, cx), Boolean(file?.loaded) && !file?.truncated && !hasDraft))
           .when(Boolean(selection), el => el.child(self.button("full-ask-selection", "Ask selection", cx => self.beginQuestion({ kind: "selection", selection: { side: selection.side, start: selection.start, end: selection.end } }, cx), !hasDraft))))))
      .when(self.copyMenuOpen, el => el.child(self.copyMenu(file)))
      .when(Boolean(file?.note), el => el.child(div().p(10).text_color(t.ansi3).child(file.note)))
       .when(split && Boolean(file), el => el.child(h_flex().h(18).flex_none().bg(t.raised).text_size(10).text_color(t.muted)
        .child(div().flex_1().px(14).child("Before"))
        .child(div().flex_1().px(14).child("After"))))
      .child(diff))
    .when(self.view === "comments", el => el.child(v_flex().flex_1().min_h(0).overflow_y_scrollbar()
      .child(pageCards(self, "full-local", unreadItems(comments, self.onlyUnread), c => self.commentCard(c, t, true)))))
    .when(self.view === "github", el => el.child(v_flex().flex_1().min_h(0).overflow_y_scrollbar()
      .child(div().p(14).text_size(12).text_color(t.muted).child(self.github?.error ?? self.github?.pull_request?.url ?? "No open PR found. Refresh checks GitHub now."))
      .child(pageCards(self, "full-threads", unreadItems(threads, self.onlyUnread), thread => self.githubCard(thread, t)))))
    .when(self.view === "diff" && !self.commentsOpen && activeComments.length > 0, el => el.child(v_flex().id("full-comment-actions").max_h(230).flex_none().overflow_y_scrollbar().bg(t.chrome)
      .child(self.button("full-close-comment", "Close comments", cx => { self.activeComment = null; self.activeCommentIds = null; cx.notify(); }))
      .children(activeComments.map(comment => self.commentCard(comment, t)))))
    .when(!self.reviewSendOpen && !self.commentsOpen && !self.editDraft && !self.questionDraft && Boolean(selection || hasNoteDraft || self.composerOpen), el => el.child(v_flex().id("full-composer").flex_none().p(12).gap(6).bg(t.surface).border_t(1).border_color(t.border)
      .child(h_flex().gap(8).items_center()
        .child(div().flex_1().min_w(0).truncate().font_semibold().text_size(12).child(selection ? `${selection.side === "old" ? "Old" : "New"} L${selection.start}–${selection.end}` : `File comment · ${file?.path ?? ""}`))
        .child(self.button("full-file-note", "Whole file", cx => self.fileNote(cx), Boolean(file)))
        .child(self.button("full-cancel", "Cancel", cx => self.cancelDraft(cx))))
      .child(Textarea.new(self.editor).h(70).w_full().text_size(13))
      .child(h_flex().justify_end().items_center()
        .child(self.button("full-save", "+ Save comment", cx => self.saveComment(cx), self.canSaveComment(), "primary")))));

  const inspector = () => v_flex().size_full().min_h(0).bg(t.chrome).border_l(1).border_color(t.border)
    .child(h_flex().h(44).px(12).items_center().gap(6).flex_none()
      .child(div().font_semibold().flex_1().child("File comments"))
      .child(self.badge(String(fileComments.length), t.muted, t.raised)))
    .child(v_flex().flex_1().min_h(0).overflow_y_scrollbar()
      .child(pageCards(self, `inspector-${self.open}`, unreadItems(fileComments, self.onlyUnread), c => self.commentCard(c, t)))
      .when(!fileComments.length, el => el.child(div().p(14).text_size(12).text_color(t.dim).child("Select source lines to leave a comment. Saved comments appear here."))))
    .when(!self.reviewSendOpen, el => el.child(v_flex().p(12).gap(8).flex_none().bg(t.surface).border_t(1).border_color(t.border)
      .child(div().font_semibold().text_size(12).text_color(selection ? t.accent : t.foreground)
        .child(selection ? `${selection.side === "old" ? "Old" : "New"} L${selection.start}–${selection.end}` : "Comment on this file"))
      .child(self.selectableText("full-inspector-path", file?.path ?? "Select a file").truncate().text_size(11).text_color(t.dim))
      .child(Textarea.new(self.editor).h(110).w_full().text_size(13))
      .child(h_flex().gap(5)
        .child(self.button("full-file-note", "Whole file", cx => self.fileNote(cx), Boolean(file)))
        .child(self.button("full-cancel", "Cancel", cx => self.cancelDraft(cx), hasDraft || Boolean(selection))))
      .child(self.button("full-save", "+ Save comment", cx => self.saveComment(cx), self.canSaveComment(), "primary").tooltip("Save comment · ⌘Enter / Ctrl+Enter"))));

  return v_flex().id("annotator-full").size_full().min_h(0).bg(t.background).text_color(t.foreground).text_size(13).track_focus(self.handle)
    .on_key_down((event, cx) => self.handleKey(event, cx))
    .child(h_flex().id("full-review-header").h(42).flex_none().px(12).gap(6).items_center().bg(t.chrome).border_b(1).border_color(t.border)
      .child(div().font_semibold().text_size(14).child("Review"))
      .child(self.badge(`${snapshot ? files.length : "—"} files${self.snapshotError && snapshot ? " · cached" : ""}`, t.muted, t.raised))
      .child(v_flex().flex_1().min_w(0).gap(2)
        .child(self.selectableText("full-branch-name", snapshot?.branch ?? "Loading checkout…").truncate().font_semibold().text_size(12))
        .child(h_flex().min_w(0).gap(4).text_size(11).text_color(t.dim)
          .child(div().flex_none().child(`${snapshot?.scope.machine ?? "local"} ·`))
          .child(self.selectableText("full-checkout-path", snapshot?.scope.repo ?? "").min_w(0).truncate())))
      .child(self.button("full-scope-menu", `${self.mode === "branch" ? "Branch" : self.mode === "last_commit" ? "Last commit" : "Uncommitted"} ▾`, cx => { self.scopeMenuOpen = !self.scopeMenuOpen; self.baseOpen = false; cx.notify(); }, true, "secondary"))
      .when(self.mode === "branch", el => el.child(self.button("full-base", self.baseLabel(), cx => self.openBasePicker(cx)).max_w(150).truncate()))
      .child(self.button("full-review-options", "Review ▾", cx => { self.reviewOptionsOpen = !self.reviewOptionsOpen; cx.notify(); }))
      .child(self.button("full-refresh", self.busy ? "…" : "↻", cx => { self.refresh(cx, true); self.refreshGithub(cx, true); }).tooltip("Refresh diff and GitHub")))
    .when(self.scopeMenuOpen, el => el.child(h_flex().id("full-scope-options").px(10).py(4).gap(4).flex_wrap().flex_none().bg(t.chrome)
      .child(self.button("full-scope-local", "Uncommitted", cx => self.changeComparison("uncommitted", null, cx), true, self.mode === "uncommitted" ? "secondary" : "quiet"))
      .child(self.button("full-scope-last-commit", "Last commit", cx => self.changeComparison("last_commit", null, cx), !snapshot || Boolean(snapshot.head), self.mode === "last_commit" ? "secondary" : "quiet"))
      .child(self.button("full-scope-branch", "Branch", cx => self.changeComparison("branch", self.base, cx), true, self.mode === "branch" ? "secondary" : "quiet"))))
    .when(self.baseOpen, el => el.child(self.basePicker()))
    .when(self.orderModelOpen, el => el.child(self.orderModelPanel()))
    .child(self.updatePanel())
    .when(Boolean(self.error), el => el.child(self.errorCard(t)))
    .when(Boolean(self.notice && !self.error), el => el.child(div().px(16).py(8).text_size(12).text_color(t.muted).child(self.notice)))
    .when(self.reviewOptionsOpen, el => el.child(h_flex().id("full-review-options-panel").px(10).py(4).gap(5).flex_wrap().items_center().flex_none().bg(t.chrome).border_b(1).border_color(t.border)
      .child(self.orderButton("full-order-logically"))
      .when(Boolean(self.orderEntry()?.files), el => el.child(self.button("full-reset-file-order", "Reset order", cx => self.resetOrder(cx))))
       .child(self.button("full-unread", self.onlyUnread ? "● Unread only" : `All comments · ${unread} unread`, cx => { self.onlyUnread = !self.onlyUnread; self.rememberFull({ onlyUnread: self.onlyUnread }); cx.notify(); }, true, "secondary"))
       .when(self.resolvedCount() > 0 || self.showResolved, el => el.child(self.resolvedFilter("full-resolved")))
      .child(div().flex_1())
       .child(self.button("full-toggle-comments", self.commentsOpen ? "Hide comments pane" : "Comments pane", cx => {
        self.commentsOpen = !self.commentsOpen; self.rememberFull({ commentsOpen: self.commentsOpen }); setShared("annotator.fullComments", self.commentsOpen); cx.notify();
       }, true, self.commentsOpen ? "secondary" : "quiet"))
       .child(self.button("full-syntax", self.syntax ? "Syntax" : "Plain", cx => {
         self.syntax = !self.syntax; self.rememberFull({ syntax: self.syntax }); self.prepareSyntax(self.data?.snapshot); cx.notify();
       }, true, self.syntax ? "secondary" : "quiet"))
       .child(self.button("full-updates", "Updates", cx => { self.updates.save({ open: !self.updates.state.open }); self.updates.check(cx); cx.notify(); }))))
    .child(h_resizable(self.commentsOpen ? "annotator-reader-with-comments" : "annotator-reader").flex_1().min_h(0)
      .on_resize((sizes, cx) => { self.fullWidths = sizes.slice(0, 2); self.commentWidth = sizes[2] ?? self.commentWidth; setShared("annotator.fullWidths", sizes); cx.notify(); })
      .child(resizable_panel().size(self.fullWidths[0]).size_range(160, 500).visible(self.filesOpen)
        .child(v_flex().relative().size_full().min_h(0).bg(t.chrome)
          .child(v_virtual_list("full-files", files.length, 42, index => files[index].path,
            range => files.slice(range.start, range.end).map(f => self.fileRow(f, counts.get(f.path) ?? 0, t, draftPaths.has(f.path))))
            .size_full().on_item_click((path, cx) => self.selectFile(path, cx)))
          .child(Scrollbar.vertical("full-files").absolute().inset_0())))
      .child(resizable_panel().size(self.fullWidths[1]).size_range(300).child(main))
      .when(self.commentsOpen, el => el.child(resizable_panel().size(self.commentWidth).size_range(280, 600).child(inspector()))))
    .when(Boolean(self.questionDraft), el => el.child(self.questionComposer()))
    .when(Boolean(self.exportText), el => el.child(v_flex().p(12).gap(5).bg(t.surface)
      .child(Textarea.new(self.output).h(110).w_full())
      .child(self.button("full-close-export", "Close export", cx => { self.exportText = null; cx.notify(); }))))
    .when(self.reviewSendOpen, el => el.child(self.reviewSendComposer()))
    .when(!self.reviewSendOpen, el => el.child(h_flex().id("full-review-footer").h(36).flex_none().px(12).gap(8).items_center().bg(t.chrome).border_t(1).border_color(t.border)
      .child(v_flex().flex_1().min_w(0).gap(3)
        .child(div().id("full-recipient").truncate().text_size(11).child(target ? `${pending.length} comments · ${self.threadQueue.size} GitHub threads → ${target.address} · ${target.status}` : "Source chat unavailable · sending disabled"))
        .when(Boolean(self.snapshotError || self.reviewNote.uncertain || (target && !reviewTargetReady(target))), el => el
          .child(div().text_size(11).text_color(t.ansi3).child(self.snapshotError ? "Refresh failed. Review actions paused." : deliveryBlocker(target, false, self.reviewNote.uncertain)))))
      .child(self.button("full-export", "Export…", cx => self.act("export", { threads: [...self.threadQueue.values()] }, cx), batch > 0))
      .child(self.button("full-send", `Review & send…${batch ? ` · ${batch}` : ""}`, cx => self.beginReviewSend(cx), reviewTargetReady(target) && !reviewDrafts, "primary").tooltip(sendBlocked ?? "Add an optional general note, then send · ⌘Enter / Ctrl+Enter"))));
}
