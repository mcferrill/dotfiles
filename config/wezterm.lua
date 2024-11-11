-- Pull in the wezterm API
local wezterm = require("wezterm")

-- This will hold the configuration.
local config = wezterm.config_builder()

-- This is where you actually apply your config choices

-- For example, changing the color scheme:
config.color_scheme = "Kanagawa (Gogh)"

config.automatically_reload_config = true
-- config.window_decorations = "RESIZE"
config.font = wezterm.font("Fira Code")
config.enable_tab_bar = false
config.font_size = 11

-- and finally, return the configuration to wezterm
return config
