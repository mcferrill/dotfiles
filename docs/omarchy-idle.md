# Omarchy idle and lock preferences

The working overrides are saved under
`home-arch/.config/omarchy/plugins/{mcferrill.idle,mcferrill.lock}/`.
They are user-owned clones of Omarchy 4.6.0rc1's idle and secure-lock services;
packaged files under `/usr/share/omarchy/` are not modified.

## Behavior

| Situation | Screensaver | Lock | After locking |
| --- | --- | --- | --- |
| AC power + active HDMI output | 5 minutes idle | 10 minutes idle | After about 5 seconds, show black without disabling displays; input restores the unlock prompt. |
| Battery, or no active HDMI output | `idle.screensaver` in `shell.json` (currently 150 seconds) | `idle.lock` in `shell.json` (currently 300 seconds) | Normal Omarchy display power-off behavior. |

The black screen is still a secure Wayland session-lock surface, not a terminal
or an unlocked desktop. The password/fingerprint authentication code is retained.
The powered-on black display uses more power than a disabled display, but avoids
this machine's HDMI disconnect/reconnect loop when DPMS powers the display off.

These overrides do not configure system suspend or lid handling. On the original
machine, idle does not suspend; closing the lid on battery without an external
monitor triggers lock-before-suspend through the existing logind/Omarchy setup.

## Restore

Requires an existing Omarchy installation with Quickshell and UPower. Install
these only on a compatible Omarchy version: the clones retain their own copies of
the upstream services and do not automatically receive future upstream fixes.
Review/rebase them when updating Omarchy, especially authentication changes.

**Qt compatibility:** these saved lock files use `Commons.OmarchyColor` to match
the original machine's existing Qt 6.12 compatibility shim. That shim is not
included here. On stock Omarchy without the shim, change those references to
`Commons.Color` in both `Service.qml` and `LockView.qml` before enabling the lock
clone. Do not enable a lock clone with QML loading errors.

From the repository root, while the session is unlocked:

```sh
./install link
omarchy-shell shell rescanPlugins
omarchy plugin validate ~/.config/omarchy/plugins/mcferrill.idle
omarchy plugin validate ~/.config/omarchy/plugins/mcferrill.lock
omarchy plugin enable mcferrill.idle
omarchy plugin enable mcferrill.lock
omarchy restart shell
omarchy-shell idle status
omarchy-shell lock status
```

The plugin enable commands select the clones in `~/.config/omarchy/shell.json`
without replacing unrelated bar, theme, or plugin preferences. Its existing
`idle` values remain the fallback policy outside AC + HDMI; keep them at
`{"screensaver":150,"lock":300}` to match the original battery timing.

On AC + HDMI, idle status should report `dockedOnAc: true`, `screensaver: 300`,
and `lock: 600`. Lock status should report `passwordPam: true`. Check the shell
journal for errors before relying on the lock screen. Confirm that locking,
blackening, input wake, and authentication work, then test battery/lid behavior.

## Check and undo

```sh
node home-arch/.config/omarchy/plugins/mcferrill.lock/check-policy.cjs
```

This exercises the actual QML policy expressions and blank/wake functions with
mocked hardware state; it does not replace testing the real monitor and lock.

To return to Omarchy's built-in services, while unlocked:

```sh
omarchy plugin disable mcferrill.idle
omarchy plugin disable mcferrill.lock
omarchy plugin enable omarchy.idle
omarchy plugin enable omarchy.lock
omarchy restart shell
```

The original machine's pre-change shell configuration was also backed up under
`~/.local/state/omarchy/idle-backup-20261127-170754/shell.json` (not tracked here).
