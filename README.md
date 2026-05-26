# newisz auth bot

Node.js Discord auth bot with local SQLite storage.

## Features

- `/인증패널 role:<role>` sends an OAuth button panel.
- After OAuth approval, the bot stores the token in SQLite, joins the user to the guild, and grants the selected role.
- `/복구 source_server_id:<guild_id> role:<optional>` re-adds previously verified users to the current guild.

## Setup

1. Create `.env` from `.env.example`.
2. Register `BASE_URL/callback` in the Discord Developer Portal.
3. Enable OAuth2 scopes `identify` and `guilds.join`.
4. Invite the bot with `Manage Roles` and application command permissions.

## Run

```bash
npm install
npm start
```

The default SQLite file path is `./data/newisz-auth-bot.sqlite`.
