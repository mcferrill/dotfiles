# Omarchy workspace preferences

`home-arch/.config/hypr/workspaces.lua` keeps global workspace numbers:

- HDMI-A-1 connected: 1–5 on HDMI, 6–10 on the laptop (eDP-1).
- HDMI unplugged: Hyprland parks its workspaces on the laptop and returns
  them when HDMI reconnects. Workspace 6 stays persistent on the laptop.
- Super + 1–0 and the corresponding move-window bindings use global IDs,
  not Omarchy's newer per-monitor blocks of ten.

Resolution, scaling, and arrangement remain machine-local. Adjust connector
names in the module for machines whose outputs have different names.

## Restore

1. Run `./install link` on Arch to link the module into `~/.config/hypr/`.
2. Back up `~/.config/hypr/hyprland.lua`, then add this **after bootstrap.lua
   and before** `require("default.hypr.omarchy")`:

   ```lua
   require("hypr.workspaces")
   ```

3. Remove any older inline workspace overrides and duplicate workspace rules
   from `~/.config/hypr/monitors.lua`. Keep unrelated monitor settings.
4. If switching from Omarchy's per-monitor numbering, back up and remove
   `~/.local/state/omarchy/monitors/workspaces` so the bar no longer uses stale
   monitor blocks. Do not track that file or `workspaces-merged` in Git.
5. Run `hyprctl reload` and `hyprctl configerrors`. Existing windows on 11–20
   need a one-time move to the desired global workspaces; the module does not
   move or renumber them automatically.

Run `lua test-hypr-workspaces.lua` from the repo root for the policy check.
After restoring, verify Super + 1 and Super + 6 from either display, then
unplug/replug HDMI with windows open. Physical hotplug needs a live check;
the Lua test checks configuration and actions, not compositor behavior.

## Compatibility

This overrides `default.hypr.monitor-workspaces` in Omarchy's Lua-based
Hyprland configuration (verified with Hyprland 0.57.2). Load order matters:
Omarchy must create its default bindings **after** the overrides are installed.
The packaged Omarchy files are not modified. Recheck this integration if an
Omarchy update changes its workspace module API or regenerates hyprland.lua.
