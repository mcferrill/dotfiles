-- Run from the repository root: lua test-hypr-workspaces.lua
local rules = {}
local workspaces = { reconcile = function() error("default reassignment ran") end }
package.loaded["default.hypr.helpers"] = true
package.loaded["default.hypr.monitor-workspaces"] = workspaces
hl = {
  dsp = {
    focus = function(options) return options end,
    window = { move = function(options) return options end },
    workspace = { move = function(options) return options end },
  },
  workspace_rule = function(rule) rules[#rules + 1] = rule end,
}

dofile("home-arch/.config/hypr/workspaces.lua")
workspaces.reconcile()
assert(workspaces.focus(1).workspace == "1")
assert(workspaces.focus(10).workspace == "10")
assert(workspaces.move_window(6).follow == true)
assert(workspaces.move_window(6, false).follow == false)
assert(workspaces.move_window(6).workspace == "6")
assert(workspaces.move_to_monitor("r").monitor == "r")
assert(#rules == 10)
for id, rule in ipairs(rules) do
  assert(rule.workspace == tostring(id))
  assert(rule.monitor == (id <= 5 and "HDMI-A-1" or "eDP-1"))
  assert(rule.default == (id == 1 or id == 6))
  assert((rule.persistent == true) == (id == 6))
end
print("PASS: global workspace actions and HDMI/laptop rules")
