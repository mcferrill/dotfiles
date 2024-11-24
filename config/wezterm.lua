local wezterm = require("wezterm")
local config = wezterm.config_builder()
local act = wezterm.action

local function basename(path)
    -- Split the path into parts
    local parts = {}
    for part in string.gmatch(path, "[^/]+") do
        table.insert(parts, part)
    end

    -- The last part will be the filename or directory name
    return parts[#parts] or ""
end

local function contains(table, element)
    for k, v in pairs(table) do
        if v == element then
            return true
        end
    end
    return false
end

-- Emulates tmux-sessionizer script
local function sessionizer(window, pane)
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
                    local selected_dir = dir
                    if not selected_dir then
                        return
                    end

                    -- Convert directory name to workspace name
                    local selected_name = basename(selected_dir):gsub("%.", "_")

                    wezterm.log_error(selected_dir, basename(selected_name))

                    -- Check if workspace exists, if not, create it
                    local workspaces = wezterm.mux.get_workspace_names()
                    if not contains(workspaces, selected_name) then
                        wezterm.log_error("launch", selected_name)
                        wezterm.mux.spawn_window({
                            workspace = selected_name,
                            cwd = selected_dir,
                        })
                    end

                    -- Switch to the workspace
                    wezterm.log_error("switch to", selected_name)
                    window:perform_action(
                        act.SwitchToWorkspace({
                            name = selected_name,
                        }),
                        pane
                    )
                end
            end),
        }),
        pane
    )
end

function get_appearance()
    if wezterm.gui then
        return wezterm.gui.get_appearance()
    end
    return "Dark"
end

function scheme_for_appearance(appearance)
    if appearance:find("Dark") then
        return "Kanagawa (Gogh)"
    else
        return "Builtin Solarized Light"
    end
end

-- config.color_scheme = "Kanagawa (Gogh)"
config.color_scheme = scheme_for_appearance(get_appearance())

config.automatically_reload_config = true
config.font = wezterm.font_with_fallback({
    -- { family = "FiraCode Nerd Font", weight = "DemiBold" },
    { family = "Fira Code", weight = "DemiBold" },
})

config.enable_tab_bar = false
config.window_background_opacity = 0.90

-- Use smaller font size on windows
if package.config:sub(1, 1) == "/" then
    config.font_size = 13
else
    config.font_size = 10.25
    config.default_prog = { "powershell.exe" }
end

local function is_vim(pane)
    return pane:get_user_vars().IS_NVIM == "true"
end

local direction_keys = { h = "Left", j = "Down", k = "Up", l = "Right" }

local function split_nav(resize_or_move, key)
    return {
        key = key,
        mods = resize_or_move == "resize" and "META" or "CTRL",
        action = wezterm.action_callback(function(win, pane)
            if is_vim(pane) then
                -- pass the keys through to vim/nvim
                win:perform_action({
                    SendKey = { key = key, mods = resize_or_move == "resize" and "META" or "CTRL" },
                }, pane)
            else
                if resize_or_move == "resize" then
                    win:perform_action({ AdjustPaneSize = { direction_keys[key], 3 } }, pane)
                else
                    win:perform_action({ ActivatePaneDirection = direction_keys[key] }, pane)
                end
            end
        end),
    }
end

config.leader = { key = "a", mods = "CTRL", timeout_milliseconds = 1000 }
config.keys = {
    -- splitting
    { mods = "LEADER", key = "-", action = wezterm.action.SplitVertical({ domain = "CurrentPaneDomain" }) },
    { mods = "LEADER", key = "\\", action = wezterm.action.SplitHorizontal({ domain = "CurrentPaneDomain" }) },
    split_nav("move", "h"),
    split_nav("move", "j"),
    split_nav("move", "k"),
    split_nav("move", "l"),

    -- wezterm-sessionizer
    { key = "f", mods = "CTRL", action = wezterm.action_callback(sessionizer) },

    -- toggle pane zoom
    { key = "z", mods = "LEADER", action = wezterm.action.TogglePaneZoomState },

    -- vi-mode copy
    { key = "[", mods = "LEADER", action = act.ActivateCopyMode },
}

return config
