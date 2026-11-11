# GA4 MCP authentication: Omarchy review

## Change under review

The local update in [`home/.pi/agent/mcp.json`](../home/.pi/agent/mcp.json)
changes the GA4 authorization header from an environment variable to macOS
Keychain lookup. This is a client authentication change, not evidence of a
server deployment or API change.

Endpoint (unchanged):
`https://ga4-gtm-mcp-server.1-five-q-innovations.workers.dev/mcp`

Before:

```json
"Authorization": "Bearer ${GA4_MCP_TOKEN}"
```

After:

```json
"Authorization": "!printf 'Bearer %s' \"$(/usr/bin/security find-generic-password -s ga4-mcp-token -w)\""
```

Pi supports a whole header value beginning with `!` as a shell command;
its output supplies the header. This command retrieves the generic-password
item with service name `ga4-mcp-token` from Apple Keychain and prefixes it
with `Bearer `. The token itself is not stored in this config.

## Omarchy impact

- `/usr/bin/security` and Apple Keychain are macOS-specific. The new header
  cannot retrieve a token on Omarchy/Linux as written.
- Setting `GA4_MCP_TOKEN` alone no longer fixes Pi authentication: this header
  does not reference that variable.
- If lookup fails, `printf` can still succeed and emit an empty bearer token.
  Treat authentication failure as a possible credential-lookup failure, not
  necessarily a GA4 server problem.
- [`home/.config/opencode/opencode.jsonc`](../home/.config/opencode/opencode.jsonc)
  still uses `Bearer {env:GA4_MCP_TOKEN}`. The change applies to Pi, not OpenCode.

## Suggested review decision

Keep environment-variable authentication in the shared Pi config unless a
platform-specific configuration strategy is deliberately chosen. The smallest
Linux-compatible option is the previous header:

```json
"Authorization": "Bearer ${GA4_MCP_TOKEN}"
```

Provide `GA4_MCP_TOKEN` through the local session or an existing credential
manager; do not commit a token. A macOS launcher could populate that variable
from Keychain without making the shared config macOS-only. No launcher,
Linux credential backend, or config change is implemented by this document.

## Review checklist on Omarchy

- [ ] Choose shared environment-variable auth or an explicit per-platform override.
- [ ] Ensure Pi receives a nonempty token without printing it or committing it.
- [ ] Start a fresh Pi session and verify GA4 connects and a read-only tool call succeeds.
- [ ] Verify missing credentials produce a clear failure, rather than silently sending an empty token.
- [ ] If OpenCode is used, verify its environment-variable configuration separately.

Status: documented from the local config diff; no live authentication or Linux
runtime testing performed.
