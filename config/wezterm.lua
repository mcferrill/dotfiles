local wezterm = require("wezterm")
local config = wezterm.config_builder()

config.color_scheme = "Kanagawa (Gogh)"
config.automatically_reload_config = true
config.font = wezterm.font_with_fallback({
    { family = "FiraCode Nerd Font", weight = "DemiBold" },
    { family = "Fira Code", weight = "DemiBold" },
})

config.enable_tab_bar = false

-- Use smaller font size on windows
if package.config:sub(1, 1) == "/" then
    config.font_size = 13
else
    config.font_size = 11
end

return config
