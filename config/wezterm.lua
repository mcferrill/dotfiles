local wezterm = require("wezterm")
local config = wezterm.config_builder()
local act = wezterm.action

local is_darwin <const> = wezterm.target_triple:find("darwin") ~= nil
local is_linux <const> = wezterm.target_triple:find("linux") ~= nil
local windows = not is_darwin and not is_linux

-- Get the last path segment from a string
local function basename(path)
    return string.gsub(path, "(.*[/\\])(.*)", "%2")
end

-- Check if table contains element.
local function contains(table, element)
    for _, v in pairs(table) do
        if v == element then
            return true
        end
    end
    return false
end

local function wezterm_sessionizer(window, pane)
    local success, stdout, stderr = wezterm.run_child_process({
        "find",
        wezterm.home_dir .. "/projects",
        wezterm.home_dir,
        "-mindepth",
        "1",
        "-maxdepth",
        "1",
        "-type",
        "d",
    })
    if not success then
        wezterm.log_error("Failed to list directories: " .. stderr)
        return
    end

    local dirs = {}
    for line in stdout:gmatch("[^\r\n]+") do
        table.insert(dirs, { label = line })
    end

    -- Use InputSelector for selection
    window:perform_action(
        act.InputSelector({
            title = "Select Directory",
            choices = dirs,
            fuzzy = true,
            action = wezterm.action_callback(function(_, _, _, dir)
                if dir then
                    local selected_name = basename(dir):gsub("%.", "_")
                    local workspaces = wezterm.mux.get_workspace_names()
                    if not contains(workspaces, selected_name) then
                        wezterm.mux.spawn_window({ workspace = selected_name, cwd = dir })
                    end
                    window:perform_action(act.SwitchToWorkspace({ name = selected_name }), pane)
                end
            end),
        }),
        pane
    )
end

local function auto_theme()
    local appearance = "Dark"
    if wezterm.gui then
        appearance = wezterm.gui.get_appearance()
    end
    if appearance:find("Dark") then
        return "Kanagawa (Gogh)"
    end
    return "Builtin Solarized Light"
end

config.max_fps = 240
config.color_scheme = auto_theme()
config.automatically_reload_config = true
config.font = wezterm.font_with_fallback({
    -- { family = "FiraCode Nerd Font", weight = "DemiBold" },
    { family = "Fira Code", weight = "DemiBold" },
})

config.enable_tab_bar = false
config.window_background_opacity = 0.90

local direction_keys = { h = "Left", j = "Down", k = "Up", l = "Right" }
local function split_nav(key)
    return {
        key = key,
        mods = "CTRL",
        action = wezterm.action_callback(function(win, pane)
            if pane:get_user_vars().IS_NVIM == "true" or string.find(pane:get_foreground_process_name(), "wsl") then
                win:perform_action({ SendKey = { key = key, mods = "CTRL" } }, pane)
            -- elseif pane:get_foreground_process_name() then
            else
                win:perform_action({ ActivatePaneDirection = direction_keys[key] }, pane)
            end
        end),
    }
end

if windows then
    config.leader = { key = "b", mods = "CTRL", timeout_milliseconds = 1000 }
else
    config.leader = { key = "a", mods = "CTRL", timeout_milliseconds = 1000 }
end

config.keys = {
    -- create splits with - and | and navigate with CTRL-hjkl or LEADER-hjkl
    {
        mods = "LEADER",
        key = "-",
        action = wezterm.action.SplitVertical({ args = config.default_prog, domain = "CurrentPaneDomain" }),
    },
    {
        mods = "LEADER",
        key = "\\",
        action = wezterm.action.SplitHorizontal({ args = config.default_prog, domain = "CurrentPaneDomain" }),
    },
    split_nav("h"),
    split_nav("j"),
    split_nav("k"),
    split_nav("l"),
    { mods = "LEADER", key = "h", action = act.ActivatePaneDirection(direction_keys["h"]) },
    { mods = "LEADER", key = "j", action = act.ActivatePaneDirection(direction_keys["j"]) },
    { mods = "LEADER", key = "k", action = act.ActivatePaneDirection(direction_keys["k"]) },
    { mods = "LEADER", key = "l", action = act.ActivatePaneDirection(direction_keys["l"]) },

    -- toggle pane zoom
    { key = "z", mods = "LEADER", action = wezterm.action.TogglePaneZoomState },

    { key = "x", mods = "LEADER", action = wezterm.action.CloseCurrentPane({ confirm = true }) },

    -- vi-mode copy
    { key = "[", mods = "LEADER", action = act.ActivateCopyMode },

    {
        key = "t",
        mods = "LEADER",
        action = wezterm.action_callback(function(win, pane)
            wezterm.log_error("process is", pane:get_foreground_process_name())
        end),
    },
}

if is_darwin then
    table.insert(config.keys, {
        key = "LeftArrow",
        mods = "OPT",
        action = act.SendKey({ key = "b", mods = "ALT" }),
    })
    table.insert(config.keys, {
        key = "RightArrow",
        mods = "OPT",
        action = act.SendKey({ key = "b", mods = "ALT" }),
    })
end

-- Use powershell, and smaller font size on windows
if windows then
    config.font_size = 10.25
    config.default_prog = { "pwsh.exe" }
else
    config.font_size = 13
    -- wezterm-sessionizer
    -- TODO: implement on windows?
    table.insert(config.keys, { key = "f", mods = "CTRL", action = wezterm.action_callback(wezterm_sessionizer) })
end

return config
