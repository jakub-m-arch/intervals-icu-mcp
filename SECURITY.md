# Security Policy

## Supported versions

Only the latest released version receives security fixes.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report vulnerabilities privately through
[GitHub Security Advisories](https://github.com/jakub-m-arch/intervals-icu-mcp/security/advisories/new).
You should get a first response within 7 days.

## Handling credentials

- This server needs your Intervals.icu API key, which grants **full access** to
  your account. Keep it in your MCP client configuration or environment
  variables, and never commit it.
- The server never logs the API key and never includes it in error messages. If
  you find a case where it does, treat it as a vulnerability and report it
  privately.
- If you think your key has leaked, regenerate it in Intervals.icu → Settings →
  Developer Settings.
