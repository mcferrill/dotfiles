export function reviewLocation(fixed, focus, spaceList, paneList, agentList) {
  if (fixed?.scope) return { scope: fixed.scope, space: fixed.space ?? null, tab: fixed.tab ?? null };
  const f = focus;
  const space = spaceList.find(s => s.id === f?.space) ?? spaceList.find(s => s.active);
  const tabs = new Set((space?.tabs ?? []).filter(t => t.active).map(t => t.id));
  const allTabs = new Set((space?.tabs ?? []).map(t => t.id));
  if (f?.pane === null && f?.terminal && f?.cwd) {
    const machine = f.terminal.includes("/") ? f.terminal.split("/")[0] : null;
    const owner = agentList.find(a => a.address === f.terminal);
    return { scope: { repo: f.cwd, machine }, space: owner?.space ?? null, tab: owner?.tab ?? f.tab ?? null };
  }
  const pane = paneList.find(p => p.pane === f?.pane && p.terminal) ?? paneList.find(p => tabs.has(p.tab) && p.cwd) ?? paneList.find(p => allTabs.has(p.tab) && p.cwd);
  return { scope: { repo: pane?.cwd || space?.folder || "", machine: space?.machine ?? null }, space: space?.id ?? null, tab: f?.tab ?? space?.tabs?.find(t => t.active)?.id ?? null };
}

export function selectionFor(previous, row, extend = false) {
  const side = row.new != null ? "new" : row.old != null ? "old" : null;
  if (!side) return previous;
  const line = row[side];
  const origin = extend && previous?.side === side ? previous.origin : line;
  return { side, start: Math.min(origin, line), end: Math.max(origin, line), origin };
}

export function selectionPayload(selection) {
  if (!selection) return null;
  const { side, start, end } = selection;
  return { side, start, end };
}

export function reviewedDraft(snapshot, path, selection) {
  const file = snapshot?.files.find(file => file.path === path);
  if (!file?.loaded) return null;
  let lines = null;
  if (selection) {
    const source = file.rows.filter(row => row[selection.side] != null);
    const start = source.findIndex(row => row[selection.side] === selection.start);
    const count = selection.end - selection.start + 1, selected = source.slice(start, start + count);
    if (start < 0 || count < 1 || count > 200 || selected.length !== count
      || !selected.every((row, index) => row[selection.side] === selection.start + index)) return null;
    lines = { selection: selectionPayload(selection), selected: selected.map(row => row.text),
      before: source.slice(Math.max(0, start - 2), start).map(row => row.text),
      after: source.slice(start + count, start + count + 2).map(row => row.text) };
  }
  const reviewed = { branch: snapshot.branch ?? null, head: snapshot.head ?? null, baseline: snapshot.baseline ?? null, anchor: { lines } };
  return JSON.stringify(reviewed).length <= 32768 ? reviewed : null;
}

export function escapeText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function copiedDiff(file) {
  return file.rows.map(row => `${row.kind === "add" ? "+" : row.kind === "delete" ? "-" : row.kind === "context" ? " " : ""}${row.text}`).join("\n");
}

export function copiedSelection(file, selection) {
  return selection ? file.rows.filter(row => selected(row, selection)).map(row => row.text).join("\n") : "";
}

export function selected(row, selection) {
  if (!selection) return false;
  const n = row[selection.side];
  return n != null && n >= selection.start && n <= selection.end;
}

export function inlineAt(comment, row) {
  return !comment.stale && comment.position && row[comment.position.side] === comment.position.end;
}

export function pendingComments(comments) {
  return comments.filter(c => !c.stale && !c.resolved && !c.delivery);
}

// Only the current tab is eligible. A focused agent wins; composer focus keeps
// the last chat from that tab. Never guess between multiple chats or other tabs.
export function sessionTarget(list, context, focus, remembered = null) {
  const machine = context.scope.machine ?? null;
  const candidates = list.filter(a => a.space === context.space && a.tab === context.tab
    && (a.address.includes("/") ? a.address.split("/")[0] : null) === machine);
  return candidates.find(a => a.address === focus?.terminal || (a.pane && a.pane === focus?.pane))
    ?? candidates.find(a => a.address === remembered)
    ?? (candidates.length === 1 ? candidates[0] : null);
}

export function fileStats(file) {
  return { added: file.rows.filter(r => r.kind === "add").length,
    removed: file.rows.filter(r => r.kind === "delete").length };
}

// Revision includes the selected preview. Keep reading order across navigation,
// but isolate checkouts/comparisons/heads and invalidate observed changed previews.
export function reviewOrderKey(snapshot) {
  return snapshot ? JSON.stringify([snapshot.scope, snapshot.branch, snapshot.head, snapshot.baseline,
    snapshot.files.map(file => [file.path, file.status])]) : null;
}

export function orderedReviewFiles(snapshot, order) {
  const files = snapshot?.files ?? [];
  if (!Array.isArray(order) || order.length !== files.length || new Set(order).size !== files.length) return files;
  const byPath = new Map(files.map(file => [file.path, file]));
  return order.every(path => byPath.has(path)) ? order.map(path => byPath.get(path)) : files;
}

export function pathParts(path) {
  const parts = path.split("/");
  return { name: parts.pop(), folder: parts.join("/") };
}

export function commentStatus(comment) {
  if (comment.resolved) return { label: "Resolved", tone: "dim" };
  if (comment.delivery === "uncertain") return { label: "Check delivery", tone: "ansi3" };
  if (comment.delivery === "sent") return { label: "Sent", tone: "ansi2" };
  if (comment.stale) return { label: "Outdated", tone: "ansi3" };
  return { label: "Ready to send", tone: "accent" };
}

export function commentLocation(comment) {
  const pos = comment.position ?? comment.anchor?.lines?.selection;
  if (!pos) return "File comment";
  const range = pos.start === pos.end ? `L${pos.start}` : `L${pos.start}–${pos.end}`;
  return `${comment.stale ? "Was " : ""}${pos.side === "old" ? "old " : ""}${range}`;
}

export function reviewSummary(comments) {
  return { total: comments.length, ready: pendingComments(comments).length,
    outdated: comments.filter(c => c.stale && !c.resolved && !c.delivery).length,
    sent: comments.filter(c => c.delivery === "sent").length };
}

export function sendHint(comments, target, hasDraft) {
  if (hasDraft) return "Save your draft to add it to this review.";
  const summary = reviewSummary(comments);
  if (!summary.ready) {
    if (summary.outdated) return `${summary.outdated} outdated comment${summary.outdated === 1 ? " is" : "s are"} excluded. Check the Comments tab.`;
    if (summary.sent) return "Feedback sent. Resolve comments once addressed.";
    return "Save comments above, then send them together.";
  }
  if (!target) return "Focus the agent chat you want to review in this tab.";
  if (target.status === "working") return "Send review while the source is working; the agent may queue or act on the message.";
  if (target.status !== "idle") return target.status === "blocked"
    ? "The chat needs your attention. Answer its prompt before sending."
    : "The chat is busy. Send when its current turn finishes.";
  return "Sends saved comments to this chat and submits with Enter.";
}

export function reviewTargetReady(target) {
  return target?.status === "idle" || target?.status === "working";
}

export function deliveryBlocker(target, hasDraft, uncertain = false) {
  if (hasDraft) return "Save or cancel unfinished comments in this comparison before sending.";
  if (uncertain) return "Delivery is unconfirmed. Check the source chat before allowing another send.";
  if (!target) return "Source chat unavailable. Return to the source tab and focus its agent.";
  if (target.status === "blocked") return "Source session needs your attention. Answer its prompt before sending the review.";
  if (!reviewTargetReady(target)) return "Source session is not ready. Check its status, or export this review.";
  return null;
}

// Pair contiguous removed/added runs without crossing a hunk or context line.
// Padding has no source number and must never become a comment anchor.
export function splitRows(rows) {
  const result = [];
  for (let i = 0; i < rows.length;) {
    const row = rows[i];
    if (row.kind !== "delete" && row.kind !== "add") {
      result.push({ kind: row.kind, text: row.text, sourceIndex: i,
        old: row.old == null ? null : row, new: row.new == null ? null : row });
      i++; continue;
    }
    const old = [], added = [];
    while (i < rows.length && (rows[i].kind === "delete" || rows[i].kind === "add")) {
      (rows[i].kind === "delete" ? old : added).push(rows[i++]);
    }
    for (let n = 0; n < Math.max(old.length, added.length); n++) {
      result.push({ kind: "change", old: old[n] ?? null, new: added[n] ?? null });
    }
  }
  return result;
}

export function splitSelectionRow(pair, side) {
  const row = pair[side];
  if (!row || row[side] == null) return null;
  return { ...row, [side === "old" ? "new" : "old"]: null };
}

export function unreadItems(items, onlyUnread) {
  return onlyUnread ? items.filter(item => !item.read) : items;
}

// Presentation only: saved state and delivery eligibility use the full review.
export function visibleComments(items, showResolved = false) {
  return showResolved ? items : items.filter(item => !item.resolved && item.delivery !== "sent");
}

export function diffEntries(rows, comments, split) {
  const byLine = new Map(), placed = new Set(), entries = [];
  const note = comment => { placed.add(comment.id); entries.push({ key: `note-${comment.id}`, comment }); };
  for (const comment of comments) {
    if (!comment.stale && comment.position) {
      const key = `${comment.position.side}:${comment.position.end}`;
      if (!byLine.has(key)) byLine.set(key, []);
      byLine.get(key).push(comment);
    } else if (!comment.stale) note(comment);
  }
  rows.forEach((row, index) => {
    entries.push({ key: `row-${index}`, row });
    for (const side of ["old", "new"]) {
      const line = split ? row[side]?.[side] : row[side];
      if (line == null) continue;
      for (const comment of byLine.get(`${side}:${line}`) ?? []) {
        if (!placed.has(comment.id)) note(comment);
      }
    }
  });
  // Outdated notes and anchors outside collapsed context remain visible.
  for (const comment of comments) if (!placed.has(comment.id)) note(comment);
  return entries;
}

// gpui-shell 0.7.1 replaces the entire measured list when its count changes,
// which sends the viewport back to the first item. Reserve one notes slot per
// source row (and one before the file), even when empty. Saving, hiding or
// deleting notes changes a slot's contents, never the native collection.
export function diffReaderEntries(rows, comments, split) {
  const entries = [{ key: "notes-before", comments: [] }];
  for (const entry of diffEntries(rows, comments, split)) {
    if (entry.row) entries.push(entry, { key: `notes-${entry.key}`, comments: [] });
    else entries.at(-1).comments.push(entry.comment);
  }
  return entries;
}

export function layoutSidebar(root) {
  const find = (node, id) => node?.id === id ? node : (node?.children ?? []).map(child => find(child, id)).find(Boolean);
  const panel = find(root, "panel"), stack = find(panel, "panel-body");
  if (!panel || !stack) return null;
  const active = stack.children?.find(child => child.id === stack.active);
  return { id: panel.id, stack: stack.id, active: stack.active, hidden: Boolean(panel.hidden), changes: active?.content?.mod === "annotator" };
}

// Match identity, never a tab title. A review keeps its comparison/drafts when
// reopened. Ignore stale registrations left behind by closed tabs.
export function existingReviewTab(current, spaceList, paneList, reviews) {
  const sourceTab = reviews[current.tab]?.sourceTab ?? current.tab;
  const live = new Set((spaceList.find(space => space.id === current.space)?.tabs ?? []).map(tab => tab.id));
  for (const [tab, review] of Object.entries(reviews)) {
    if (!live.has(tab) || review.space !== current.space || review.sourceTab !== sourceTab) continue;
    if (review.scope && (review.scope.repo !== current.scope.repo || (review.scope.machine ?? null) !== (current.scope.machine ?? null))) continue;
    const pane = paneList.find(pane => pane.tab === tab && pane.mod === "annotator");
    return { tab, pane: pane?.pane ?? null };
  }
  return null;
}

// One shared controller across all mod copies. Change visibility only on tab
// transitions, so a person's manual sidebar toggle in a full review wins.
export function reviewSidebarTransition(previous, focus, reviews, panel) {
  const review = reviews[focus.tab];
  if (!focus.tab || (previous?.tab === focus.tab && previous?.space === focus.space && previous?.review === Boolean(review))) return null;
  const state = { tab: focus.tab, space: focus.space, review: Boolean(review), pending: { ...previous?.pending } }, actions = [];
  if (review) {
    if (review.sourcePanel?.changes && !review.sourcePanel.hidden && review.sourceTab) {
      state.pending[review.sourceTab] ??= { space: review.space, panel: review.sourcePanel };
    }
    if (panel?.changes && !panel.hidden) actions.push({ name: "layout.hide", args: { id: panel.id } });
  } else {
    const restore = state.pending[focus.tab];
    if (restore && restore.space === focus.space && panel?.id === restore.panel.id) {
      // Don't replace a Files panel the person explicitly opened in review.
      if (panel.hidden) {
        actions.push({ name: "layout.select", args: { stack: restore.panel.stack, child: restore.panel.active } });
        actions.push({ name: "layout.show", args: { id: panel.id } });
      }
      delete state.pending[focus.tab];
    }
  }
  return { state, actions };
}

export function fullPreferences(value, legacy = {}) {
  const prefs = value ?? {};
  return {
    mode: ["branch", "uncommitted", "last_commit"].includes(prefs.mode) ? prefs.mode : "branch",
    diffStyle: ["split", "unified"].includes(prefs.diffStyle) ? prefs.diffStyle : legacy.diffStyle === "unified" ? "unified" : "split",
    filesOpen: typeof prefs.filesOpen === "boolean" ? prefs.filesOpen : true,
    commentsOpen: typeof prefs.commentsOpen === "boolean" ? prefs.commentsOpen : legacy.commentsOpen === true,
    onlyUnread: prefs.onlyUnread === true,
    syntax: prefs.syntax !== false,
    contextLines: Number.isInteger(prefs.contextLines) && prefs.contextLines >= 0 && prefs.contextLines <= 1000000 ? prefs.contextLines : 3,
  };
}

export function snapshotFailure(error, machine) {
  const raw = String(error).replace(/^Error:\s*/, "");
  let detail = raw, kind = null;
  const start = raw.indexOf("{");
  if (start >= 0) {
    try {
      const value = JSON.parse(raw.slice(start));
      const core = value.error ?? value;
      detail = typeof core.message === "string" ? core.message : raw;
      kind = core.kind;
    } catch { /* A plain Git diagnostic need not contain JSON. */ }
  }
  const offline = kind === "unavailable" || /unreachable|cannot reach|connection (?:refused|timed out)|operation timed out|no route to host|network is unreachable|could not resolve hostname|machine.*unavailable/i.test(detail);
  if (offline) return { kind: "offline", title: machine ? `${machine} is unavailable` : "Connection unavailable",
    message: "Reconnect the machine, then Refresh to retry.", detail };
  if (/\bfatal:\s*not a git repository(?:\s*\(|\s*:|\s*$)/i.test(detail)) {
    return { kind: "not-repository", title: "Not a Git checkout",
      message: "Open a folder with a Git repository to review its changes.", detail: null };
  }
  return { kind: "error", title: "Unable to load changes", message: detail, detail: null };
}

export function needsFreshSnapshot(id) {
  return /^(?:save-note|full-save|send-review|full-send|review-send-confirm|export-review|full-export)$/.test(id)
    || /^(?:resolve-|read-|requeue-|confirm-requeue-|fix-|reply-thread-|post-reply-|retry-reply-|edit-|delete-|confirm-delete-|save-edit-|ask-|full-ask-|question-send$|question-retry$)/.test(id);
}

export function savedBaseChoice(value) {
  if (typeof value === "string") {
    // Legacy origin/develop was commonly an automatically resolved default.
    // Reset that old cache to Auto; preserve custom legacy refs as pinned.
    return { base: value === "origin/develop" ? null : value, explicit: value !== "origin/develop" };
  }
  return { base: typeof value?.base === "string" ? value.base : null, explicit: value?.explicit === true };
}
