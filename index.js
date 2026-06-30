require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { LavalinkManager } = require('lavalink-client');

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('✅ NodeLink Keeper Bot is running!'));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

const i18n = {
    en: {
        status_title: "🟢 NodeLink Cluster Status",
        not_connected: "❌ Node is not connected.",
        players: "Players", cpu: "CPU Load", ram: "RAM Usage", uptime: "Uptime",
        footer: "NodeLink Keeper System • Auto-updates every 5 minutes",
        refresh_btn: "🔄 Refresh"
    },
    vi: {
        status_title: "🟢 Trạng thái Hệ thống NodeLink",
        not_connected: "❌ Node chưa kết nối.",
        players: "Người dùng", cpu: "Tải CPU", ram: "Dung lượng RAM", uptime: "Uptime",
        footer: "Hệ thống Giữ sống NodeLink • Tự cập nhật mỗi 5 phút",
        refresh_btn: "🔄 Làm mới"
    }
};

const youtubeUrls = [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=9bZkp7q19f0",
    "https://www.youtube.com/watch?v=kJQP7kiw5Fk",
    "https://www.youtube.com/watch?v=JGwWNGJdvx8"
];

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const startTime = Date.now();
const statusMessages = new Map();

// ✅ Auto-update đổi từ 60s → 5 phút
const REFRESH_INTERVAL = 5 * 60 * 1000; // 300000ms = 5 phút
const KEEPALIVE_INTERVAL = 60000; // keep-alive NodeLink vẫn giữ 60s để node không bị sleep

function parseHost(raw) {
    return (raw || '').replace(/^https?:\/\//, '').split(':')[0];
}

function buildNodesFromEnv() {
    const nodeIndexes = new Set();
    const regex = /^NODE(\d+)_HOST$/;

    for (const key of Object.keys(process.env)) {
        const match = key.match(regex);
        if (match) nodeIndexes.add(parseInt(match[1]));
    }

    if (nodeIndexes.size === 0) {
        console.warn("⚠️ Không tìm thấy biến NODE{n}_HOST nào trong env! Dùng node mặc định 127.0.0.1");
        return [{
            id: "NodeLink-1",
            host: "127.0.0.1",
            port: 2333,
            authorization: "youshallnotpass",
            secure: false
        }];
    }

    const sortedIndexes = Array.from(nodeIndexes).sort((a, b) => a - b);

    return sortedIndexes.map(i => ({
        id: `NodeLink-${i}`,
        host: parseHost(process.env[`NODE${i}_HOST`]),
        port: parseInt(process.env[`NODE${i}_PORT`]) || 2333,
        authorization: process.env[`NODE${i}_PASSWORD`] || "youshallnotpass",
        secure: process.env[`NODE${i}_SECURE`] === "true"
    }));
}

const myNodes = buildNodesFromEnv();
console.log(`📝 Configured ${myNodes.length} Node(s):`, JSON.stringify(myNodes, null, 2));

const lavalinkManager = new LavalinkManager({
    nodes: myNodes,
    sendToShard: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
    },
    client: {
        id: process.env.CLIENT_ID,
        username: "NodeLink Keeper"
    }
});

function formatUptime(ms) {
    const total = Math.floor(ms / 1000);
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
}

function formatCpuLoad(stats) {
    const raw = stats.cpu?.systemLoad ?? stats.cpu?.lavalinkLoad ?? 0;
    let percent = raw * 100;

    if (percent > 100) {
        return `~100%+ (raw: ${raw.toFixed(2)})`;
    }
    return `${percent.toFixed(2)}%`;
}

function getStatusEmbed(lang) {
    const t = i18n[lang];
    const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle(t.status_title)
        .setFooter({ text: t.footer })
        .setTimestamp();

    embed.addFields({
        name: `⏱️ ${t.uptime}`,
        value: `\`${formatUptime(Date.now() - startTime)}\``,
        inline: false
    });

    const nodes = Array.from(lavalinkManager.nodeManager.nodes.values());
    nodes.forEach((node, index) => {
        const nodeName = `Node ${index + 1} (${node.options.id || node.options.name})`;

        if (!node || node.connected !== true) {
            embed.addFields({
                name: `🔴 ${nodeName}`,
                value: `\`\`\`${t.not_connected}\`\`\``,
                inline: false
            });
            return;
        }

        const stats = node.stats || {};
        const cpuDisplay = formatCpuLoad(stats);
        const usedRam = stats.memory?.used ? (stats.memory.used / 1024 / 1024).toFixed(2) : '0.00';

        embed.addFields({
            name: `🟢 ${nodeName}`,
            value: `**${t.players}:** ${stats.players || 0}\n**${t.cpu}:** ${cpuDisplay}\n**${t.ram}:** ${usedRam} MB`,
            inline: true
        });
    });

    return embed;
}

// ✅ Thêm nút Refresh thủ công bên cạnh 2 nút đổi ngôn ngữ
function getControlRow(lang) {
    const t = i18n[lang];
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('lang_en')
            .setLabel('🇬🇧 English')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('lang_vi')
            .setLabel('🇻🇳 Tiếng Việt')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('refresh_status')
            .setLabel(t.refresh_btn)
            .setStyle(ButtonStyle.Primary)
    );
}

client.on('ready', async () => {
    console.log(`✅ Bot ${client.user.tag} is online (internal)!`);

    // ✅ Đặt presence thành Invisible — bot vẫn chạy bình thường,
    // chỉ là hiển thị OFFLINE với người dùng trên Discord
    client.user.setPresence({ status: 'invisible' });

    await lavalinkManager.init({ ...client.user });
    console.log(`🎵 Connecting to ${myNodes.length} NodeLink node(s)...`);

    // Keep-alive NodeLink — vẫn giữ 60s để tránh node bị Render sleep
    setInterval(async () => {
        const nodes = Array.from(lavalinkManager.nodeManager.nodes.values());
        for (const node of nodes) {
            if (!node || node.connected !== true) continue;
            const randomUrl = youtubeUrls[Math.floor(Math.random() * youtubeUrls.length)];
            try {
                await node.rest.loadTracks(randomUrl);
                console.log(`✅ [${node.options.id}] Kept alive: ${randomUrl}`);
            } catch (e) {
                console.error(`❌ [${node.options.id}] Error:`, e.message);
            }
        }
    }, KEEPALIVE_INTERVAL);

    // Auto-update status messages — đổi sang 5 phút
    setInterval(async () => {
        for (const [msgId, entry] of statusMessages) {
            try {
                await entry.message.edit({
                    embeds: [getStatusEmbed(entry.lang)],
                    components: [getControlRow(entry.lang)]
                });
                console.log(`🔄 Auto-updated status message: ${msgId}`);
            } catch (e) {
                console.warn(`⚠️ Removed stale status message: ${msgId}`);
                statusMessages.delete(msgId);
            }
        }
    }, REFRESH_INTERVAL);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) {
        if (interaction.isChatInputCommand() && interaction.commandName === 'status') {
            const reply = await interaction.reply({
                embeds: [getStatusEmbed('en')],
                components: [getControlRow('en')],
                fetchReply: true
            });
            statusMessages.set(reply.id, { message: reply, lang: 'en' });
        }
        return;
    }

    const msgId = interaction.message.id;

    // Đổi ngôn ngữ
    if (['lang_en', 'lang_vi'].includes(interaction.customId)) {
        const lang = interaction.customId === 'lang_en' ? 'en' : 'vi';
        if (statusMessages.has(msgId)) {
            statusMessages.get(msgId).lang = lang;
        }
        await interaction.update({
            embeds: [getStatusEmbed(lang)],
            components: [getControlRow(lang)]
        });
        return;
    }

    // ✅ Refresh thủ công
    if (interaction.customId === 'refresh_status') {
        const lang = statusMessages.get(msgId)?.lang || 'en';
        await interaction.update({
            embeds: [getStatusEmbed(lang)],
            components: [getControlRow(lang)]
        });
        return;
    }
});

client.on('guildCreate', async (guild) => {
    await guild.commands.set([{
        name: 'status',
        description: 'Check NodeLink cluster status / Kiểm tra trạng thái NodeLink'
    }]);
});

client.on('raw', (d) => lavalinkManager.sendRawData(d));
client.login(process.env.DISCORD_TOKEN);
