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
        footer: "NodeLink Keeper System • Auto-updates every 60s"
    },
    vi: {
        status_title: "🟢 Trạng thái Hệ thống NodeLink",
        not_connected: "❌ Node chưa kết nối.",
        players: "Người dùng", cpu: "Tải CPU", ram: "Dung lượng RAM", uptime: "Uptime",
        footer: "Hệ thống Giữ sống NodeLink • Tự cập nhật mỗi 60s"
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

function parseHost(raw) {
    return (raw || '').replace(/^https?:\/\//, '').split(':')[0];
}

// ✅ TỰ ĐỘNG QUÉT NODE THEO ENV — không giới hạn số lượng
// Quy tắc đặt env: NODE1_HOST, NODE1_PORT, NODE1_PASSWORD, NODE1_SECURE
//                  NODE2_HOST, NODE2_PORT, ...
//                  NODE3_HOST, ... cứ thế tăng dần, bao nhiêu node cũng được
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

// ✅ FIX: NodeLink trả systemLoad dạng load-average thô (có thể >1),
// không phải tỉ lệ 0-1 như Lavalink gốc → cap lại 0-100% để tránh số ảo kiểu 1357%
function formatCpuLoad(stats) {
    const raw = stats.cpu?.systemLoad ?? stats.cpu?.lavalinkLoad ?? 0;
    let percent = raw * 100;

    // Nếu vượt 100% (do NodeLink báo sai scale) → cap lại nhưng vẫn note rõ
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

function getLangRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('lang_en')
            .setLabel('🇬🇧 English')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('lang_vi')
            .setLabel('🇻🇳 Tiếng Việt')
            .setStyle(ButtonStyle.Secondary)
    );
}

client.on('ready', async () => {
    console.log(`✅ Bot ${client.user.tag} is online!`);
    await lavalinkManager.init({ ...client.user });
    console.log(`🎵 Connecting to ${myNodes.length} NodeLink node(s)...`);

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

        for (const [msgId, entry] of statusMessages) {
            try {
                await entry.message.edit({
                    embeds: [getStatusEmbed(entry.lang)],
                    components: [getLangRow()]
                });
                console.log(`🔄 Updated status message: ${msgId}`);
            } catch (e) {
                console.warn(`⚠️ Removed stale status message: ${msgId}`);
                statusMessages.delete(msgId);
            }
        }
    }, 60000);
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton() && ['lang_en', 'lang_vi'].includes(interaction.customId)) {
        const lang = interaction.customId === 'lang_en' ? 'en' : 'vi';
        const msgId = interaction.message.id;

        if (statusMessages.has(msgId)) {
            statusMessages.get(msgId).lang = lang;
        }

        await interaction.update({
            embeds: [getStatusEmbed(lang)],
            components: [getLangRow()]
        });
        return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'status') {
        const reply = await interaction.reply({
            embeds: [getStatusEmbed('en')],
            components: [getLangRow()],
            fetchReply: true
        });

        statusMessages.set(reply.id, { message: reply, lang: 'en' });
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
