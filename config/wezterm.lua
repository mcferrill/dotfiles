local wezterm = require("wezterm")
local config = wezterm.config_builder()

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
    local function is_vim(pane)
        -- this is set by the plugin, and unset on ExitPre in Neovim
        return pane:get_user_vars().IS_NVIM == "true"
    end

    local direction_keys = {
        h = "Left",
        j = "Down",
        k = "Up",
        l = "Right",
    }

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
        {
            mods = "LEADER",
            key = "-",
            action = wezterm.action.SplitVertical({ domain = "CurrentPaneDomain" }),
        },
        {
            mods = "LEADER",
            key = "=",
            action = wezterm.action.SplitHorizontal({ domain = "CurrentPaneDomain" }),
        },

        -- move between split panes
        split_nav("move", "h"),
        split_nav("move", "j"),
        split_nav("move", "k"),
        split_nav("move", "l"),
    }
end

return config
