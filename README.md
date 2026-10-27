# Codexing

Codexing is the Issue to Impact connector for the Codex app. It hands you your next LedgerLoop ticket, reviews your
work, runs the ticket's checks and keeps your progress, streak and badges in sync with the programme.

## Install

You need the Codex app, signed in, and Node.js 18 or newer. Run these two commands in a terminal (PowerShell on
Windows):

```
codex plugin marketplace add id8nxt-hub/codexing
codex plugin add codexing@id8nxt
```

No `codex` command? Use `npx -y @openai/codex` in its place, for example
`npx -y @openai/codex plugin marketplace add id8nxt-hub/codexing`.

Then:

1. Quit the Codex app fully and open it again.
2. When Codex asks, sign in to Issue to Impact in the browser and approve Codexing. If it doesn't ask, type `/mcp`
   in Codex, pick `codexing`, then Authenticate.
3. Open your LedgerLoop clone in Codex and say: `@Codexing help me get started`

Optional: type `/hooks` in Codex and trust Codexing's hook. It nudges you to check your work when your tests go green.

## Update

```
codex plugin marketplace upgrade
```

Then restart the Codex app.

## What it can see

Codexing never reads your prompts. Its tools run on the Issue to Impact server (https://api.codexxing.id8devhub.com) after you sign in, and only
work on the LedgerLoop sandbox. The hook on your machine reads the workspace folder and session ID, acts only in a
folder whose `package.json` is named `ledgerloop`, and sends nothing anywhere.

Trouble on Windows: https://codexxing.id8devhub.com/help/windows
