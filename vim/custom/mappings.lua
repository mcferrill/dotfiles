---@type MappingsTable
local M = {}

M.general = {
  n = {
    ["<C-f>"] = { "<cmd>silent !tmux neww tmux-sessionizer<CR>", "launch tmux-sessionizer",},
    ["<C-h>"] = { "<cmd>TmuxNavigateLeft<CR>", "Window left",},
    ["<C-j>"] = { "<cmd>TmuxNavigateDown<CR>", "Window down",},
    ["<C-k>"] = { "<cmd>TmuxNavigateUp<CR>", "Window up",},
    ["<C-l>"] = { "<cmd>TmuxNavigateRight<CR>", "Window right",},
    ["<C-a>"] = { "ggVG", "select-all", opts = { nowait = true } },
    ["<C-d>"] = { ":NvimTreeToggle<CR>", "toggle file explorer", opts = { nowait = true } },
    ["<C-p>"] = { "<cmd>Telescope find_files<cr>", "telescope find files", opts = { nowait = true } },
    ["<C-S-P>"] = { function() require('telescope.builtin').find_files({no_ignore=true, hidden=true}) end, "telescope find all files", opts = { nowait = true } },
    ["<C-`>"] = { function () require('nvterm.terminal').toggle('horizontal') end, "toggle horizontal terminal", opts = { nowait = true } },
    ["<Leader>y"] = { "'\"+y'", "yank within vim", opts = { nowait = true } },
    ["<Leader>Y"] = { "'\"+Y'", "yank to system clipboard", opts = { nowait = true } },
    [",a"] = { "ggVG", "select all", opts = {} },
    [",e"] = { ":q<CR>", "close current window", opts = {} },
    [",E"] = { ":qa!<CR>", "close all windows", opts = {} },
  },
  v = {
    ["<Tab>"] = { ">gv", "indent"},
    ["<S-Tab>"] = { "<gv", "dedent"},
    ["<Leader>s"] = { ":sort<CR>", "sort", opts = { nowait = true } },
    ["<Leader>y"] = { "'\"+y'", "yank within vim", opts = { nowait = true } },
    ["<Leader>Y"] = { "'\"+Y'", "yank to system clipboard", opts = { nowait = true } },
  },
  i = {
    ["<S-Tab>"] = { "<C-D>", "dedent"},
  },
  x = {
    ["<S-p>"] = { "\"_dP", "paste without clobbering pastebin"},
  },
}


return M
