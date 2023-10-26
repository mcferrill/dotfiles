-- local autocmd = vim.api.nvim_create_autocmd

-- Auto resize panes when resizing nvim window
-- autocmd("VimResized", {
--   pattern = "*",
--   command = "tabdo wincmd =",
-- })
--

-- select all with Ctrl-a
vim.api.nvim_set_keymap("n", "<C-a>", "ggVG", { noremap = true })

-- sort with Leader-s (eg, python imports)
vim.api.nvim_set_keymap("v", "<Leader>s", ":sort<CR>", { noremap = true })

-- toggle nvimtree (replaces nerdtree) w/ Ctrl-d
vim.api.nvim_set_keymap("n", "<C-d>", ":NvimTreeToggle<CR>", { noremap = true })

-- Indent and dedent with tab and shift-tab in visual & insert modes
vim.api.nvim_set_keymap("v", "<Tab>", ">gv", { noremap = true })
vim.api.nvim_set_keymap("v", "<S-Tab>", "<gv", { noremap = true })
vim.api.nvim_set_keymap("i", "<S-Tab>", "<C-D>", { noremap = true })

-- open telescope fuzzy finder with ctl-p
vim.keymap.set('n', '<C-p>', '<cmd>Telescope find_files<cr>', {})

-- toggle horizontal terminal with Ctrl-``
vim.keymap.set('n', '<C-`>', function () require('nvterm.terminal').toggle('horizontal') end, {})

