# NIGGACHECKER

A simple shared Discord checklist bot. Everyone who can see the checklist message can:
- Click a task button to check/uncheck it.
- See completed tasks crossed out in the same message.
- Add tasks with the **＋ Add task** button.
- Remove completed tasks with **Clear completed**.
- Use **Previous** and **Next** to page through larger checklists.

The checklist is saved in `data/checklists.json`.

## Requirements

- Node.js 20.18.0 or newer (Node.js 22 LTS recommended)
- A Discord server where you can add applications/bots
- Permission to create an application in the Discord Developer Portal

## 1. Create the Discord bot application

1. Open https://discord.com/developers/applications
2. Click **New Application** and name it `NIGGACHECKER`.
3. Open **Bot** and click **Add Bot** if Discord asks.
4. Under **Bot**, use **Reset Token** / **Copy Token** to get the bot token. Keep it private.
5. Open **OAuth2 → General** and copy the **Application ID**.
6. Open **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot permissions: `View Channels`, `Send Messages`, `Read Message History`
7. Open the generated URL and invite the bot to your server.

Do not share your bot token with anyone or upload it to GitHub.

## 2. Configure the project

1. Install Node.js from https://nodejs.org/ if you do not have it.
2. Extract this project folder.
3. Rename `.env.example` to `.env`.
4. Fill in:
   - `DISCORD_TOKEN`: the bot token
   - `CLIENT_ID`: the Application ID
   - `GUILD_ID`: your Discord server ID

To copy your Server ID, enable Developer Mode in Discord (`User Settings → Advanced → Developer Mode`), then right-click your server icon and choose **Copy Server ID**.

## 3. Install and start

Open Command Prompt or PowerShell in the folder containing the `NIGGACHECKER` folder and run:

```bash
npm --prefix NIGGACHECKER install
npm run deploy
npm start
```

Keep the terminal window open while you want the bot online.

## 4. Create the checklist

In your Discord server, open the channel where you want the checklist and run:

```text
/setup-checklist
```

The bot posts one checklist message. Everyone can click task buttons or use **＋ Add task**. The same message updates as people work.

## Notes

- Each server checklist supports up to 100 tasks, shown 15 at a time so the checklist stays within Discord's message limits.
- It stores data locally in `data/checklists.json`. Back up that file.
- The bot is online only while the computer or hosting service running it is online.
- Anyone who can interact with the message can add tasks, check/uncheck tasks, or clear completed tasks.
