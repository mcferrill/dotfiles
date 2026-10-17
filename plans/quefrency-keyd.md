# Finish keyd setup when the Quefrency is available

## Current state

- `home/.config/keyd/default.conf` implements Caps tap → Escape and a held-Caps
  navigation/media layer matching the nine Karabiner shortcuts.
- `packages.conf` includes keyd for Arch; `README.md` documents activation.
- System activation and live Hyprland changes have not been performed by this work.
- The current layer is not literal Ctrl+Alt+Shift+Super; keep that behavior unless
  app-specific Hyper shortcuts are needed.
- `~/.config/hypr/input.lua` currently swaps Alt/Super for these physical devices:
  `keebio-quefrency-rev.-6` and `keebio-quefrency-rev.-6-keyboard`.
- The Quefrency was disconnected when this plan was written. Do not guess its
  keyd device ID from the Karabiner config.

## Implementation

1. Install keyd if needed (`sudo pacman -S --needed keyd`), connect the Quefrency,
   and run `sudo keyd monitor` to identify every keyboard interface that emits
   its keys. Record the actual IDs; avoid matching mouse interfaces.
2. Refactor the tracked configs into:

   ```text
   home/.config/keyd/
   ├── default.conf      # Wildcard match, excluding the Quefrency IDs
   ├── quefrency.conf    # Explicit Quefrency IDs + Alt/Super swap
   └── common           # Shared [main] Caps mapping and [hyper] shortcuts
   ```

   `common` must have no `[ids]` section and no `.conf` extension. Include it
   after `[ids]` in both configs using `include common`. In `default.conf`, keep
   `*` and add each excluded ID prefixed with `-`. List those IDs without `-`
   in `quefrency.conf`.

3. After `include common`, add this to `quefrency.conf`:

   ```ini
   [main]
   leftalt = layer(meta)
   leftmeta = layer(alt)
   rightalt = layer(meta)
   rightmeta = layer(altgr)
   ```

   Verify the right-side behavior against the desired layout: `altgr` preserves
   keyd's normal right-Alt semantics; use `layer(alt)` instead if ordinary Alt
   is wanted there.

4. Run `./install link`. Review existing `/etc/keyd/` files before changing
   anything; back up conflicting configs. Link all three tracked files through
   `~/.config/keyd/` into `/etc/keyd/`. The `common` link is required because
   keyd resolves includes under `/etc/keyd/` or `/usr/share/keyd/`, not beside
   the symlink target in the repo.
5. Back up `~/.config/hypr/input.lua`. Remove only the existing Quefrency-specific
   options variable and `hl.device(...)` loop. Do not add a global Alt/Super
   swap or remove unrelated Omarchy input defaults.
6. Enable keyd with `sudo systemctl enable --now keyd`, or run `sudo keyd reload`
   if already active. Check `sudo journalctl -u keyd -b -n 50 --no-pager` for
   configuration errors. Run `hyprctl reload` followed by `hyprctl configerrors`.
7. Update the activation instructions in `README.md` for the three-file setup.

## Manual acceptance check

- Quefrency: physical Alt/Super keys are swapped on both sides as intended.
- Built-in Mac keyboard: Alt/Super behavior is unchanged.
- Both keyboards: Caps alone sends Escape; held Caps supports all nine shortcuts:
  A → Home, D → End, W → Page Up, S → Page Down, Space → play/pause,
  Up/Down → volume up/down, Left/Right → previous/next track.
- Navigation reaches apps without unintended modifier keys.
- Unplugging/reconnecting the Quefrency preserves the mappings.
- No keyd configuration errors or Hyprland config errors.

## Rollback

Disable keyd (`sudo systemctl disable --now keyd`), restore the backed-up
Hyprland input config, then reload Hyprland and check `hyprctl configerrors`.
Leave unrelated system keyd configs untouched.
