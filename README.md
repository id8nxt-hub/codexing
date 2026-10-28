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

1. Quit the ChatGPT desktop app fully and open it again. We recommend signing in to it with a personal ChatGPT
   account: this is purely for learning and experimenting.
2. Link your account, once. Make sure you're using the desktop app, not the browser. Go to **Settings → Plugins →
   Installed plugins**, click **Codexing**, then **MCP servers**, and click **Authenticate**. (It's also under
   **Settings → MCP servers**, next to `codexing`.) A page opens: approve to link your account. Your account is
   now linked, and your progress can be tracked. Don't worry: the plugin stops working automatically after the
   event is over.
3. In any chat, say: `@Codexing start`. It checks your computer is ready (Sites, computer use) and hands you your
   first ticket. The first one ships a small Codex Site and needs no clone.

> **Once the connection is done, you get one month of included usage on the house from OpenAI for this programme.**

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
