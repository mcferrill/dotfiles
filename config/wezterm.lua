local wezterm = require("wezterm")
local config = wezterm.config_builder()
local act = wezterm.action

-- Get the last path segment from a string
local function basename(path)
    local parts = {}
    for part in string.gmatch(path, "[^/]+") do
        table.insert(parts, part)
    end
    return parts[#parts] or ""
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

config.color_scheme = auto_theme()
config.automatically_reload_config = true
config.font = wezterm.font_with_fallback({
    -- { family = "FiraCode Nerd Font", weight = "DemiBold" },
    { family = "Fira Code", weight = "DemiBold" },
})

config.enable_tab_bar = false
config.window_background_opacity = 0.90

-- Use powershell, and smaller font size on windows
local windows = false
if package.config:sub(1, 1) == "/" then
    config.font_size = 13
else
    windows = true
    config.font_size = 10.25
    config.default_prog = { "powershell.exe" }
end

local direction_keys = { h = "Left", j = "Down", k = "Up", l = "Right" }
local function split_nav(key, mods)
    return {
        key = key,
        mods = mods,
        action = wezterm.action_callback(function(win, pane)
            if pane:get_user_vars().IS_NVIM == "true" then
                win:perform_action({ SendKey = { key = key, mods = "CTRL" } }, pane)
            else
                win:perform_action({ ActivatePaneDirection = direction_keys[key] }, pane)
            end
        end),
    }
end

config.leader = { key = "a", mods = "CTRL", timeout_milliseconds = 1000 }
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
    split_nav("h", "CTRL"),
    split_nav("j", "CTRL"),
    split_nav("k", "CTRL"),
    split_nav("l", "CTRL"),
    split_nav("h", "LEADER"),
    split_nav("j", "LEADER"),
    split_nav("k", "LEADER"),
    split_nav("l", "LEADER"),

    -- toggle pane zoom
    { key = "z", mods = "LEADER", action = wezterm.action.TogglePaneZoomState },

    -- vi-mode copy
    { key = "[", mods = "LEADER", action = act.ActivateCopyMode },
}

-- wezterm-sessionizer
-- TODO: implement on windows?
if not windows then
    table.insert(config.keys, { key = "f", mods = "CTRL", action = wezterm.action_callback(wezterm_sessionizer) })
end

return config
