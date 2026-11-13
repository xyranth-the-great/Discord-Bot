require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  REST,
  Routes,
  EmbedBuilder,
} = require("discord.js");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "checklists.json");
const MAX_TASKS = 100;
const TASKS_PER_PAGE = 15;

if (!process.env.DISCORD_TOKEN) {
  console.error("Missing DISCORD_TOKEN. Copy .env.example to .env and add your bot token.");
  process.exit(1);
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return {};
  }
}

let checklists = loadData();

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(checklists, null, 2), "utf8");
}

function cleanText(value) {
  return value
    .replace(/([\\_*~|`>])/g, "\\$1")
    .replace(/@/g, "@\u200b");
}

function renderChecklist(board) {
  const completed = board.tasks.filter(task => task.done).length;
  const total = board.tasks.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const pageCount = Math.max(1, Math.ceil(total / TASKS_PER_PAGE));
  const page = Math.min(Math.max(board.page || 0, 0), pageCount - 1);
  const pageTasks = board.tasks.slice(page * TASKS_PER_PAGE, (page + 1) * TASKS_PER_PAGE);

  const embed = new EmbedBuilder()
    .setTitle(`📋 ${board.title}`)
    .setColor(0x2ecc71)
    .setTimestamp();

  if (total === 0) {
    embed.setDescription("_No tasks yet. Click **＋ Add task** to add your first one._");
  } else {
    const pendingTasks = pageTasks.filter(t => !t.done);
    const doneTasks = pageTasks.filter(t => t.done);

    let description = `**Progress: ${completed}/${total} (${progress}%)**\n`;
    description += `\`${"█".repeat(Math.floor(progress / 5))}${"░".repeat(20 - Math.floor(progress / 5))}\` ${progress}%\n\n`;
    if (pageCount > 1) description += `**Tasks (page ${page + 1}/${pageCount})**\n`;

    if (pendingTasks.length > 0) {
      description += "**📝 Pending**\n";
      description += pendingTasks.map(t => `☐ ${cleanText(t.name)}`).join("\n");
    }

    if (doneTasks.length > 0) {
      if (pendingTasks.length > 0) description += "\n\n";
      description += "**✅ Completed**\n";
      description += doneTasks.map(t => `☑ ~~${cleanText(t.name)}~~`).join("\n");
    }

    embed.setDescription(description);
  }

  return {
    embeds: [embed],
    components: buildComponents(board),
    allowedMentions: { parse: [] },
  };
}

function buildComponents(board) {
  const rows = [];
  const pageCount = Math.max(1, Math.ceil(board.tasks.length / TASKS_PER_PAGE));
  const page = Math.min(Math.max(board.page || 0, 0), pageCount - 1);

  for (let i = page * TASKS_PER_PAGE; i < Math.min((page + 1) * TASKS_PER_PAGE, board.tasks.length); i += 5) {
    const row = new ActionRowBuilder();
    for (const task of board.tasks.slice(i, i + 5)) {
      const label = `${task.done ? "☑" : "☐"} ${task.name}`;
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`toggle:${board.guildId}:${task.id}`)
          .setLabel(label.length > 80 ? label.slice(0, 77) + "..." : label)
          .setStyle(task.done ? ButtonStyle.Success : ButtonStyle.Secondary)
      );
    }
    rows.push(row);
  }

  const controls = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`add:${board.guildId}`)
      .setLabel("＋ Add task")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`page-prev:${board.guildId}`)
      .setLabel("Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`page:${board.guildId}`)
      .setLabel(`${page + 1}/${pageCount}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`page-next:${board.guildId}`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= pageCount - 1),
    new ButtonBuilder()
      .setCustomId(`clear:${board.guildId}`)
      .setLabel("Clear completed")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!board.tasks.some(task => task.done))
  );
  rows.push(controls);
  return rows;
}

async function refreshBoard(client, board) {
  const channel = await client.channels.fetch(board.channelId);
  if (!channel || !channel.isTextBased()) throw new Error("Checklist channel not found.");
  const message = await channel.messages.fetch(board.messageId);
  await message.edit(renderChecklist(board));
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, readyClient => {
  console.log(`NIGGACHECKER is online as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === "setup-checklist") {
      const guildId = interaction.guildId;
      if (!guildId) {
        return interaction.reply({ content: "Use this command inside your server.", ephemeral: true });
      }

      const board = checklists[guildId] || {
        guildId,
        title: "IMPORTANT TASK TO DO",
        tasks: [],
      };

      board.channelId = interaction.channelId;
      board.updatedBy = interaction.user.id;

      const message = await interaction.reply({
        ...renderChecklist(board),
        fetchReply: true,
      });

      board.messageId = message.id;
      checklists[guildId] = board;
      saveData();
      return;
    }

    if (interaction.isButton()) {
      const [action, guildId, taskId] = interaction.customId.split(":");
      const board = checklists[guildId];

      if (!board) {
        return interaction.reply({ content: "I couldn't find this checklist. Run /setup-checklist again.", ephemeral: true });
      }

      if (action === "page-prev" || action === "page-next") {
        const pageCount = Math.max(1, Math.ceil(board.tasks.length / TASKS_PER_PAGE));
        const currentPage = Math.min(Math.max(board.page || 0, 0), pageCount - 1);
        board.page = action === "page-prev"
          ? Math.max(0, currentPage - 1)
          : Math.min(pageCount - 1, currentPage + 1);
        return interaction.update(renderChecklist(board));
      }

      if (action === "toggle") {
        const task = board.tasks.find(item => item.id === taskId);
        if (!task) {
          return interaction.reply({ content: "That task no longer exists. Please refresh the checklist.", ephemeral: true });
        }
        task.done = !task.done;
        board.updatedBy = interaction.user.id;
        saveData();
        return interaction.update(renderChecklist(board));
      }

      if (action === "add") {
        const modal = new ModalBuilder()
          .setCustomId(`add-modal:${guildId}`)
          .setTitle("Add a task");

        const input = new TextInputBuilder()
          .setCustomId("task-name")
          .setLabel("What needs to be done?")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("e.g. Finish school project")
          .setMaxLength(100)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (action === "clear") {
        board.tasks = board.tasks.filter(task => !task.done);
        board.page = Math.min(board.page || 0, Math.max(0, Math.ceil(board.tasks.length / TASKS_PER_PAGE) - 1));
        board.updatedBy = interaction.user.id;
        saveData();
        return interaction.update(renderChecklist(board));
      }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("add-modal:")) {
      const guildId = interaction.customId.split(":")[1];
      const board = checklists[guildId];

      if (!board) {
        return interaction.reply({ content: "Checklist not found. Run /setup-checklist again.", ephemeral: true });
      }

      if (board.tasks.length >= MAX_TASKS) {
        return interaction.reply({
          content: `This simple version supports up to ${MAX_TASKS} tasks at once. Clear completed tasks to make room.`,
          ephemeral: true,
        });
      }

      const name = interaction.fields.getTextInputValue("task-name").trim();
      if (!name) {
        return interaction.reply({ content: "Please enter a task name.", ephemeral: true });
      }

      board.tasks.push({ id: randomUUID().slice(0, 8), name, done: false });
      board.updatedBy = interaction.user.id;
      saveData();

      await interaction.reply({ content: `Added **${name.replace(/[*_`~]/g, "")}** to the checklist.`, ephemeral: true });
      await refreshBoard(client, board);
    }
  } catch (error) {
    console.error(error);
    const message = "Something went wrong. Check the bot console for details.";
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
