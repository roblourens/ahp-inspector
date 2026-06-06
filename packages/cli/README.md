# ahp-inspector

Local-first viewer for VS Code Agent Host Protocol (AHP) JSONL logs.

![AHP Inspector timeline in hacker theme](https://raw.githubusercontent.com/roblourens/ahp-inspector/main/screenshots/phase3-hacker-theme-columns.png)

```bash
npx ahp-inspector            # auto-open the most recent AHP log
npx ahp-inspector path.jsonl # open a specific file
```

Starts a local HTTP server on `127.0.0.1`, opens your default browser, and
streams the log into a fast virtualized timeline with search, filtering,
correlation, and detail inspection.

Flags:

- `--port <n>` — choose a specific port (default: 5173; `0` for ephemeral).
- `--no-open` — start the server but don't auto-open the browser.
- `--no-auto-discover` — skip the auto-open-latest-log step on no-arg launches.

See the [project README](https://github.com/roblourens/ahp-inspector#readme) for
the auto-discovery rule, full feature list, and screenshots.

**Privacy:** binds to `127.0.0.1` only, no telemetry, no outbound network calls.
Log files are read locally and never uploaded.

## License

MIT
