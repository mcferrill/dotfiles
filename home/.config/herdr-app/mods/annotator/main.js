import { View, div } from "gpui-kit";
import { v_flex, h_flex, v_resizable, resizable_panel, v_virtual_list, Scrollbar, TextareaState, Textarea, TextView, InputState, Input } from "gpui-base";
import { spaces, panes, focused, agents, exec, home, props, theme, settings, shared, setShared, run, layout, appHome, watchFolder, machines, nextCommand } from "herdr";
import { selectionFor, selectionPayload, selected, inlineAt, pendingComments, sessionTarget, fileStats, pathParts, commentStatus, commentLocation, reviewSummary, sendHint, unreadItems, visibleComments, layoutSidebar, reviewSidebarTransition, fullPreferences, snapshotFailure, needsFreshSnapshot, savedBaseChoice } from "./review.js";
import { renderFull } from "./full.js";
import { highlightDiff } from "./syntax.js";
import { DraftLifecycle } from "./draft.js";
import { GithubRefresh } from "./github-refresh.js";
import { reviewLocation } from "./review.js";
import { UpdateController } from "./updates.js";
import { escapeText, copiedDiff, copiedSelection } from "./review.js";
import { reviewOrderKey, orderedReviewFiles, existingReviewTab, deliveryBlocker, reviewTargetReady, reviewedDraft } from "./review.js";

function location() {
  const fixed = props();
  return fixed?.scope ? reviewLocation(fixed) : reviewLocation(null, focused(), spaces(), panes(), agents());
}
const contextKey = () => JSON.stringify(location());
const focusOwner = () => { const f = focused(); return JSON.stringify([f?.space, f?.tab, f?.pane]); };

export default class Annotator extends View {
  init(_props, cx) {
    this.data = null; this.open = null; this.busy = false;
    this.error = null; this.notice = null; this.context = null;
    this.snapshotError = null; this.showErrorDetails = false;
    this.sessions = new Map(); this.exportText = null;
    this.ordering = null;
    this.orderModelOpen = false; this.orderModelOptions = null; this.orderModelLoading = null;
    this.orderModelSearch = InputState.new({ placeholder: "Find model…" });
    this.orderModelSearch.on("change", (_event, cx) => cx.notify());
    this.edits = new Map(); this.questions = new Map();
    this.navigationDrafts = new Map(); this.navigationFiles = new Map();
    this.reviewNotes = new Map();
    this.reviewSend = null; this.reviewOptionsOpen = false; this.fileActionsOpen = false;
    this.githubDrafts = new Map();
    this.full = props()?.presentation === "full"; this.onlyUnread = false;
    const preferences = this.fullSettings();
    this.commentsOpen = preferences.commentsOpen;
    this.diffStyle = preferences.diffStyle;
    this.syntax = preferences.syntax; this.syntaxCache = null;
    this.onlyUnread = this.full && preferences.onlyUnread;
    const widths = shared("annotator.fullWidths");
    this.fullWidths = Array.isArray(widths) && [2, 3].includes(widths.length) && widths.every(n => Number.isFinite(n) && n > 0)
      ? [widths[0], widths.slice(1).reduce((sum, n) => sum + n, 0)] : [260, 1230];
    this.commentWidth = Array.isArray(widths) && widths.length === 3 ? widths[2] : 330;
    this.mode = "uncommitted"; this.base = null; this.contextLines = 3; this.baseOpen = false; this.scopeMenuOpen = false;
    this.baseExplicit = false; this.editorFocused = false;
    this.baseEditor = InputState.new({ placeholder: "Branch/ref, e.g. develop" });
    this.baseEditor.on("change", (_event, cx) => cx.notify());
    this.baseEditor.on("submit", (_event, cx) => this.applyBase(cx));
    this.githubRefresh = new GithubRefresh(); this.bases = [];
    const sizes = shared("annotator.sections");
    this.sizes = Array.isArray(sizes) && sizes.length === 3 && sizes.every(n => Number.isFinite(n) && n > 0) ? sizes : [140, 360, 175];
    this.view = ["comments", "github"].includes(props()?.view) ? props().view : "diff"; this.filesOpen = this.full ? preferences.filesOpen : true;
    this.editor = TextareaState.new({ placeholder: "What should change? Ask a question or leave feedback…", rows: 3 });
    this.draft = new DraftLifecycle(this.editor);
    this.editor.on("change", (_e, cx) => { this.publishUpdateState(); cx.notify(); });
    this.editor.on("focus", () => { this.editorFocused = true; });
    this.editor.on("blur", () => { this.editorFocused = false; });
    this.editor.on("submit", (event, cx) => {
      if (event.secondary && !event.shift && !event.is_held && !event.alt) this.reviewShortcut(cx, true);
    });
    this.output = TextareaState.new({ placeholder: "Exported review", rows: 6 });
    this.blankReviewNote = this.createReviewNote();
    this.ensureReviewNote(contextKey());
    this.handle = cx.focus_handle();
    this.updates = new UpdateController({ exec, shared, setShared, storage: sessionStorage,
      script: `${home()}/.local/share/herdr-annotator/update.py`, appHome: appHome(),
      ready: cx => { if (!this.closed && !this.data && !this._busy) this.refresh(cx); } });
    this.publishUpdateState(); this.updates.init(cx);
    this.refresh(cx);
    cx.timer.every(15000, cx => { if (!this.editor.value().trim()) this.refresh(cx); });
    cx.timer.every(300000, cx => this.refreshGithub(cx));
    cx.spawn(async cx => {
      try { for (;;) { const command = await nextCommand(); this.handleCommand(command, cx); } }
      catch (e) { this.commandError = String(e); }
    });
    // A hidden sidebar and an inactive review tab need not render. Herdr saves
    // focus in view.json; native file events keep restoration alive without
    // polling focus or keeping a redraw timer alive.
    cx.spawn(async cx => {
      try {
        for (;;) { await watchFolder(appHome()); this.syncSidebar(); cx.notify(); }
      } catch (e) { this.sidebarWatchError = String(e); }
    });
  }

  helper() { return props()?.helper ?? `${home()}/.local/bin/herdr-annotator`; }

  selectableText(id, text) {
    // Plain content only: never interpret comments as HTML/Markdown or load
    // images/links from them. TextView owns native selection and Cmd/Ctrl+C.
    return TextView.html(id, escapeText(text).replace(/\n/g, "<br>"))
      .selectable(true).scrollable(false).w_full();
  }

  copyText(text, cx) {
    try {
      cx.write_to_clipboard(text);
      this.copyTimer?.cancel(); this.copiedId = this.copySource ?? null;
      if (this.copiedId) this.copyTimer = cx.timer.after(1100, cx => {
        this.copiedId = null; if (!this.closed) cx.notify();
      });
    }
    catch (error) { this.notice = `Copy failed: ${error}`; }
    cx.notify();
  }

  copyMenu(file) {
    const t = theme(), selection = this.selection;
    return h_flex().id("copy-options").px(10).py(4).gap(4).flex_wrap().flex_none().bg(t.chrome)
      .child(this.button("copy-diff", file?.truncated ? "Copy diff preview" : "Copy diff", cx => this.copyText(copiedDiff(file), cx), Boolean(file?.loaded && file.rows.length)))
      .child(this.button("copy-selection", "Copy selected lines", cx => this.copyText(copiedSelection(file, selection), cx), Boolean(file && selection)))
      .child(this.button("copy-path", "Copy file path", cx => this.copyText(file.path, cx), Boolean(file)))
      .child(this.button("copy-branch", "Copy branch", cx => this.copyText(this.data.snapshot.branch, cx), Boolean(this.data?.snapshot.branch)))
      .child(this.button("copy-checkout", "Copy checkout", cx => this.copyText(this.data?.snapshot.scope.repo ?? location().scope.repo, cx)))
      .child(this.button("copy-all-comments", "Copy all comments", cx => this.copyText((this.data?.comments ?? []).map(comment => `${comment.path} · ${commentLocation(comment)}\n${comment.body}`).join("\n\n"), cx), Boolean(this.data?.comments.length)));
  }

  get busy() { return Boolean(this._busy || this.updates?.running); }
  set busy(value) { this._busy = value; this.publishUpdateState(); }

  publishUpdateState() {
    if (!this.updates) return;
    if (this.closed) { if (!this._busy && !this.ordering) this.updates.close(); return; }
    const savedDraft = [...(this.draft?.saved.entries() ?? [])].some(([key, draft]) => key !== this.context && draft.body?.trim())
      || [...this.navigationDrafts.values()].some(draft => draft.body?.trim());
    const blocked = Boolean(this._busy || this.ordering || this.editor?.value().trim() || savedDraft
      || [...this.reviewNotes.values()].some(note => note.editor.value().trim())
      || this.edits?.size || this.questions?.size || this.githubDrafts?.size);
    this.updates.publish(blocked);
  }

  close() { this.closed = true; this.copyTimer?.cancel(); this.updates?.close(Boolean(this._busy || this.ordering)); }

  orderEntry(snapshot = this.data?.snapshot) {
    return (shared("annotator.fileOrders") ?? []).find(entry => entry.key === reviewOrderKey(snapshot));
  }

  orderedFiles(snapshot = this.data?.snapshot) {
    return orderedReviewFiles(snapshot, this.orderEntry(snapshot)?.files);
  }

  observeOrder(snapshot) {
    const entry = this.orderEntry(snapshot);
    if (!entry) return;
    const view = JSON.stringify(snapshot.view), previous = entry.previews?.find(item => item.view === view);
    const changed = previous && previous.revision !== snapshot.revision;
    const previews = [...(entry.previews ?? []).filter(item => item.view !== view), { view, revision: snapshot.revision }].slice(-16);
    setShared("annotator.fileOrders", (shared("annotator.fileOrders") ?? []).map(item => item.key === entry.key
      ? { ...item, files: changed ? null : item.files, previews } : item));
  }

  resetOrder(cx) {
    const key = reviewOrderKey(this.data?.snapshot);
    if (this.ordering) this.ordering.cancelled = true;
    setShared("annotator.fileOrders", (shared("annotator.fileOrders") ?? []).filter(entry => entry.key !== key));
    this.notice = "Git file order restored."; cx.notify();
  }

  orderLogically(cx) {
    const snapshot = this.data?.snapshot;
    if (this.busy || this.ordering || this.snapshotError || !snapshot || snapshot.files.length < 2 || snapshot.files.length > 200) return;
    const context = this.context, key = reviewOrderKey(snapshot), runner = this.orderRunner();
    const model = runner === "opencode" ? shared("annotator.orderModel") ?? null : null;
    const target = runner === "opencode" ? this.currentSession()?.address ?? null : null;
    if (runner === "opencode" && !model && !target) {
      this.error = "Source chat unavailable. Choose an ordering model."; this.openOrderModels(cx); return;
    }
    const token = {}; this.ordering = token; this.error = null;
    this.notice = "Ordering files with a one-time AI request…";
    this.publishUpdateState(); cx.notify();
    cx.spawn(async cx => {
      try {
        const result = await this.request({ op: "order", scope: snapshot.scope, revision: snapshot.revision, view: snapshot.view, runner,
          ...(runner === "opencode" ? { model, target } : {}) });
        if (token.cancelled || this.closed || contextKey() !== context || this.context !== context) return;
        if (reviewOrderKey(this.data?.snapshot) !== key || this.data?.snapshot.revision !== result.revision || this.snapshotError) {
          this.notice = "Diff or preview changed during ordering. Click Order logically to try again."; return;
        }
        const files = orderedReviewFiles(snapshot, result.files);
        if (files === snapshot.files) throw new Error("AI returned an invalid file order");
        const entry = { key, files: result.files, previews: [{ view: JSON.stringify(snapshot.view), revision: snapshot.revision }] };
        setShared("annotator.fileOrders", [...(shared("annotator.fileOrders") ?? []).filter(item => item.key !== key), entry].slice(-20));
        this.notice = "Logical file order applied. Your working chat is unchanged.";
      } catch (error) {
        if (!token.cancelled && !this.closed && contextKey() === context && this.context === context
          && reviewOrderKey(this.data?.snapshot) === key) this.error = String(error);
      } finally {
        if (this.ordering === token) this.ordering = null;
        this.publishUpdateState(); cx.notify();
      }
    });
  }

  orderRunner() { return shared("annotator.orderRunner") === "pi" ? "pi" : "opencode"; }

  openOrderModels(cx) {
    this.orderModelOpen = true; this.orderModelOptions = null;
    const token = {}; this.orderModelLoading = token;
    const context = this.context, scope = this.data?.snapshot.scope ?? location().scope;
    const target = this.currentSession()?.address ?? null;
    this.orderModelSearch.set_value(""); cx.notify();
    cx.spawn(async cx => {
      try {
        const data = await this.request({ op: "order_models", scope, target });
        if (this.closed || this.context !== context || this.currentSession()?.address !== (target ?? undefined)
          || this.orderModelLoading !== token) return;
        this.orderModelOptions = data;
      } catch (error) {
        if (!this.closed && this.context === context && this.orderModelLoading === token)
          this.orderModelOptions = { error: String(error), models: [] };
      } finally {
        if (this.orderModelLoading === token) this.orderModelLoading = null;
        if (!this.closed) cx.notify();
      }
    });
  }

  orderModelPanel() {
    const t = theme(), options = this.orderModelOptions;
    const search = this.orderModelSearch.value().trim().toLowerCase();
    const choose = (model, cx) => { setShared("annotator.orderModel", model); this.orderModelOpen = false; cx.notify(); };
    const label = model => `${model.providerID}/${model.id}${model.variant ? `#${model.variant}` : ""}`;
    return v_flex().id("order-model-picker").flex_none().p(10).gap(5).bg(t.chrome)
      .child(h_flex().gap(5).items_center()
        .child(div().flex_1().font_semibold().child("Ordering model"))
        .child(this.button("order-model-refresh", "↻", cx => this.openOrderModels(cx), !this.orderModelLoading))
        .child(this.button("order-model-close", "Close", cx => { this.orderModelOpen = false; cx.notify(); })))
      .child(this.button("order-model-auto", options?.source ? `Source chat · ${label(options.source)}` : "Source chat · auto", cx => choose(null, cx)))
      .when(Boolean(options?.source_error || options?.error), el => el.child(div().text_size(11).text_color(t.ansi3).child(options.error ?? options.source_error)))
      .child(Input.new(this.orderModelSearch).id("order-model-search").w_full())
      .child(v_flex().max_h(180).overflow_y_scrollbar().gap(3)
        .when(Boolean(this.orderModelLoading), el => el.child("Loading models…"))
        .children((options?.models ?? []).filter(item => `${item.name} ${label(item.model)}`.toLowerCase().includes(search))
          .map((item, index) => this.button(`order-model-choice-${index}`, label(item.model), cx => choose(item.model, cx)))));
  }

  orderButton(id) {
    const runner = this.orderRunner(), label = runner === "pi" ? "Pi" : "OpenCode";
    return h_flex().gap(3).items_center()
      .child(this.button(`${id}-runner`, `AI: ${label}`, cx => {
        setShared("annotator.orderRunner", runner === "pi" ? "opencode" : "pi"); this.orderModelOpen = false; cx.notify();
       }, !this.ordering).tooltip(`Switch to ${runner === "pi" ? "OpenCode" : "Pi via Herdr Core"}. Changes the runner only; does not start a request.`))
      .when(runner === "opencode", el => el.child(this.button(`${id}-model`, shared("annotator.orderModel")?.id ?? "Source chat ▾", cx => {
        if (this.orderModelOpen) { this.orderModelOpen = false; cx.notify(); } else this.openOrderModels(cx);
      }, !this.ordering).tooltip("Ordering model only; does not change the source chat or global default.")))
      .child(this.button(id, this.ordering ? "Ordering…" : "Order logically", cx => this.orderLogically(cx),
      !this.ordering && !this.snapshotError && Boolean(this.data && this.data.snapshot.files.length >= 2 && this.data.snapshot.files.length <= 200))
       .tooltip(`One-time AI request via ${label}. ${runner === "pi" ? "Uses Pi's configured model" : "Uses the source chat model or your ordering override"}; no saved conversation or tools.`));
  }

  updatePanel() {
    const update = this.updates, state = update.state, release = state.latest;
    if (!state.open && (!release || (state.dismissedUntil ?? 0) > Date.now())) return div().h(0);
    const t = theme();
    return v_flex().id("annotator-update-panel").px(12).py(8).gap(5).flex_none().bg(t.raised).text_size(12)
      .child(div().font_semibold().child(release ? `Update ${release.tag} available · installed ${state.current}` : `Annotator ${state.current ?? ""}`))
      .when(Boolean(state.error), el => el.child(div().text_size(11).text_color(t.ansi3).child(state.error)))
      .child(h_flex().gap(5).flex_wrap()
        .when(Boolean(release), el => el
          .child(this.button("update-release-notes", "Release notes", cx => cx.open_url(release.url)))
          .child(this.button("update-install", "Update", cx => { this.publishUpdateState(); this.handle.focus?.(); update.start(cx); }, !update.blockers(), "primary")))
        .child(this.button("update-check", update.checking ? "Checking…" : "Check now", cx => update.check(cx, true), !update.checking))
        .child(this.button("update-later", "Later", cx => update.dismiss(cx))))
      .when(update.blockers(), el => el.child(div().text_size(11).text_color(t.muted).child("Save/cancel drafts in all review views and wait for operations to finish before updating.")));
  }

  updateScreen() {
    const state = this.updates.state, t = theme();
    return v_flex().id("annotator-updating").size_full().p(18).gap(10).bg(t.background).text_color(t.foreground).track_focus(this.handle)
      .child(div().font_semibold().child(state.job?.phase === "checking" ? "Checking installation…" : `Updating Annotator${state.job?.tag ? ` to ${state.job.tag}` : ""}…`))
      .child(div().text_size(12).child("Building and installing in the background. Review editors are paused; terminals remain available."))
      .when(Boolean(state.error), el => el.child(div().text_size(11).text_color(t.ansi3).child(state.error)));
  }

  get selection() { return this.draft.selection; }
  set selection(value) { this.draft.selection = value; }
  get needsSelection() { return this.draft.needsSelection; }
  get composerOpen() { return this.draft.composerOpen; }
  set composerOpen(value) { this.draft.composerOpen = value; }
  get drafts() { return this.draft.saved; }
  get github() { return this.githubRefresh.value; }
  set github(value) { this.githubRefresh.value = value; }
  get githubBusy() { return this.githubRefresh.busy; }
  get githubContext() { return this.githubRefresh.context; }
  get threadQueue() { return this.githubRefresh.queue; }

  get showResolved() { return shared("annotator.showResolved") === true; }

  resolvedCount() {
    const items = [...(this.data?.comments ?? []), ...(this.github?.threads ?? [])];
    return items.length - visibleComments(items).length;
  }

  resolvedFilter(id) {
    return this.button(id, `${this.showResolved ? "Hide" : "Show"} sent/resolved · ${this.resolvedCount()}`, cx => {
      setShared("annotator.showResolved", !this.showResolved);
      this.activeComment = null; this.activeCommentIds = null; cx.notify();
    }, true, this.showResolved ? "secondary" : "quiet");
  }

  fileNote(cx) {
    if (this.editDraft || this.questionDraft) return;
    this.reviewSend = null;
    this.draft.anchor(null, this.data?.snapshot.revision);
    this.activeComment = null; this.activeCommentIds = null; this.editor.focus(); cx.notify();
  }

  cancelDraft(cx) {
    this.draft.cancel(this.context); this.notice = null; this.publishUpdateState(); cx.notify();
  }

  fullSettings() {
    return fullPreferences(shared("annotator.fullPreferences"), {
      diffStyle: shared("annotator.diffStyle"), commentsOpen: shared("annotator.fullComments"),
    });
  }

  rememberFull(patch) {
    if (!this.full) return;
    setShared("annotator.fullPreferences", { ...this.fullSettings(), ...patch });
  }

  rememberBase(scope, base) {
    if (!this.full || !base) return;
    const key = JSON.stringify([scope.machine ?? null, scope.repo]);
    const bases = shared("annotator.baseRefs") ?? {};
    const entry = { base, explicit: this.baseExplicit };
    if (bases[key]?.base !== base || bases[key]?.explicit !== entry.explicit) setShared("annotator.baseRefs", { ...bases, [key]: entry });
  }

  baseLabel() { return this.baseExplicit ? this.base ?? "Base…" : this.base ? `Auto: ${this.base}` : "Auto"; }

  openBasePicker(cx) {
    this.baseOpen = !this.baseOpen; this.scopeMenuOpen = false;
    if (this.baseOpen) { this.baseEditor.set_value(this.base ?? ""); this.baseEditor.focus(); }
    cx.notify();
  }

  applyBase(cx) {
    const base = this.baseEditor.value().trim();
    if (base) this.changeComparison("branch", base, cx, true);
  }

  basePicker() {
    return v_flex().id("review-bases").max_h(210).flex_none().bg(theme().chrome)
      .child(h_flex().px(8).py(5).gap(5)
        .child(Input.new(this.baseEditor).id("base-ref-input").flex_1().min_w(0).h(30).px(8).rounded(5).bg(theme().background).border_1().border_color(theme().border))
        .child(this.button("base-apply", "Compare", cx => this.applyBase(cx), Boolean(this.baseEditor.value().trim()))))
      .child(v_flex().max_h(140).overflow_y_scrollbar()
        .child(this.button("base-auto", "Auto · closest develop base", cx => this.changeComparison("branch", null, cx, false)))
        .children(this.bases.map(base => this.button(`base-${base}`, base, cx => this.changeComparison("branch", base, cx, true)))));
  }

  comparisonKey() { return JSON.stringify([this.context, this.mode, this.baseExplicit ? this.base : null]); }
  navigationKey() { return JSON.stringify([this.comparisonKey(), this.open]); }

  stashNavigationDraft() {
    const key = this.navigationKey();
    if (this.editor.value().trim() || this.selection || this.composerOpen) this.navigationDrafts.set(key, {
      body: this.editor.value(), selection: this.selection, revision: this.draft.revision,
      needsSelection: this.needsSelection, composerOpen: this.composerOpen, contextLines: this.contextLines,
    });
    else this.navigationDrafts.delete(key);
    this.navigationFiles.set(this.comparisonKey(), this.open);
    this.editor.set_value(""); this.draft.reset();
  }

  restoreNavigationDraft() {
    const key = this.navigationKey(), draft = this.navigationDrafts.get(key);
    if (draft) {
      this.editor.set_value(draft.body); this.selection = draft.selection; this.draft.revision = draft.revision;
      this.draft.needsSelection = draft.needsSelection; this.composerOpen = draft.composerOpen;
      this.contextLines = draft.contextLines; this.navigationDrafts.delete(key);
    }
    if (this.editDraft) this.activeComment = this.editDraft.id;
    this.publishUpdateState();
    return Boolean(draft?.body.trim() || this.editDraft || this.questionDraft);
  }

  draftPaths() {
    const paths = new Set(), comparison = this.comparisonKey();
    if (this.hasDraft() && this.open) paths.add(this.open);
    for (const [key, draft] of this.navigationDrafts) {
      const [scope, path] = JSON.parse(key);
      if (scope === comparison && draft.body.trim()) paths.add(path);
    }
    for (const key of [...this.edits.keys(), ...this.questions.keys()]) {
      const [scope, path] = JSON.parse(key);
      if (scope === comparison) paths.add(path);
    }
    return paths;
  }

  reviewFiles(snapshot = this.data?.snapshot) {
    const files = this.orderedFiles(snapshot), present = new Set(files.map(file => file.path));
    const drafts = [...this.draftPaths()].filter(path => path && !present.has(path));
    return drafts.length ? [...files, ...drafts.map(path => ({ path, status: "draft", rows: [], loaded: false, draftOnly: true,
      note: "Unfinished draft: this file has no diff in this comparison. The text is kept; copy or cancel it, or return when the file changes." }))] : files;
  }

  canSaveComment() {
    return Boolean(!this.editDraft && !this.questionDraft && !this.needsSelection && this.editor.value().trim()
      && this.data?.snapshot.files.some(file => file.path === this.open && file.loaded));
  }

  saveComment(cx) {
    if (this.busy || this.snapshotError || !this.canSaveComment()) return;
    this.act("add", { path: this.open, selection: selectionPayload(this.selection), body: this.editor.value(),
      reviewed: reviewedDraft(this.data.snapshot, this.open, this.selection) }, cx);
  }

  get editDraft() { return this.edits.get(this.navigationKey()); }
  get questionDraft() { return this.questions.get(this.navigationKey()); }
  hasDraft() { return Boolean(this.editor.value().trim() || this.editDraft || this.questionDraft); }
  hasReviewDrafts() {
    const sameReview = key => JSON.parse(key)[0] === this.comparisonKey();
    return this.hasDraft() || [...this.edits.keys(), ...this.questions.keys()].some(sameReview)
      || [...this.navigationDrafts.entries()].some(([key, draft]) => sameReview(key) && draft.body?.trim());
  }

  beginEdit(comment, cx) {
    if (this.busy || this.snapshotError || contextKey() !== this.context || comment.delivery || comment.resolved) return;
    if (this.hasDraft()) { this.notice = "Save or cancel your draft before editing a comment."; cx.notify(); return; }
    this.reviewSend = null;
    const editor = TextareaState.new({ value: comment.body, rows: 3 });
    editor.set_value(comment.body); editor.on("change", (_event, cx) => { this.publishUpdateState(); cx.notify(); });
    editor.on("submit", (event, cx) => { if (event.secondary && !event.shift) this.saveEdit(cx); });
    this.edits.set(this.navigationKey(), { id: comment.id, expected_body: comment.body, editor });
    this.publishUpdateState();
    this.activeComment = comment.id; this.activeCommentIds = null; this.view = this.full ? this.view : "comments"; editor.focus(); cx.notify();
  }

  saveEdit(cx) {
    const edit = this.editDraft;
    if (!edit?.editor.value().trim()) return;
    this.act("edit", { id: edit.id, expected_body: edit.expected_body, body: edit.editor.value() }, cx);
  }

  beginQuestion(context, cx) {
    if (this.busy || this.snapshotError || !this.data || contextKey() !== this.context) return;
    if (this.hasDraft()) { this.notice = "Save or cancel your draft before asking a question."; cx.notify(); return; }
    const file = this.data.snapshot.files.find(f => f.path === this.open);
    if (!file?.loaded || file.truncated) { this.notice = "Load a complete preview before asking about this diff."; cx.notify(); return; }
    this.reviewSend = null;
    const editor = TextareaState.new({ placeholder: "What do you want to ask about this code?", rows: 3 });
    editor.on("change", (_event, cx) => { this.publishUpdateState(); cx.notify(); });
    editor.on("submit", (event, cx) => { if (event.secondary && !event.shift) this.sendQuestion(cx); });
    this.questions.set(this.navigationKey(), { id: this.githubReplyId(), path: file.path, context,
      revision: this.data.snapshot.revision, scope: this.data.snapshot.scope,
      view: this.data.snapshot.view ?? { file: file.path, context: this.contextLines }, editor, status: null });
    this.publishUpdateState();
    this.notice = null; editor.focus(); cx.notify();
  }

  sendQuestion(cx, retry = false) {
    const draft = this.questionDraft, target = this.currentSession();
    if (!draft || this.busy || this.snapshotError || !draft.editor.value().trim() || contextKey() !== this.context) return;
    if (draft.status === "uncertain" && !retry) return;
    if (!target || target.status !== "idle") { draft.error = "Focus the source chat and wait until it is idle."; cx.notify(); return; }
    if (retry && (draft.body !== draft.editor.value() || draft.target !== target.address)) {
      draft.error = "Retry must use the original question and recipient. Check the chat first."; cx.notify(); return;
    }
    const key = this.context, navigation = this.navigationKey(), body = draft.editor.value();
    draft.body = body; draft.target = target.address; draft.status = "uncertain"; draft.error = null;
    this.busy = true; cx.notify();
    cx.spawn(async cx => {
      try {
        const data = await this.request({ op: "ask", scope: draft.scope, revision: draft.revision, view: draft.view,
          question_id: draft.id, target: draft.target, path: draft.path, context: draft.context, body, retry });
        draft.status = data.question.status;
        draft.error = data.question.error;
        if (draft.status === "confirmed") {
          if (draft.editor.value() === body) this.questions.delete(navigation);
          else { draft.status = null; draft.id = this.githubReplyId(); }
          if (contextKey() === key) {
            this.notice = "Question sent to the source session.";
            if (agents().some(a => a.address === draft.target)) run("pane.focus", { terminal: draft.target });
          }
        }
      } catch (e) { draft.error = String(e); }
      finally { this.busy = false; cx.notify(); }
    });
  }

  questionComposer() {
    const draft = this.questionDraft;
    if (!draft) return div();
    const target = this.currentSession();
    return v_flex().id("question-composer").p(10).gap(6).flex_none().bg(theme().surface)
      .child(div().font_semibold().text_size(12).child(`Ask · ${draft.path} · ${draft.context.kind}`))
      .child(Textarea.new(draft.editor).h(70).w_full())
      .child(div().text_size(11).text_color(theme().muted).child(target ? `To ${target.address} · ${target.status}` : "Source chat unavailable"))
      .when(Boolean(draft.error), el => el.child(div().text_size(11).text_color(theme().ansi3).child(draft.error)))
      .when(draft.status === "uncertain", el => el.child(div().text_size(11).text_color(theme().ansi3).child("Delivery is uncertain. Check the chat before retrying. Do not change the question or recipient.")))
      .child(h_flex().gap(5)
        .child(this.button("question-cancel", "Close", cx => { this.questions.delete(this.navigationKey()); cx.notify(); }))
        .child(this.button("question-send", "Send question", cx => this.sendQuestion(cx), Boolean(draft.editor.value().trim()) && target?.status === "idle" && draft.status !== "uncertain", "primary"))
        .when(draft.status === "uncertain", el => el.child(this.button("question-retry", "I checked chat · Send again", cx => this.sendQuestion(cx, true), target?.status === "idle"))));
  }

  handleCommand(command, cx) {
    if (command === "focus") this.focusReview();
    else if (command === "submit") this.reviewSendOpen ? this.confirmReviewSend(cx) : this.beginReviewSend(cx);
    else if (command === "ask") this.beginQuestion(this.selection ? { kind: "selection", selection: selectionPayload(this.selection) } : { kind: "file" }, cx);
    else if (command === "scope") {
      const modes = ["uncommitted", "last_commit", "branch"];
      this.changeComparison(modes[(modes.indexOf(this.mode) + 1) % modes.length], this.base, cx);
    } else if (command === "refresh") { this.refresh(cx, true); this.refreshGithub(cx, true); }
    else if (command === "full") this.openFull(cx);
    else if (command === "updates") { this.updates.save({ open: true }); this.updates.check(cx); }
    cx.notify();
  }

  consumeOpenRequest(cx) {
    const request = shared("annotator.open");
    if (!request) return;
    const clear = () => { if (shared("annotator.open")?.id === request.id) setShared("annotator.open", null); };
    if (typeof request.id !== "string" || !request.id || !Number.isFinite(request.at)
      || Date.now() - request.at > 30000 || request.at > Date.now() + 5000 || typeof request.path !== "string"
      || !request.path.startsWith("/") || request.path.includes("\0") || request.path.split("/").some(p => p === ".." || p === ".")) { clear(); return; }
    if (this.busy || this.snapshotError || !this.data) return;
    const scope = this.data.snapshot.scope, root = scope.repo.replace(/\/$/, "");
    if ((request.on ?? null) !== (scope.machine ?? null) || !request.path.startsWith(`${root}/`)) return;
    if (this.openRequestId !== request.id) { this.openRequestId = request.id; this.refresh(cx, true, true); return; }
    const path = request.path.slice(root.length + 1), file = this.data.snapshot.files.find(f => f.path === path);
    if (!file) { this.notice = "Requested file has no diff in this scope."; clear(); return; }
    if (this.open !== path || !file.loaded) { this.selectFile(path, cx); return; }
    this.view = "diff"; this.filesOpen = true; clear();
  }

  handleKey(event, cx) {
    const chord = ["cmd-enter", "ctrl-enter", "cmd-return", "ctrl-return"].includes(event.keystroke);
    if (chord && !event.is_held && !event.modifiers?.shift && !event.modifiers?.alt) {
      // Textareas own their submit events. Handling the same press here too
      // could send after an asynchronous comment save has emptied the editor.
      if (this.editorFocused || this.reviewNoteFocused) return;
      if (this.reviewShortcut(cx)) cx.stop_propagation();
      return;
    }
    if (event.key === "escape") {
      if (this.reviewSendOpen) this.cancelReviewSend(cx);
      this.requeue = null; this.exportText = null; this.orderModelOpen = false;
      this.reviewOptionsOpen = false; this.fileActionsOpen = false; this.scopeMenuOpen = false; cx.notify();
    }
  }

  focusReview() {
    this.editorFocused = false; this.reviewNoteFocused = false;
    this.handle.focus();
  }

  reviewShortcut(cx, commentComposer = this.editorFocused) {
    // Nested editors keep their own shortcuts. Never send a batch while a reply,
    // ref picker, or unfinished comment elsewhere in this comparison is open.
    if (this.busy || this.snapshotError || this.baseOpen || this.scopeMenuOpen || this.orderModelOpen || this.editDraft || this.questionDraft
      || [...this.githubDrafts.keys()].some(key => JSON.parse(key)[0] === this.context)) return false;
    if (this.editor.value().trim()) {
      if (!commentComposer) return false;
      this.saveComment(cx); return true;
    }
    if (this.hasReviewDrafts()) return false;
    if (this.reviewSendOpen) this.confirmReviewSend(cx); else this.beginReviewSend(cx);
    return true;
  }

  prepareSyntax(snapshot) {
    if (!this.syntax || !snapshot) { this.syntaxCache = null; return; }
    const file = snapshot.files.find(f => f.path === this.open);
    if (!file || (!this.full && file.rows.length > 120)) { this.syntaxCache = null; return; }
    const key = JSON.stringify([snapshot.revision, file.path]);
    if (this.syntaxCache?.key === key) return;
    const tokens = highlightDiff(file.rows, file.path);
    // The compact sidebar builds its code eagerly. Bound its native text-run
    // count; full review virtualizes rows and can color the whole preview.
    const count = [...tokens.values()].reduce((sum, line) => sum + line.length, 0);
    this.syntaxCache = { key, tokens: !this.full && count > 600 ? new Map() : tokens };
  }

  codeText(row, side, t, highlights) {
    const source = side ?? (row.new != null ? "new" : "old");
    const tokens = this.syntax ? highlights?.get(`${source}:${row[source]}`) : null;
    if (!tokens?.some(token => token.kind !== "plain")) return div().flex_1().min_w(0).child(row.text || " ");
    const colors = { keyword: t.ansi5, string: t.ansi2, comment: t.muted,
      number: t.ansi3, literal: t.ansi3, function: t.ansi4, type: t.ansi6, property: t.ansi4, plain: t.foreground };
    return h_flex().flex_1().min_w(0).flex_wrap().items_start().gap(0)
      .children(tokens.map(token => div().max_w("100%").text_color(colors[token.kind] ?? t.foreground).child(token.text)));
  }

  async request(request) {
    if (this.updates?.running) throw new Error("Update in progress; review operations are paused");
    // This is always local. The Rust engine uses hc to read remote repos.
    const result = await exec(this.helper(), ["request", JSON.stringify(request)]);
    let response;
    try { response = JSON.parse(result.stdout); }
    catch { throw new Error(result.stderr || "Helper returned no JSON; build/install herdr-annotator first"); }
    if (result.code !== 0 || !response.ok) throw new Error(response.error ?? result.stderr ?? "Review operation failed");
    return response.data;
  }

  machineUnavailable(scope) {
    return Boolean(scope.machine && machines().some(machine => machine.name === scope.machine && machine.layout === "unavailable"));
  }

  snapshotFailed(error, scope) {
    this.snapshotError = snapshotFailure(error, scope.machine);
    this.error = this.snapshotError.kind === "not-repository" ? null : this.snapshotError.message;
    if (this.snapshotError.kind === "not-repository") this.githubRefresh.invalidate();
  }

  emptyCheckout(t) {
    const scope = location().scope;
    return v_flex().id("review-empty-checkout").size_full().min_h(0).bg(t.background).text_color(t.foreground)
      .child(h_flex().h(40).px(12).gap(8).items_center().flex_none().bg(t.chrome)
        .child(div().font_semibold().text_size(14).child(this.full ? "Review" : "Changes"))
        .child(div().flex_1())
        .child(this.button("empty-updates", "Updates", cx => { this.updates.save({ open: !this.updates.state.open }); this.updates.check(cx); cx.notify(); }))
        .child(this.button("empty-refresh", this.busy ? "Checking…" : "↻ Refresh", cx => this.refresh(cx, true))))
      .child(this.updatePanel())
      .child(v_flex().flex_1().min_h(0).p(20).gap(10).justify_center()
        .child(div().font_semibold().text_size(14).child(scope.repo ? "Not a Git checkout" : "Select a Git checkout"))
        .child(div().text_size(12).text_color(t.muted).child("Open a folder with a Git repository to review its changes."))
        .when(Boolean(scope.repo), el => el.child(div().w_full().truncate().text_size(11).text_color(t.dim)
          .child(`${scope.machine ? scope.machine + " · " : ""}${scope.repo}`)))
        .when(Boolean(this.editor.value().trim()), el => el.child(div().text_size(12).text_color(t.muted).child("Your unsaved draft is kept. Return to a Git checkout to continue."))));
  }

  errorCard(t) {
    const failure = this.snapshotError;
    return v_flex().id("review-error").m(8).p(10).gap(6).rounded(6).bg(t.ansi1 + "12").text_size(12)
      .child(div().font_semibold().text_color(t.ansi1).child(failure?.title ?? "Review operation failed"))
      .child(this.selectableText("review-error-text", this.error ?? "").text_color(t.muted))
      .child(this.button("copy-error", "Copy error", cx => this.copyText(this.snapshotError?.detail ?? this.error ?? "", cx)))
      .when(Boolean(failure && this.data), el => el.child(div().text_color(t.ansi3).child("Showing the last loaded diff. Review actions are paused until Refresh succeeds.")))
      .when(Boolean(failure), el => el.child(h_flex().gap(5)
        .child(this.button("error-retry", "↻ Retry", cx => this.refresh(cx, true), true, "secondary"))
        .when(failure.kind === "offline", el => el.child(this.button("error-machines", "Machines…", () => run("app.settings", { section: "machines" }))))
        .when(Boolean(failure.detail), el => el.child(this.button("error-details", this.showErrorDetails ? "Hide details" : "Details", cx => { this.showErrorDetails = !this.showErrorDetails; cx.notify(); })))))
      .when(Boolean(this.showErrorDetails && failure?.detail), el => el.child(div().text_size(11).text_color(t.dim).child(failure.detail)));
  }

  refresh(cx, force = false, navigating = false) {
    const next = contextKey();
    if (this.updates?.running || (this.busy && !(this.snapshotRequest && next !== this.context))) return;
    if (this.snapshotRequest && next !== this.context) {
      this.snapshotRequest = null; this.busy = false;
    }
    if (next !== this.context) {
      this.reviewSend = null; this.reviewOptionsOpen = false; this.fileActionsOpen = false;
      const draft = this.draft.enter(next, this.context, { open: this.open, mode: this.mode, base: this.base, baseExplicit: this.baseExplicit, contextLines: this.contextLines }, this.data?.snapshot.revision);
      this.context = next; this.data = null; this.open = draft?.open ?? props()?.file ?? null;
      const preferences = this.fullSettings(), scope = location().scope;
      const savedBase = (shared("annotator.baseRefs") ?? {})[JSON.stringify([scope.machine ?? null, scope.repo])];
      const propBase = props()?.scope?.comparison?.base;
      const propChoice = props()?.base_explicit === undefined ? propBase : { base: propBase, explicit: props().base_explicit };
      const choice = this.full ? savedBaseChoice(props()?.base_explicit === true ? propChoice : savedBase ?? propChoice)
        : { base: propBase ?? null, explicit: props()?.base_explicit ?? Boolean(propBase) };
      this.mode = draft?.mode ?? (this.full ? preferences.mode : props()?.scope?.comparison?.mode ?? "uncommitted");
      this.base = draft?.base ?? choice.base; this.baseExplicit = draft?.baseExplicit ?? choice.explicit;
      this.contextLines = draft?.contextLines ?? (this.full ? preferences.contextLines : props()?.context_lines ?? 3); this.bases = [];
      this.exportText = null; this.error = null; this.snapshotError = null; this.showErrorDetails = false; this.notice = null; this.activeComment = this.editDraft?.id ?? null; this.activeCommentIds = null; this.composerOpen = false;
      this.githubRefresh.invalidate();
      this.view = ["comments", "github"].includes(props()?.view) ? props().view : "diff";
    } else if (this.editor.value().trim() && !navigating) {
      if (!(force && this.snapshotError)) { this.notice = "Save or cancel your draft before refreshing."; cx.notify(); return; }
    }
    const current = location();
    if (!current.scope.repo) {
      this.error = null; this.snapshotError = { kind: "not-repository" }; cx.notify(); return;
    }
    if (!force && this.machineUnavailable(current.scope)) {
      this.snapshotFailed(`Machine ${current.scope.machine} is unavailable`, current.scope); cx.notify(); return;
    }
    const context = this.context;
    const token = {}; this.snapshotRequest = token;
    const request = { op: "snapshot", scope: { ...current.scope, comparison: { mode: this.mode, base: this.baseExplicit ? this.base : null } }, view: { file: this.open, context: this.contextLines } };
    this.busy = true;
    cx.spawn(async cx => {
      try {
        if (this.snapshotRequest !== token) return;
        this.ensureReviewNote(context);
        const data = await this.request(request);
        if (this.snapshotRequest !== token || contextKey() !== context) return;
        const previousRevision = this.data?.snapshot.revision;
        if (this.data && this.data.snapshot.branch !== data.snapshot.branch) {
          this.reviewSend = null;
          this.githubRefresh.invalidate();
        }
        this.data = data;
        this.observeOrder(data.snapshot);
        this.bases = data.snapshot.bases ?? [];
        this.base = data.snapshot.scope.comparison?.base ?? this.base;
        if (this.mode === "branch") this.rememberBase(data.snapshot.scope, this.base);
        if (this.draft.observe(data.snapshot.revision, previousRevision)) {
          this.notice = "Diff changed since this draft. Select the intended lines again, or choose File note. Your text is kept.";
        }
        if (!this.open || (!this.editor.value().trim() && !data.snapshot.files.some(f => f.path === this.open))) {
          this.open = data.snapshot.files[0]?.path ?? null;
        }
        this.prepareSyntax(data.snapshot);
        this.error = null;
        this.snapshotError = null; this.showErrorDetails = false;
        if (props()?.source_draft && !this.sourceDraftNoticeShown) {
          this.notice = "An unfinished comment is kept in the source view. Switch back there to continue it.";
          this.sourceDraftNoticeShown = true;
        }
        if (this.githubContext !== context) this.refreshGithub(cx);
      } catch (e) { if (this.snapshotRequest === token && contextKey() === context) this.snapshotFailed(e, current.scope); }
      finally {
        if (this.snapshotRequest === token) { this.snapshotRequest = null; this.busy = false; }
        cx.notify();
      }
    });
  }

  act(op, details, cx) {
    if (this.busy || this.snapshotError || !this.data || contextKey() !== this.context) return;
    const context = this.context;
    const originalFocus = focusOwner();
    const snapshot = this.data.snapshot;
    const draftToken = op === "add" ? this.draft.capture(context) : null;
    const editToken = op === "edit" ? this.editDraft : null;
    const editKey = this.navigationKey();
    const noteToken = ["send", "export"].includes(op) ? this.reviewNote : null;
    const sendToken = op === "send" && details.include_local ? this.reviewSend : null;
    if (op === "export") details = { note: noteToken.editor.value(), ...details };
    this.busy = true; this.error = null; this.notice = null;
    cx.spawn(async cx => {
      try {
        const data = await this.request({ op, scope: snapshot.scope, view: snapshot.view ?? { file: this.open, context: this.contextLines }, ...(["resolve", "read"].includes(op) ? {} : { revision: snapshot.revision }), ...details });
        if (op === "send" && details.note && noteToken.editor.value() === details.note) {
          noteToken.editor.set_value(""); noteToken.uncertain = false;
        }
        if (sendToken && this.reviewSend === sendToken) this.reviewSend = null;
        if (editToken) {
          if (editToken.editor.value() === details.body) this.edits.delete(editKey);
          else editToken.expected_body = details.body.trim();
        }
        if (contextKey() !== context) {
          if (draftToken) this.draft.complete(draftToken, this.context);
          return;
        }
        if (op === "export") { this.exportText = data.text; this.output.set_value(data.text); }
        else { this.data = data; this.prepareSyntax(data.snapshot); }
        if (draftToken) {
          const completed = this.draft.complete(draftToken, this.context);
          // Keep the native input mounted after a keyboard save. Removing it
          // strands focus, so a second Cmd/Ctrl+Enter never emits submit.
          // Don't reopen/focus it if the person moved to another pane.
          if (completed && this.editorFocused && focusOwner() === originalFocus) {
            this.composerOpen = true; this.editor.focus();
          }
          this.activeComment = null; this.activeCommentIds = null; this.notice = "Comment saved. It is ready to send with your review.";
        }
        if (editToken) this.notice = "Comment updated.";
        if (contextKey() !== context) return;
        if (op === "send") {
          this.notice = `Feedback submitted to the open session (${details.target}). Sent comments are saved under Show sent/resolved.`;
          if (data.github) this.github = data.github;
          this.threadQueue.clear();
          if (agents().some(agent => agent.address === details.target)) run("pane.focus", { terminal: details.target });
        }
      } catch (e) {
        if (op === "send" && details.note) noteToken.uncertain = true;
        if (contextKey() === context) this.error = String(e);
      }
      finally { this.busy = false; cx.notify(); }
    });
    cx.notify();
  }

  currentSession() {
    const current = location();
    const pinned = props()?.source_target;
    if (pinned) return sessionTarget(agents().filter(a => a.address === pinned), current, null, pinned);
    const key = JSON.stringify([current.scope.machine, current.space, current.tab]);
    const target = sessionTarget(agents(), current, focused(), this.sessions.get(key));
    if (target) this.sessions.set(key, target.address);
    return target;
  }

  get reviewSendOpen() {
    return Boolean(this.reviewSend && this.reviewSend.comparison === this.comparisonKey()
      && this.reviewSend.branch === this.data?.snapshot.branch && contextKey() === this.context);
  }

  beginReviewSend(cx) {
    if (this.busy || this.snapshotError || !this.data || contextKey() !== this.context || this.hasReviewDrafts()) return;
    const target = this.currentSession();
    if (!reviewTargetReady(target)) { this.notice = deliveryBlocker(target, false); cx.notify(); return; }
    this.reviewSend = { comparison: this.comparisonKey(), branch: this.data.snapshot.branch, target: target.address };
    this.notice = null; this.composerOpen = false;
    this.reviewOptionsOpen = false; this.fileActionsOpen = false; this.scopeMenuOpen = false; this.orderModelOpen = false; this.baseOpen = false;
    this.reviewNote.editor.focus(); cx.notify();
  }

  cancelReviewSend(cx) {
    if (this.busy) return;
    this.reviewSend = null; this.focusReview(); cx.notify();
  }

  confirmReviewSend(cx) {
    if (!this.reviewSendOpen || this.busy) return;
    if (this.currentSession()?.address !== this.reviewSend.target) {
      this.notice = "Source chat changed. Cancel and reopen Review & send."; cx.notify(); return;
    }
    this.sendToSession(cx);
  }

  reviewSendComposer() {
    const t = theme(), target = this.currentSession(), sameTarget = target?.address === this.reviewSend?.target;
    const count = pendingComments(this.data?.comments ?? []).length + this.threadQueue.size;
    const blocked = !sameTarget ? "Source chat changed. Cancel and reopen Review & send." : deliveryBlocker(target, this.hasReviewDrafts(), this.reviewNote.uncertain);
    return v_flex().id("review-send-composer").flex_none().px(12).py(8).gap(6).bg(t.surface).border_t(1).border_color(t.border)
      .child(h_flex().gap(6).items_center()
        .child(div().flex_1().min_w(0).truncate().font_semibold().child(`${count} review items → ${this.reviewSend?.target}`))
        .child(this.button("review-send-cancel", "Cancel", cx => this.cancelReviewSend(cx))))
      .child(this.reviewNoteComposer())
      .when(Boolean(blocked && !this.reviewNote.uncertain), el => el.child(div().text_size(11).text_color(t.ansi3).child(blocked)))
      .child(h_flex().justify_end().child(this.button("review-send-confirm", this.busy ? "Sending…" : "Send review", cx => this.confirmReviewSend(cx),
        !blocked && !this.snapshotError && (count > 0 || Boolean(this.reviewNote.editor.value().trim())), "primary").tooltip(blocked ?? "Send review · ⌘Enter / Ctrl+Enter")));
  }

  sendToSession(cx, thread = null) {
    if (this.busy || this.snapshotError || !this.data || contextKey() !== this.context || this.hasReviewDrafts()) return;
    const threads = thread ? [{ id: thread.id, fingerprint: thread.fingerprint }] : [...this.threadQueue.values()];
    const note = thread ? "" : this.reviewNote.editor.value();
    if (!thread && this.reviewNote.uncertain) return;
    if (!thread && !pendingComments(this.data.comments).length && !threads.length && !note.trim()) return;
    const target = this.currentSession();
    if (!reviewTargetReady(target)) {
      this.notice = target ? `The open session is ${target.status}. Send when it is idle or working; permission prompts are never bypassed.`
        : "Focus the agent chat in this tab first. Reviews are never routed to another tab automatically.";
      cx.notify(); return;
    }
    this.act("send", { target: target.address, threads, include_local: !thread, note }, cx);
  }

  get reviewNote() {
    return this.reviewNotes.get(this.context) ?? this.blankReviewNote;
  }

  createReviewNote() {
    const editor = TextareaState.new({ placeholder: "General note (optional)…", rows: 2 });
    editor.on("focus", () => { this.reviewNoteFocused = true; });
    editor.on("blur", () => { this.reviewNoteFocused = false; });
    editor.on("change", (_event, cx) => { this.publishUpdateState(); cx.notify(); });
    editor.on("submit", (event, cx) => {
      if (event.secondary && !event.shift && !event.is_held && !event.alt && this.reviewSendOpen) this.reviewShortcut(cx, false);
    });
    return { editor, uncertain: false };
  }

  ensureReviewNote(context) {
    if (!this.reviewNotes.has(context)) this.reviewNotes.set(context, this.createReviewNote());
  }

  reviewNoteComposer() {
    if (!this.reviewNotes.has(this.context)) return div().h(0);
    const note = this.reviewNote;
    return v_flex().gap(4)
      .child(Textarea.new(note.editor).id("review-general-note").h(54).w_full())
      .when(note.uncertain, el => el
        .child(div().text_size(11).text_color(theme().ansi3).child("Delivery unconfirmed. Check the chat before sending this note again."))
        .child(this.button("review-note-checked", "I checked chat · Allow sending again", cx => { note.uncertain = false; cx.notify(); })));
  }

  refreshGithub(cx, force = false) {
    const context = contextKey(), scope = location().scope;
    if (this.snapshotError || !scope.repo) return;
    this.githubRefresh.demand(context, scope, force);
    cx.spawn(cx => this.githubRefresh.drain(request => this.request(request),
      key => contextKey() === key && !this.snapshotError, () => cx.notify()));
  }

  changeComparison(mode, base, cx, explicit = undefined) {
    if (this.busy) return;
    this.reviewSend = null;
    this.stashNavigationDraft();
    this.baseExplicit = explicit ?? (base !== this.base ? Boolean(base) : this.baseExplicit);
    this.mode = mode; this.base = base; this.baseOpen = false; this.scopeMenuOpen = false; this.selection = null;
    this.open = this.navigationFiles.get(this.comparisonKey()) ?? this.open;
    this.activeComment = null; this.activeCommentIds = null;
    this.notice = this.restoreNavigationDraft() ? "Unfinished comment restored for this file and comparison." : null;
    this.rememberFull({ mode });
    if (mode === "branch") this.rememberBase(location().scope, base);
    if (mode === "branch" && !this.baseExplicit && !base && this.full) {
      const scope = location().scope, key = JSON.stringify([scope.machine ?? null, scope.repo]);
      setShared("annotator.baseRefs", { ...(shared("annotator.baseRefs") ?? {}), [key]: { base: null, explicit: false } });
    }
    this.data = null;
    this.refresh(cx, false, true);
  }

  expandContext(lines, cx) {
    if (this.busy) return;
    this.contextLines = lines; this.rememberFull({ contextLines: lines });
    if (!this.editor.value().trim()) this.selection = null;
    this.refresh(cx, false, true);
  }

  openFull(cx) {
    if (!this.data || this.busy || this.openingFull) return;
    const current = location(), snapshot = this.data.snapshot, target = this.currentSession();
    const existing = existingReviewTab({ ...current, scope: snapshot.scope }, spaces(), panes(), shared("annotator.fullTabs") ?? {});
    if (existing) {
      if (existing.pane) run("pane.focus", { pane: existing.pane });
      else run("tab.select", { id: existing.tab });
      cx.notify(); return;
    }
    const args = { name: `Review · ${snapshot.branch ?? "changes"}`, space: current.space,
      mod: "annotator", props: { presentation: "full", scope: snapshot.scope,
        space: current.space, tab: current.tab, source_target: target?.address ?? null,
         file: this.open, base_explicit: this.baseExplicit, context_lines: this.contextLines, view: this.view,
         source_draft: this.hasDraft(),
        ...(props()?.helper ? { helper: props().helper } : {}) } };
    const sourcePanel = layoutSidebar(layout());
    this.openingFull = true;
    cx.spawn(async cx => {
      try {
        // run() has no return value. The local app CLI returns the exact created
        // tab/pane, so only that tab is registered and focused, including on SSH.
        const result = await exec("herdr-app", ["do", "tab.new", JSON.stringify(args)]);
        const made = JSON.parse(result.stdout);
        if (result.code !== 0 || made.error || !made.tab || !made.pane) throw new Error(made.error ?? "Could not create review tab");
        const qualify = id => current.scope.machine && !id.startsWith(`${current.scope.machine}/`) ? `${current.scope.machine}/${id}` : id;
        const tab = qualify(made.tab), pane = qualify(made.pane);
        setShared("annotator.fullTabs", { ...(shared("annotator.fullTabs") ?? {}),
          [tab]: { sourceTab: current.tab, space: current.space, sourcePanel, scope: snapshot.scope } });
        run("pane.focus", { pane });
      } catch (e) { this.error = String(e); }
      finally { this.openingFull = false; cx.notify(); }
    });
  }

  syncSidebar() {
    const transition = reviewSidebarTransition(shared("annotator.sidebarFocus"), focused() ?? {},
      shared("annotator.fullTabs") ?? {}, layoutSidebar(layout()));
    if (!transition) return;
    setShared("annotator.sidebarFocus", transition.state);
    for (const action of transition.actions) run(action.name, action.args);
  }

  markGithubRead(thread, cx) {
    if (this.busy || this.snapshotError || !this.data) return;
    const context = this.context;
    this.busy = true;
    cx.spawn(async cx => {
      try {
        const data = await this.request({ op: "github_read", scope: this.data.snapshot.scope,
          thread: { id: thread.id, fingerprint: thread.fingerprint }, read: !thread.read });
        if (contextKey() === context) this.github = data.github;
      } catch (e) { if (contextKey() === context) this.error = String(e); }
      finally { this.busy = false; cx.notify(); }
    });
  }

  githubReplyId() { return `reply-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

  beginGithubReply(thread, cx) {
    const key = JSON.stringify([this.context, thread.id]);
    let draft = this.githubDrafts.get(key);
    if (!draft) {
      const editor = TextareaState.new({ placeholder: "Reply to this GitHub thread…", rows: 3 });
      editor.on("change", (_event, cx) => { this.publishUpdateState(); cx.notify(); });
      draft = { editor, id: this.githubReplyId(), status: null, error: null };
      this.githubDrafts.set(key, draft);
      this.publishUpdateState();
    }
    // Clicking Reply explicitly accepts the currently displayed thread version.
    draft.thread = { id: thread.id, fingerprint: thread.fingerprint };
    draft.editor.focus(); cx.notify();
  }

  postGithubReply(thread, cx, retry = false) {
    const context = this.context, key = JSON.stringify([context, thread.id]);
    const draft = this.githubDrafts.get(key);
    if (this.busy || this.snapshotError || this.github?.error || !this.data || contextKey() !== context
      || !draft?.editor.value().trim() || (draft.status === "uncertain" && !retry)) return;
    const body = draft.editor.value(), scope = this.data.snapshot.scope;
    this.busy = true; draft.error = null; this.notice = null;
    cx.spawn(async cx => {
      try {
        const data = await this.request({ op: "github_reply", scope, thread: draft.thread, body, reply_id: draft.id, retry });
        draft.id = data.reply_id; draft.status = data.reply.status; draft.error = data.reply.error;
        if (data.reply.status === "confirmed") {
          if (draft.editor.value() === body) this.githubDrafts.delete(key);
          else { draft.id = this.githubReplyId(); draft.status = null; }
        }
        if (contextKey() === context) {
          this.githubRefresh.replace(data.github, context);
          if (data.reply.status === "confirmed") this.notice = "Reply posted to GitHub.";
        }
      } catch (e) {
        draft.status = "uncertain"; draft.error = String(e);
      } finally { this.busy = false; cx.notify(); }
    });
    cx.notify();
  }

  githubCard(thread, t) {
    const queued = this.threadQueue.has(thread.id);
    const enabled = !thread.resolved && !thread.delivery && !thread.incomplete && !this.github?.error;
    const key = JSON.stringify([this.context, thread.id]), draft = this.githubDrafts.get(key);
    return v_flex().id(`thread-${thread.id}`).m(8).p(10).gap(7).rounded(8).bg(t.surface).border_1().border_color(t.border)
      .child(div().text_size(10.5).text_color(thread.read ? t.dim : t.accent).child(thread.read ? "Read" : "● Unread"))
      .child(div().font_semibold().text_size(12).child(`${thread.path}:${thread.start_line ?? thread.line ?? "?"}${thread.start_line ? `–${thread.line}` : ""} · ${thread.side}`))
      .child(div().text_size(11).text_color(t.muted).child(thread.resolved ? "Resolved" : thread.delivery ? `Delivery: ${thread.delivery}` : thread.incomplete ? "Incomplete thread · cannot send" : `${thread.outdated ? "Outdated location · " : ""}${thread.has_updates ? "New replies · " : ""}Open`))
      .children(thread.comments.map((c, index) => v_flex().gap(3)
        .child(div().text_size(11).text_color(t.accent).child(`@${c.author}`))
        .child(this.selectableText(`thread-body-${thread.id}-${index}`, c.body).text_size(12))))
      .child(h_flex().gap(5).flex_wrap()
        .child(this.button(`copy-thread-${thread.id}`, "Copy thread", cx => this.copyText(`${thread.path}:${thread.line ?? "?"}\n\n${thread.comments.map(comment => `@${comment.author}\n${comment.body}`).join("\n\n")}`, cx)))
        .child(this.button(`reply-thread-${thread.id}`, "Reply", cx => this.beginGithubReply(thread, cx), !thread.incomplete && !this.github?.error))
        .child(this.button(`read-thread-${thread.id}`, thread.read ? "Mark unread" : "Mark read", cx => this.markGithubRead(thread, cx)))
        .child(this.button(`queue-${thread.id}`, queued ? "Remove from review" : "Add to review", cx => {
          if (queued) this.threadQueue.delete(thread.id);
          else this.threadQueue.set(thread.id, { id: thread.id, fingerprint: thread.fingerprint });
          cx.notify();
        }, enabled, "secondary"))
        .child(this.button(`fix-${thread.id}`, "Fix thread", cx => this.sendToSession(cx, thread), enabled && !this.editor.value().trim() && reviewTargetReady(this.currentSession()), "primary")))
      .when(Boolean(draft), el => el.child(v_flex().gap(7)
        .child(div().text_size(11).text_color(t.muted).child("Posts as your signed-in GitHub account. Does not send to the agent."))
        .child(div().p(8).rounded(6).bg(t.background).border_1().border_color(t.border)
          .child(Textarea.new(draft.editor).h(85).w_full().text_size(13)))
        .when(Boolean(draft.error), el => el.child(div().text_size(12).text_color(t.ansi3).child(draft.error)))
        .when(draft.status === "uncertain", el => el.child(div().text_size(11).text_color(t.ansi3).child("Posting is not confirmed. Check the thread on GitHub before posting again; a retry could duplicate your reply.")))
        .child(h_flex().gap(5).flex_wrap()
          .child(this.button(`cancel-reply-${thread.id}`, "Cancel", cx => { this.githubDrafts.delete(key); cx.notify(); }))
          .child(this.button(`post-reply-${thread.id}`, "Post to GitHub", cx => this.postGithubReply(thread, cx), Boolean(draft.editor.value().trim()) && draft.status !== "uncertain" && !this.github?.error, "primary"))
          .when(draft.status === "uncertain", el => el.child(this.button(`retry-reply-${thread.id}`, "I checked GitHub · Post again", cx => this.postGithubReply(thread, cx, true), Boolean(draft.editor.value().trim()) && !this.github?.error))))));
  }

  button(id, text, action, enabled = true, variant = "quiet") {
    const t = theme();
    const copied = this.copiedId === id;
    const active = enabled && (!this.busy || id.startsWith("copy-")) && !(this.snapshotError && needsFreshSnapshot(id));
    return h_flex().id(id).h(29).px(10).rounded(6).text_size(12).items_center().justify_center().flex_none()
      .text_color(copied ? t.ansi2 : active ? t.foreground : t.dim)
      .opacity(copied ? 0.72 : 1).transition("opacity", 140)
      .when(variant === "primary", el => el.bg(active ? t.accent : t.raised)
        .text_color(active ? t.accent_foreground : t.dim).font_semibold())
      .when(variant === "secondary", el => el.bg(t.surface).border_1().border_color(t.border))
      .when(active, el => el.cursor_pointer().hover(s => variant === "primary" ? s.opacity(0.85) : s.bg(t.hover))
        .on_click((_e, cx) => {
          this.focusReview(); this.copySource = id.startsWith("copy-") ? id : null;
          try { action(cx); } finally { this.copySource = null; this.publishUpdateState(); }
        })).child(copied ? "✓ Copied" : text);
  }

  badge(text, color, background = null) {
    return h_flex().px(6).h(19).rounded(4).items_center().text_size(10.5).text_color(color)
      .when(Boolean(background), el => el.bg(background)).child(text);
  }

  selectFile(path, cx) {
    if (this.busy) return;
    this.reviewSend = null;
    this.focusReview();
    if (path === this.open) {
      this.view = "diff";
      if (!this.data?.snapshot.files.find(file => file.path === path)?.loaded) this.refresh(cx, false, true);
      cx.notify(); return;
    }
    this.stashNavigationDraft(); this.open = path; this.activeComment = null; this.activeCommentIds = null;
    this.notice = this.restoreNavigationDraft() ? "Unfinished comment restored for this file and comparison." : null;
    this.view = "diff"; this.refresh(cx, false, true); cx.notify();
  }

  selectLine(row, event, cx) {
    if (this.busy || this.editDraft || this.questionDraft) return;
    this.reviewSend = null;
    this.draft.anchor(selectionFor(this.selection, row, event?.modifiers?.shift), this.data?.snapshot.revision);
    this.activeComment = null; this.activeCommentIds = null; this.composerOpen = true;
    this.exportText = null; this.notice = null; this.editor.focus(); cx.notify();
  }

  commentCard(comment, t, showFile = false) {
    const status = commentStatus(comment);
    const color = t[status.tone];
    const path = pathParts(comment.path);
    const hasDiff = this.data?.snapshot.files.some(f => f.path === comment.path);
    return v_flex().id(`note-${comment.id}`).mx(8).my(6).p(10).gap(7).rounded(8)
      .bg(t.surface).border_1().border_color(t.border).border_l(3).border_color(color)
      .when(showFile, el => el.child(h_flex().items_center().gap(4)
        .child(div().flex_1().min_w(0).truncate().text_size(12).font_semibold().child(path.name))
        .child(this.button(`open-note-${comment.id}`, hasDiff ? "View code" : "No diff", cx => {
          if (!this.busy && !this.editor.value().trim()) this.contextLines = Math.max(this.contextLines, comment.context ?? 3);
          this.selectFile(comment.path, cx);
        }, Boolean(hasDiff)))))
      .when(showFile && Boolean(path.folder), el => el.child(div().text_size(10.5).text_color(t.dim).child(path.folder)))
      .child(h_flex().items_center().gap(6)
        .child(this.badge("YOU", t.muted, t.raised))
        .child(this.badge(comment.read ? "Read" : "Unread", comment.read ? t.dim : t.accent))
        .child(div().flex_1().text_size(11).text_color(t.muted).child(commentLocation(comment)))
        .child(this.badge(status.label, color, color + "18")))
      .when(this.editDraft?.id !== comment.id, el => el.child(this.selectableText(`comment-body-${comment.id}`, comment.body).text_size(13).text_color(t.foreground)))
      .when(this.editDraft?.id === comment.id, el => el.child(v_flex().gap(5)
        .child(Textarea.new(this.editDraft.editor).h(70).w_full())
        .child(h_flex().gap(4)
          .child(this.button(`cancel-edit-${comment.id}`, "Cancel", cx => { this.edits.delete(this.navigationKey()); cx.notify(); }))
          .child(this.button(`save-edit-${comment.id}`, "Save changes", cx => this.saveEdit(cx), Boolean(this.editDraft.editor.value().trim()), "primary")))))
      .when(comment.stale && !comment.resolved && !comment.delivery, el => el.child(div().text_size(11).text_color(t.ansi3)
        .child("Code changed. This comment will not be sent. Add a new comment on the current lines.")))
      .when(comment.delivery === "uncertain", el => el.child(div().text_size(11).text_color(t.ansi3)
        .child("Check the chat before sending again; it may already have received this comment.")))
      .child(h_flex().gap(4).justify_end()
        .child(this.button(`copy-comment-${comment.id}`, "Copy", cx => this.copyText(comment.body, cx)))
        .when(!comment.resolved && !comment.delivery, el => el
          .child(this.button(`edit-${comment.id}`, "Edit", cx => this.beginEdit(comment, cx), !this.hasDraft()))
          .child(this.button(`delete-${comment.id}`, "Delete…", cx => { this.deleting = comment.id; cx.notify(); }, !this.hasDraft())))
        .child(this.button(`read-${comment.id}`, comment.read ? "Mark unread" : "Mark read", cx => this.act("read", { id: comment.id, read: !comment.read }, cx), !this.editDraft))
        .when(Boolean(comment.delivery) && !comment.resolved, el => el.child(this.button(`requeue-${comment.id}`, "Send again…", cx => {
          this.requeue = this.requeue === comment.id ? null : comment.id; cx.notify();
        })))
        .child(this.button(`resolve-${comment.id}`, comment.resolved ? "Reopen" : "✓ Resolve", cx => this.act("resolve", { id: comment.id, resolved: !comment.resolved }, cx), !this.editDraft, "secondary")))
      .when(this.deleting === comment.id, el => el.child(h_flex().gap(4)
        .child(this.button(`cancel-delete-${comment.id}`, "Keep comment", cx => { this.deleting = null; cx.notify(); }))
        .child(this.button(`confirm-delete-${comment.id}`, "Delete permanently", cx => {
          this.deleting = null; this.act("delete", { id: comment.id, expected_body: comment.body }, cx);
        }, !this.hasDraft(), "secondary"))))
      .when(this.requeue === comment.id, el => el.child(v_flex().gap(4)
        .child(div().text_size(11).text_color(t.ansi3).child("Requeue only after checking the chat. This can duplicate feedback."))
        .child(this.button(`confirm-requeue-${comment.id}`, "Confirm requeue", cx => {
          this.requeue = null; this.act("resolve", { id: comment.id, resolved: false }, cx);
        }, true, "secondary"))));
  }

  fileRow(file, count, t, draft = false) {
    const path = pathParts(file.path), stats = fileStats(file);
    const active = file.path === this.open;
    const code = file.draftOnly ? "·" : file.status.includes("D") ? "D" : file.status.includes("A") || file.status === "??" ? "+" : "M";
    const color = code === "D" ? t.ansi1 : code === "+" ? t.ansi2 : t.ansi3;
    return h_flex().id(`file-${file.path}`).h(42).flex_none().px(10).py(5).gap(8).items_center().cursor_pointer()
      .border_l(3).border_color(active ? t.accent : t.chrome)
      .bg(active ? t.selected : t.chrome).hover(s => s.bg(t.hover))
      .child(h_flex().size(23).rounded(5).bg(color + "18").text_color(color).text_size(11).font_semibold().items_center().justify_center().flex_none().child(code))
      .child(v_flex().flex_1().min_w(0).gap(1)
        .child(div().truncate().text_size(12.5).font_semibold().child(path.name))
        .when(Boolean(path.folder), el => el.child(div().truncate().text_size(10.5).text_color(t.dim).child(path.folder))))
      .child(v_flex().gap(2).items_end().flex_none()
        .child(h_flex().gap(5)
          .when(stats.added > 0, el => el.child(div().text_size(10.5).text_color(t.ansi2).child(`+${stats.added}`)))
          .when(stats.removed > 0, el => el.child(div().text_size(10.5).text_color(t.ansi1).child(`−${stats.removed}`))))
        .child(h_flex().gap(3)
          .when(draft, el => el.child(this.badge("Draft", t.accent, t.accent + "18")))
          .when(count > 0, el => el.child(this.badge(`${count} comment${count === 1 ? "" : "s"}`, t.accent, t.accent + "18")))));
  }

  codeRows(file, comments, t) {
    const inline = comments.filter(c => c.path === file.path && !c.stale && c.position);
    return file.rows.flatMap((row, i) => {
      const active = selected(row, this.selection);
      const selectable = !file.truncated && (row.old != null || row.new != null);
      const code = h_flex().id(`diff-${i}`).w_full().min_h(25).py(3).flex_none().gap(5).pr(8).items_start()
        .font_family(settings().font ?? "JetBrains Mono").text_size(12)
        .border_l(3).border_color(active ? t.accent : t.background)
        .when(row.kind === "hunk", el => el.bg(t.raised).text_color(t.dim))
        .when(row.kind === "add", el => el.bg(t.ansi2 + "16"))
        .when(row.kind === "delete", el => el.bg(t.ansi1 + "16"))
        .when(active, el => el.bg(t.selected))
        .when(selectable, el => el.cursor_pointer().hover(s => s.bg(t.hover))
          .on_click((event, cx) => this.selectLine(row, event, cx)))
        .when(selectable || row.kind === "hunk", el => el.on_mouse_down("right", (_event, cx) => {
          cx.stop_propagation();
          this.beginQuestion(row.kind === "hunk" ? { kind: "hunk", row: i }
            : { kind: "selection", selection: selectionPayload(selectionFor(null, row)) }, cx);
        }))
        .child(div().w(29).flex_none().text_right().text_color(active ? t.accent : t.dim).child(row.old == null ? "" : String(row.old)))
        .child(div().w(29).flex_none().text_right().text_color(active ? t.accent : t.dim).child(row.new == null ? "" : String(row.new)))
        .child(div().w(10).flex_none().text_color(row.kind === "add" ? t.ansi2 : row.kind === "delete" ? t.ansi1 : t.dim)
          .child(row.kind === "add" ? "+" : row.kind === "delete" ? "−" : ""))
        .child(this.codeText(row, null, t, this.syntaxCache?.tokens));
      return [code, ...inline.filter(c => inlineAt(c, row)).map(c => this.commentCard(c, t))];
    });
  }

  render(cx) {
    this.publishUpdateState();
    if (this.updates?.running) return this.updateScreen();
    this.syncSidebar();
    if (contextKey() !== this.context && (!this.busy || this.snapshotRequest)) this.refresh(cx);
    this.consumeOpenRequest(cx);
    if (contextKey() === this.context && this.machineUnavailable(location().scope) && !this.snapshotError) {
      this.snapshotFailed(`Machine ${location().scope.machine} is unavailable`, location().scope);
    }
    const t = theme();
    const current = contextKey() === this.context;
    if (!current) return div().p(12).text_color(t.dim).child("Finishing the previous worktree's request…");
    if (this.snapshotError?.kind === "not-repository") return this.emptyCheckout(t);
    if (this.full) return renderFull(this, cx);
    const data = current ? this.data : null;
    const files = this.reviewFiles(data?.snapshot);
    const allComments = data?.comments ?? [];
    const comments = visibleComments(allComments, this.showResolved);
    const threads = visibleComments(this.github?.threads ?? [], this.showResolved);
    const listedComments = unreadItems(comments, this.onlyUnread);
    const commentCounts = new Map();
    const draftPaths = this.draftPaths();
    for (const comment of comments) commentCounts.set(comment.path, (commentCounts.get(comment.path) ?? 0) + 1);
    const file = files.find(f => f.path === this.open);
    const fileComments = file ? comments.filter(c => c.path === this.open) : [];
    const other = fileComments.filter(c => c.stale || !c.position);
    const missing = comments.filter(c => !files.some(f => f.path === c.path));
    const pending = pendingComments(allComments);
    const target = this.currentSession();
    const selection = this.selection;
    const canSave = this.canSaveComment();
    const summary = reviewSummary(comments);
    const hasDraft = this.hasDraft();
    const reviewDrafts = this.hasReviewDrafts();
    const sendBlocked = deliveryBlocker(target, reviewDrafts, this.reviewNote.uncertain);
    const source = file ? pathParts(file.path) : null;
    const stats = file ? fileStats(file) : null;
    const chat = target?.program?.name ?? (target?.app === "opencode" ? "OpenCode" : target?.app) ?? "Agent";
    const batchSize = pending.length + this.threadQueue.size + (this.reviewNote.editor.value().trim() ? 1 : 0);
    const sendLabel = batchSize ? `Review & send… · ${batchSize}` : "Review & send…";
    return v_flex().id("annotator-root").size_full().min_h(0).bg(t.background).text_color(t.foreground).text_size(13).track_focus(this.handle)
      .on_key_down((event, cx) => this.handleKey(event, cx))
      .child(v_flex().flex_none().bg(t.chrome).px(10).py(6)
        .child(h_flex().items_center().gap(7)
          .child(div().font_semibold().text_size(14).child("Changes"))
          .child(this.selectableText("review-branch-name", `${data?.snapshot.scope.machine ? data.snapshot.scope.machine + " · " : ""}${data?.snapshot.branch ?? ""}`).flex_1().min_w(0).truncate().text_size(11).text_color(t.dim))
          .child(this.button("open-full-review", "↗", cx => this.openFull(cx), Boolean(data)).tooltip("Open full review tab"))
          .child(this.button("review-updates", "↑", cx => { this.updates.save({ open: !this.updates.state.open }); this.updates.check(cx); cx.notify(); }).tooltip("Annotator updates"))
          .child(this.button("review-refresh", this.busy ? "…" : "↻", cx => { this.refresh(cx, true); this.refreshGithub(cx, true); }).tooltip("Refresh diff and GitHub"))))
      .child(this.updatePanel())
      .when(Boolean(this.error), el => el.child(this.errorCard(t)))
      .when(Boolean(this.notice), el => el.child(div().mx(8).my(4).p(8).rounded(6).bg(t.raised).text_size(11.5).text_color(t.muted).child(this.notice)))
      .child(h_flex().h(33).flex_none().px(6).gap(4).bg(t.chrome).border_b(1).border_color(t.border)
        .child(this.button("view-diff", "Code", cx => { this.view = "diff"; cx.notify(); }, true, this.view === "diff" ? "secondary" : "quiet"))
         .child(this.button("view-comments", `Comments · ${summary.total}`, cx => { this.view = "comments"; cx.notify(); }, true, this.view === "comments" ? "secondary" : "quiet"))
          .child(this.button("view-github", `GitHub · ${threads.length}`, cx => { this.view = "github"; this.refreshGithub(cx); cx.notify(); }, true, this.view === "github" ? "secondary" : "quiet"))
         .when(summary.outdated > 0, el => el.child(this.badge(`${summary.outdated} outdated`, t.ansi3, t.ansi3 + "18"))))
       .when(this.resolvedCount() > 0 || this.showResolved, el => el.child(h_flex().px(6).flex_none().bg(t.chrome).child(this.resolvedFilter("filter-resolved"))))
        .when(this.view === "diff", el => el.child(h_flex().px(5).gap(3).flex_none().bg(t.chrome)
          .child(this.orderButton("order-logically"))
          .when(Boolean(this.orderEntry()?.files), el => el.child(this.button("reset-file-order", "Reset order", cx => this.resetOrder(cx))))))
        .child(h_flex().id("files-scope-row").h(31).flex_none().px(5).gap(3).items_center().bg(t.chrome)
        .when(this.view === "diff", el => el.child(this.button("toggle-files", `${this.filesOpen ? "▾" : "▸"} Files · ${data ? files.length : "—"}`, cx => { this.filesOpen = !this.filesOpen; cx.notify(); })))
        .when(this.view !== "diff", el => el.child(this.button("filter-unread", this.onlyUnread ? "● Unread only" : "All comments", cx => { this.onlyUnread = !this.onlyUnread; cx.notify(); })))
         .child(div().flex_1().min_w(0))
        .child(this.button("scope-menu", `${this.mode === "branch" ? "Branch" : this.mode === "last_commit" ? "Last commit" : "Uncommitted"} ▾`, cx => { this.scopeMenuOpen = !this.scopeMenuOpen; this.baseOpen = false; cx.notify(); }, true, "secondary"))
        .when(this.mode === "branch", el => el.child(this.button("choose-base", `${this.baseLabel()} ▾`, cx => this.openBasePicker(cx))
          .flex_shrink(1).min_w(0).max_w(145).truncate().tooltip(this.base ?? "Choose base branch"))))
      .when(this.scopeMenuOpen, el => el.child(h_flex().id("scope-options").px(8).gap(4).bg(t.chrome)
        .child(this.button("scope-uncommitted", "Uncommitted", cx => this.changeComparison("uncommitted", null, cx), true, this.mode === "uncommitted" ? "secondary" : "quiet"))
        .child(this.button("scope-last-commit", "Last commit", cx => this.changeComparison("last_commit", null, cx), !data || Boolean(data.snapshot.head), this.mode === "last_commit" ? "secondary" : "quiet"))
        .child(this.button("scope-branch", "Branch", cx => this.changeComparison("branch", this.base, cx), true, this.mode === "branch" ? "secondary" : "quiet"))))
      .when(this.baseOpen, el => el.child(this.basePicker()))
      .when(this.orderModelOpen, el => el.child(this.orderModelPanel()))
      .child(v_resizable("annotator-sections").flex_1().min_h(0)
        .on_resize((sizes, cx) => { this.sizes = sizes; setShared("annotator.sections", sizes); cx.notify(); })
        .child(resizable_panel().size(this.sizes[0]).size_range(50).visible(this.view === "diff" && this.filesOpen && files.length > 0)
          .child(this.view === "diff" && this.filesOpen ? v_flex().id("review-files").relative().size_full().min_h(0)
            .child(v_virtual_list("review-files-list", files.length, 42,
              index => files[index].path,
              range => files.slice(range.start, range.end).map(f => this.fileRow(f, commentCounts.get(f.path) ?? 0, t, draftPaths.has(f.path))))
              .size_full().on_item_click((path, cx) => this.selectFile(path, cx)))
            .child(Scrollbar.vertical("review-files-list").absolute().inset_0()) : div()))
        .child(resizable_panel().size(this.sizes[1]).size_range(90).child(v_flex().size_full().min_h(0)
      .when(this.view === "diff", el => el
        .when(Boolean(file), el => el.child(v_flex().flex_none().px(12).py(7).gap(3).border_t(1).border_b(1).border_color(t.border)
          .child(h_flex().gap(6).items_center().child(div().flex_1().min_w(0).truncate().font_semibold().text_size(12.5).child(source?.name))
            .when(stats?.added > 0, el => el.child(this.badge(`+${stats.added}`, t.ansi2)))
            .when(stats?.removed > 0, el => el.child(this.badge(`−${stats.removed}`, t.ansi1))))
          .when(Boolean(source?.folder), el => el.child(div().text_size(10.5).text_color(t.dim).truncate().child(source.folder)))
          .child(div().text_size(10.5).text_color(t.dim).child("Click a line to comment · Shift-click for a range"))
          .child(h_flex().gap(4)
            .child(this.button("context-more", "+20 context", cx => this.expandContext(Math.min(1000000, this.contextLines + 20), cx), this.contextLines < 1000000))
            .child(this.button("context-all", "Full context", cx => this.expandContext(1000000, cx), this.contextLines < 1000000))
            .child(this.button("context-reset", "Collapse", cx => this.expandContext(3, cx), this.contextLines > 3)))
          .child(h_flex().gap(4)
            .child(this.button("copy-menu", "Copy…", cx => { this.copyMenuOpen = !this.copyMenuOpen; cx.notify(); }))
            .child(this.button("ask-file", "Ask about diff", cx => this.beginQuestion({ kind: "file" }, cx), !hasDraft && file?.loaded && !file?.truncated))
            .when(Boolean(selection), el => el.child(this.button("ask-selection", "Ask about selection", cx => this.beginQuestion({ kind: "selection", selection: selectionPayload(selection) }, cx), !hasDraft))))))
        .when(this.copyMenuOpen, el => el.child(this.copyMenu(file)))
        .child(v_flex().id("review-diff").flex_1().min_h(0).overflow_y_scrollbar().children([
          ...(file?.note ? [div().m(8).p(8).rounded(5).bg(t.raised).text_size(11).text_color(t.muted).child(file.note)] : []),
          ...(file ? this.codeRows(file, comments, t) : [v_flex().p(18).gap(7)
            .child(div().font_semibold().child(this.busy ? "Loading changes…" : this.snapshotError?.title ?? (data ? "No changes to review" : "Select a Git checkout")))
            .child(div().text_size(12).text_color(t.muted).child(this.snapshotError ? "Changes could not be loaded. No files or saved comments were removed." : data ? "Saved feedback is kept in Comments, even when the code is committed." : "Open a project space to review its uncommitted changes."))]),
          ...other.map(c => this.commentCard(c, t)),
          ...missing.map(c => this.commentCard(c, t, true)),
        ])))
      .when(this.view === "comments", el => el.child(v_flex().id("review-comments").flex_1().min_h(0).overflow_y_scrollbar().py(4)
        .children(listedComments.map(c => this.commentCard(c, t, true)))
        .when(!listedComments.length, el => el.child(v_flex().p(18).gap(8)
          .child(div().font_semibold().child(allComments.length ? "No comments match these filters" : "Your review starts with a comment"))
          .child(div().text_size(12).text_color(t.muted).child(allComments.length ? "Show sent/resolved or turn off Unread only to see saved notes." : "Choose a file in Code, select a line, and write what should change. Save several comments, then send them together."))))))
      .when(this.view === "github", el => el.child(v_flex().id("review-github").flex_1().min_h(0).overflow_y_scrollbar()
        .child(div().p(10).text_size(11).text_color(t.muted).child(this.githubBusy ? "Checking GitHub…" : this.github?.error ? "GitHub unavailable · local reviews still work" : this.github?.pull_request ? `${this.github.pull_request.url} · polls every 5 minutes` : "No open PR found for this branch. Refresh checks GitHub now."))
        .when(Boolean(this.github?.error), el => el.child(div().p(10).text_color(t.ansi3).child(this.github.error)))
        .when(Boolean(this.github?.limited), el => el.child(div().p(10).text_color(t.ansi3).child("GitHub thread limit reached; more threads exist on the PR.")))
        .children(unreadItems(threads, this.onlyUnread).map(thread => this.githubCard(thread, t)))))))
        .child(resizable_panel().size(this.sizes[2]).size_range(110).visible(!this.editDraft && !this.questionDraft && !this.reviewSendOpen).child(v_flex().size_full().min_h(0).overflow_y_scrollbar().child(v_flex().mx(8).mt(6).mb(8).p(9).gap(6).rounded(8).bg(t.surface).border_1().border_color(selection ? t.accent : t.border)
        .child(h_flex().items_center().gap(5)
          .child(div().flex_1().min_w(0).truncate().font_semibold().text_size(11.5).text_color(selection ? t.accent : t.foreground)
            .child(selection ? `Comment on ${selection.side === "old" ? "old " : ""}L${selection.start}${selection.end === selection.start ? "" : `–${selection.end}`}` : "Comment on this file"))
          .when(Boolean(selection) || this.needsSelection, el => el.child(this.button("file-note", "Whole file", cx => this.fileNote(cx), Boolean(file)))))
        .when(!selection, el => el.child(div().text_size(10.5).text_color(t.dim).child(file ? source.name : "Select a changed file first")))
        .child(div().rounded(5).bg(t.background).border_1().border_color(t.border).p(6)
          .child(Textarea.new(this.editor).h(65).w_full().text_size(13)))
        .child(h_flex().gap(5).items_center()
          .child(div().flex_1())
          .when(hasDraft || Boolean(selection), el => el.child(this.button("cancel-note", "Cancel", cx => {
            this.cancelDraft(cx);
          })))
          .child(this.button("save-note", "+ Save comment", cx => this.saveComment(cx), canSave, "primary").tooltip("Save comment · ⌘Enter / Ctrl+Enter")))))))
      .when(Boolean(this.questionDraft), el => el.child(this.questionComposer()))
      .when(Boolean(this.exportText), el => el.child(v_flex().mx(8).mb(8).p(8).gap(4).rounded(7).bg(t.surface).border_1().border_color(t.border).flex_none()
        .child(div().text_size(11).text_color(t.muted).child("Review text · select and copy"))
        .child(Textarea.new(this.output).h(95).w_full()).child(this.button("close-export", "Close", cx => { this.exportText = null; cx.notify(); }))))
      .when(this.reviewSendOpen, el => el.child(this.reviewSendComposer()))
      .when(!this.reviewSendOpen, el => el.child(v_flex().flex_none().p(8).gap(4).bg(t.chrome).border_t(1).border_color(t.border)
        .child(h_flex().gap(7).items_center()
          .child(h_flex().size(27).rounded(7).bg(t.accent + "18").text_color(t.accent).items_center().justify_center().font_semibold().child("↗"))
          .child(v_flex().flex_1().min_w(0).gap(1)
            .child(div().id("review-session").font_semibold().text_size(12).truncate().child(target ? `To ${chat} · ${target.address}` : "No chat selected"))
            .child(div().text_size(10.5).text_color(t.dim).child(`${pending.length} comments · ${this.threadQueue.size} GitHub threads ready`)))
          .when(Boolean(target), el => el.child(this.badge(target.status === "idle" ? "Ready" : target.status === "blocked" ? "Needs you" : "Working", target.status === "idle" ? t.ansi2 : t.ansi3)))
          .child(this.button("export-review", "Export…", cx => this.act("export", { threads: [...this.threadQueue.values()] }, cx), batchSize > 0)))
        .child(this.button("send-review", sendLabel, cx => this.beginReviewSend(cx), reviewTargetReady(target) && !reviewDrafts, "primary").w_full().h(29).tooltip(sendBlocked ?? "Add an optional general note, then send · ⌘Enter / Ctrl+Enter"))
        .when(Boolean(this.snapshotError || this.reviewNote.uncertain || (target && !reviewTargetReady(target))), el => el
          .child(div().text_size(10.5).text_color(t.ansi3).child(this.snapshotError ? "Refresh failed. Review actions paused." : deliveryBlocker(target, false, this.reviewNote.uncertain))))));
  }
}
