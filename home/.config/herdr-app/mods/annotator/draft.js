// Native editor state stays in its adapter. This module owns intent and provenance.
export class DraftLifecycle {
  constructor(editor) {
    this.editor = editor;
    this.saved = new Map();
    this.reset();
  }

  reset() {
    this.selection = null; this.needsSelection = false;
    this.revision = null; this.composerOpen = false;
  }

  enter(context, previous, view, revision) {
    if (previous) this.saved.set(previous, {
      ...view, body: this.editor.value(), selection: this.selection,
      revision: this.revision ?? revision, needsSelection: this.needsSelection,
      composerOpen: this.composerOpen,
    });
    const draft = this.saved.get(context);
    this.reset();
    this.editor.set_value(draft?.body ?? "");
    if (draft) {
      this.selection = draft.selection; this.revision = draft.revision;
      this.needsSelection = draft.needsSelection; this.composerOpen = draft.composerOpen;
    }
    return draft;
  }

  observe(revision, previous) {
    if (this.editor.value().trim()) {
      this.revision ??= previous ?? revision;
      if (this.revision !== revision) {
        this.selection = null; this.needsSelection = true;
      }
    } else {
      if (previous && previous !== revision) this.selection = null;
      this.needsSelection = false; this.revision = revision;
    }
    return this.needsSelection;
  }

  anchor(selection, revision) {
    this.selection = selection; this.revision = revision;
    this.needsSelection = false; this.composerOpen = true;
  }

  cancel(context) {
    this.editor.set_value(""); this.reset(); this.saved.delete(context);
  }

  capture(context) {
    return { context, body: this.editor.value(), selection: JSON.stringify(this.selection), revision: this.revision };
  }

  complete(token, context) {
    // A later edit belongs to the user even if an earlier Add succeeds.
    const same = token.context === context && token.body === this.editor.value()
      && token.selection === JSON.stringify(this.selection) && token.revision === this.revision;
    if (same) this.cancel(context);
    else if (token.context !== context) {
      const saved = this.saved.get(token.context);
      if (saved?.body === token.body && saved.revision === token.revision
        && JSON.stringify(saved.selection) === token.selection) this.saved.delete(token.context);
    }
    return same;
  }
}
