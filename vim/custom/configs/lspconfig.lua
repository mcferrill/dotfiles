local on_attach = require("plugins.configs.lspconfig").on_attach
local capabilities = require("plugins.configs.lspconfig").capabilities

local lspconfig = require "lspconfig"

-- if you just want default config for the servers then put them in a table
local servers = {
  "clangd",
  "cssls",
  "emmet_ls",
  "eslint",
  -- "grammarly-languageserver",
  "html",
  -- "json-lsp",
  "ruff_lsp",
  -- "rust-analyzer",
  -- "tailwindcss-language-server",
 -- "tsserver",
}
for _, lsp in ipairs(servers) do
  lspconfig[lsp].setup {
    on_attach = on_attach,
    capabilities = capabilities,
  }
end

-- 
-- lspconfig.pyright.setup { blabla}
