-- Load before default.hypr.omarchy so its bindings use global workspace IDs.
require("default.hypr.helpers")
local workspaces = require("default.hypr.monitor-workspaces")
workspaces.reconcile = function() end
workspaces.focus = function(id)
  return hl.dsp.focus({ workspace = tostring(id) })
end
workspaces.move_window = function(id, follow)
  return hl.dsp.window.move({ workspace = tostring(id), follow = follow ~= false })
end
workspaces.move_to_monitor = function(direction)
  return hl.dsp.workspace.move({ monitor = direction })
end

-- Hyprland parks 1-5 on the laptop when HDMI disappears and returns them
-- when it reconnects. Keep 6 alive so the laptop always has a workspace.
for id = 1, 5 do
  hl.workspace_rule({ workspace = tostring(id), monitor = "HDMI-A-1", default = id == 1 })
end
for id = 6, 10 do
  hl.workspace_rule({
    workspace = tostring(id),
    monitor = "eDP-1",
    default = id == 6,
    persistent = id == 6,
  })
end
