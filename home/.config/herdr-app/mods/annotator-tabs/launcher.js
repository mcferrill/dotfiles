import { spaces, panes, focused, agents, exec, run, layout, shared, setShared } from "herdr";
import { reviewLocation, sessionTarget, layoutSidebar, existingReviewTab } from "./review.js";

// Capture before creating the tab: focus and the active checkout change afterward.
export function openReview(owner, cx) {
  if (owner.openingReview) return;
  const current = reviewLocation(null, focused(), spaces(), panes(), agents());
  if (!current.space || !current.scope.repo) {
    owner.reviewError = "Select a checkout"; cx.notify(); return;
  }
  const existing = existingReviewTab(current, spaces(), panes(), shared("annotator.fullTabs") ?? {});
  if (existing) {
    owner.reviewError = null;
    if (existing.pane) run("pane.focus", { pane: existing.pane });
    else run("tab.select", { id: existing.tab });
    cx.notify(); return;
  }
  const target = sessionTarget(agents(), current, focused());
  const sourcePanel = layoutSidebar(layout());
  const args = { name: "Review", space: current.space, mod: "annotator",
    props: { presentation: "full", scope: current.scope, space: current.space,
      tab: current.tab, source_target: target?.address ?? null } };
  owner.openingReview = true; owner.reviewError = null; cx.notify();
  cx.spawn(async cx => {
    try {
      const result = await exec("herdr-app", ["do", "tab.new", JSON.stringify(args)]);
      const made = JSON.parse(result.stdout);
      if (result.code !== 0 || made.error || !made.tab || !made.pane) throw new Error(made.error ?? "Could not create review tab");
      const qualify = id => current.scope.machine && !id.startsWith(`${current.scope.machine}/`) ? `${current.scope.machine}/${id}` : id;
      const tab = qualify(made.tab), pane = qualify(made.pane);
      setShared("annotator.fullTabs", { ...(shared("annotator.fullTabs") ?? {}),
        [tab]: { sourceTab: current.tab, space: current.space, sourcePanel, scope: current.scope } });
      run("pane.focus", { pane });
    } catch (e) { owner.reviewError = String(e); }
    finally { owner.openingReview = false; cx.notify(); }
  });
}
