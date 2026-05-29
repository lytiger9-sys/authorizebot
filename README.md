# newisz auth bot

Node.js Discord auth bot with local SQLite storage.

## Features

- Sends an OAuth button panel for server verification.
- Stores verified users in SQLite, joins them to the guild, and grants the selected role.
- Restores previously verified users back to a guild with the restore command.
- Restores the latest encrypted SQLite backup from the backup channel on startup.
- Uploads a fresh encrypted SQLite backup to the backup channel after each new verification.
- Provides a `dbbackup` command for manual backup uploads.

## Setup

1. Create `.env` from `.env.example`.
2. Register `BASE_URL/callback` in the Discord Developer Portal.
3. Enable OAuth2 scopes `identify` and `guilds.join`.
4. Invite the bot with `Manage Roles` and application command permissions.
5. Set `DISCORD_DB_BACKUP_CHANNEL_ID` to a dedicated backup channel.

## Run

```bash
npm install
npm start
```

The default SQLite file path is `./data/newisz-auth-bot.sqlite`.
The encrypted backup payload is derived from `STATE_SECRET`.
