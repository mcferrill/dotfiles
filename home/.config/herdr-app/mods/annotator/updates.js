const DAY = 86400000;
const VIEWS = "annotator.updateViews";
const GATE = "annotator.updateGate";
const STATE = "annotator.updateState";
const BOOT = "annotator.updateBoot";

// The registry/gate live in application-wide, in-memory sessionStorage. A
// restart clears dead view registrations; a hidden view's draft never expires.
export class UpdateController {
  constructor(env) {
    this.env = env;
    this.id = `review-${Date.now()}-${Math.random()}`;
    this.checking = false; this.polling = false;
  }

  get running() { return this.env.storage.getItem(GATE) === "true"; }
  get state() { return this.env.shared(STATE) ?? {}; }
  views() { return JSON.parse(this.env.storage.getItem(VIEWS) ?? "{}"); }
  publish(blocked) {
    const views = this.views();
    if (views[this.id] === blocked) return;
    views[this.id] = blocked;
    this.env.storage.setItem(VIEWS, JSON.stringify(views));
  }
  blockers() { return Object.values(this.views()).some(Boolean); }

  save(patch) { this.env.setShared(STATE, { ...this.state, ...patch }); }
  gate(running) {
    this.env.storage.setItem(GATE, String(running));
    // Shared invalidation makes other copies unmount their editors too.
    this.save({ running });
  }

  async command(command, args = []) {
    const result = await this.env.exec("python3", [this.env.script, command, "--app-home", this.env.appHome, ...args]);
    let value;
    try { value = JSON.parse(result.stdout); }
    catch { throw new Error(result.stderr || "Updater returned no JSON"); }
    if (result.code !== 0 || !value.ok) throw new Error(value.error || "Update operation failed");
    return value.data;
  }

  init(cx) {
    if (!this.env.storage.getItem(BOOT)) {
      // A worker survives app restarts. Inspect its durable lock before the
      // first view accepts new drafts, even if shared state never reached disk.
      this.env.storage.setItem(BOOT, "checking");
      this.gate(true); this.save({ job: { status: "running", phase: "checking" } }); this.poll(cx);
    } else if (this.running || this.state.job?.status === "running") { this.gate(true); this.poll(cx); }
    else this.check(cx);
    this.daily = cx.timer.every(3600000, cx => this.check(cx));
  }

  check(cx, force = false) {
    if (this.checking || this.running || (!force && Date.now() - (this.state.checkedAt ?? 0) < DAY)) return;
    this.checking = true;
    cx.spawn(async cx => {
      try {
        const data = await this.command("check", force ? ["--force"] : []);
        this.save({ current: data.current, latest: data.latest, error: data.error,
          checkedAt: data.checked_at * 1000, job: data.job ?? this.state.job });
        if (data.job?.status === "running") { this.gate(true); this.poll(cx); }
      } catch (error) { this.save({ error: String(error), checkedAt: Date.now() }); }
      finally { this.checking = false; cx.notify(); }
    });
  }

  start(cx) {
    if (this.running || !this.state.latest) return;
    if (this.blockers()) { this.save({ error: "Save/cancel drafts in all review views and wait for active operations before updating.", open: true }); cx.notify(); return; }
    const release = this.state.latest;
    this.gate(true); this.save({ error: null, job: { status: "running", tag: release.tag } });
    cx.spawn(async cx => {
      try {
        // Check again after the event that clicked Update has settled.
        if (this.blockers()) throw new Error("A review draft or operation started; update postponed.");
        const job = await this.command("start", ["--tag", release.tag, "--commit", release.commit]);
        this.save({ job }); this.poll(cx);
      } catch (error) {
        this.save({ error: String(error), job: { status: "failed" }, open: true }); this.gate(false);
      }
      cx.notify();
    });
  }

  poll(cx) {
    if (this.pollTimer) return;
    const tick = cx => {
      if (this.polling) return;
      this.polling = true;
      cx.spawn(async cx => {
        try {
          const job = await this.command("status");
          this.save({ job });
          if (job.status !== "running") {
            this.pollTimer?.cancel(); this.pollTimer = null; this.gate(false);
            this.env.storage.setItem(BOOT, "ready");
            this.save({ error: job.error ?? null, open: job.status === "failed" });
            this.env.ready?.(cx);
            this.check(cx, job.status === "success");
          }
        } catch (error) {
          // A failed poll says nothing about whether a worker is installing.
          // Keep editors closed and retry, rather than risk losing new drafts.
          this.save({ error: `Cannot read update status: ${error}. Update gate remains closed.` });
        } finally { this.polling = false; cx.notify(); }
      });
    };
    this.pollTimer = cx.timer.every(2000, tick);
    tick(cx);
  }

  dismiss(cx) { this.save({ open: false, dismissedUntil: Date.now() + DAY }); cx.notify(); }
  close(keepBlocked = false) {
    this.daily?.cancel(); this.pollTimer?.cancel();
    const views = this.views();
    if (keepBlocked) views[this.id] = true;
    else delete views[this.id];
    this.env.storage.setItem(VIEWS, JSON.stringify(views));
  }
}
