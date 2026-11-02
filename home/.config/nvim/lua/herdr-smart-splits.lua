-- Local Herdr Desktop only. Other terminals keep their existing smart-splits behavior.
local M = { name = "Herdr Desktop", protocol_version = "3.0.0" }

function M.detect()
    return (vim.env.HC_TERMINAL_ID or ""):match("^t[a-z0-9]+$") ~= nil
        and vim.env.SSH_CONNECTION == nil
        and vim.fn.executable("herdr-app") == 1
        and vim.fn.executable("hc") == 1
end

function M.activate()
    local terminal = vim.env.HC_TERMINAL_ID
    local server = vim.v.servername ~= "" and vim.v.servername or vim.fn.serverstart()
    local result = vim.system({
        "hc", "label", terminal,
        "herdr.nvim-server=" .. server,
        "herdr.nvim-bin=" .. vim.v.progpath,
    }, { text = true }):wait(1000)
    if result.code ~= 0 then
        error("Could not register Neovim RPC server: " .. (result.stderr or "request timed out"))
    end
    vim.api.nvim_create_autocmd("VimLeavePre", {
        group = vim.api.nvim_create_augroup("herdr-smart-splits", { clear = true }),
        callback = function()
            vim.system({ "hc", "label", terminal, "herdr.nvim-server=", "herdr.nvim-bin=" }):wait(1000)
        end,
    })
end

function M.move(direction)
    local terminal = vim.env.HC_TERMINAL_ID or ""
    if not M.detect() or not terminal:match("^t[a-z0-9]+$") then
        return false
    end
    if not ({ left = true, down = true, up = true, right = true })[direction] then
        return false
    end
    -- ponytail: the synchronous handoff navigates Desktop's current focus (local use only).
    local result = vim.system({ "herdr-app", "do", "pane.go", "--direction", direction }, {
        text = true,
    }):wait(1000)
    if result.code ~= 0 then
        vim.notify("Herdr navigation failed: " .. (result.stderr or "request timed out"), vim.log.levels.WARN)
    end
    -- Never wrap Neovim's splits when Desktop cannot move farther in this direction.
    return true
end

return M
