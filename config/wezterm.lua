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
    config.default_prog = {'powershell.exe'}
end

return config
