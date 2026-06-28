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
        ping: "Ping", players: "Players", cpu: "CPU Load", ram: "RAM Usage",
        switch_btn: "🇻🇳 Switch to Vietnamese", footer: "NodeLink Keeper System"
    },
    vi: {
        status_title: "🟢 Trạng thái Hệ thống NodeLink",
        not_connected: "❌ Node chưa kết nối.",
        ping: "Độ trễ", players: "Người dùng", cpu: "Tải CPU", ram: "Dung lượng RAM",
        switch_btn: "🇬🇧 Chuyển sang English", footer: "Hệ thống Giữ sống NodeLink"
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

// ✅ FIX: Tách host ra khỏi URL (bỏ "https://" nếu có)
function parseHost(raw) {
    return (raw || '').replace(/^https?:\/\//, '').split(':')[0];
}

// ✅ FIX: dùng host/port/authorization thay vì url/password
const myNodes = [
    {
        id: "NodeLink-1",
        host: parseHost(process.env.NODE_HOST || "127.0.0.1"),
        port: parseInt(process.env.NODE_PORT) || 2333,
        authorization: process.env.NODE_PASSWORD || "youshallnotpass",
        secure: process.env.NODE_SECURE === "true"
    },
    {
        id: "NodeLink-2",
        host: parseHost(process.env.NODE2_HOST || "127.0.0.1"),
        port: parseInt(process.env.NODE2_PORT) || 2333,
        authorization: process.env.NODE2_PASSWORD || "youshallnotpass",
        secure: process.env.NODE2_SECURE === "true"
    }
];

console.log("📝 Configured Nodes:", JSON.stringify(myNodes, null, 2));

// ✅ FIX: sendToShard → sendPayload
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

function getStatusEmbed(lang) {
    const t = i18n[lang];
    const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle(t.status_title)
        .setFooter({ text: t.footer })
        .setTimestamp();

    const nodes = Array.from(lavalinkManager.nodeManager.nodes.values());

    nodes.forEach((node, index) => {
        const nodeName = `Node ${index + 1} (${node.options.id || node.options.name})`;

        if (!node || node.connected !== true) {
            embed.addFields({ name: `🔴 ${nodeName}`, value: `\`\`\`${t.not_connected}\`\`\``, inline: false });
            return;
        }

        const stats = node.stats || {};
        const cpuLoad = stats.cpu?.systemLoad ? (stats.cpu.systemLoad * 100).toFixed(2) : 0;
        const usedRam = stats.memory?.used ? (stats.memory.used / 1024 / 1024).toFixed(2) : 0;

        embed.addFields({
            name: `🟢 ${nodeName}`,
            value: `**${t.ping}:** ${node.ping}ms\n**${t.players}:** ${stats.players || 0}\n**${t.cpu}:** ${cpuLoad}%\n**${t.ram}:** ${usedRam} MB`,
            inline: true
        });
    });

    return embed;
}

client.on('ready', async () => {
    console.log(`✅ Bot ${client.user.tag} is online!`);
    await lavalinkManager.init({ ...client.user });
    console.log('🎵 Connecting to NodeLink cluster...');

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
    }, 60000);
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
        const newLang = interaction.customId === 'lang_en' ? 'en' : 'vi';
        const oppositeLang = newLang === 'en' ? 'vi' : 'en';

        const embed = getStatusEmbed(newLang);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`lang_${oppositeLang}`)
                .setLabel(i18n[oppositeLang].switch_btn)
                .setStyle(ButtonStyle.Primary)
        );
        await interaction.update({ embeds: [embed], components: [row] });
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'status') {
        const embed = getStatusEmbed('en');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('lang_vi')
                .setLabel(i18n.vi.switch_btn)
                .setStyle(ButtonStyle.Primary)
        );
        await interaction.reply({ embeds: [embed], components: [row] });
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
