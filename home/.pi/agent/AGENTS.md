# Global agent instructions

## Herdr routing

There are two different Herdr stacks. Never mix their commands or IDs.

- If `HC_TERMINAL_ID` is set, this terminal belongs to herdr-core.
  - Read terminals, run commands, or coordinate agents: load the `herdr-core` skill.
  - Inspect desktop spaces/panes, change focus, or customize the window:
    load the `herdr-app` skill.
  - For "the neighboring pane": use herdr-app to identify its terminal,
    then hc to read it.
- Otherwise, if `HERDR_ENV=1`, use the `herdr` skill for the older TUI.
- If neither is set, do not assume a current pane. For an explicit desktop
  request, the herdr-app skill may inspect the running window, but establish
  the intended target before acting.

A missing `HERDR_ENV` does not mean herdr-core or herdr-app is unavailable.

## Classification in codemode

For large batches requiring semantic labels or scores, consider an available
classifier such as Jev via `models.classify()`. Prefer plain JavaScript for
deterministic filtering and direct reasoning for small batches or nuanced decisions.
Discover models with `models.getAvailableOfType("classifier")`; do not hardcode
provider IDs. Check `stopReason`, preserve source IDs, and verify consequential
classifications. Only send data to providers permitted for that data.
