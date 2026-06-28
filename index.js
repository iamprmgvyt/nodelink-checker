require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { LavalinkManager } = require('lavalink-client');

// --- Express Server (Giúp Render không sleep) ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('✅ NodeLink Keeper Bot is running!'));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// --- Hệ thống Ngôn ngữ (Translation System) ---
const i18n = {
    en: {
        online: "✅ Bot is online!",
        connecting: "🎵 Connecting to NodeLink...",
        not_connected: "❌ NodeLink is not connected.",
        status_title: "🟢 NodeLink Status",
        ping: "Ping",
        players: "Active Players",
        cpu: "CPU Load",
        ram: "RAM Usage",
        uptime: "Uptime",
        switch_btn: "🇻🇳 Switch to Vietnamese",
        footer: "NodeLink Keeper System"
    },
    vi: {
        online: "✅ Bot đã online!",
        connecting: "🎵 Đang kết nối tới NodeLink...",
        not_connected: "❌ NodeLink chưa kết nối.",
        status_title: "🟢 Trạng thái NodeLink",
        ping: "Độ trễ",
        players: "Người dùng đang phát",
        cpu: "Tải CPU",
        ram: "Dung lượng RAM",
        uptime: "Thời gian hoạt động",
        switch_btn: "🇬🇧 Chuyển sang English",
        footer: "Hệ thống Giữ sống NodeLink"
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

const lavalinkManager = new LavalinkManager({
    nodes: [{
        host: process.env.NODE_HOST || "127.0.0.1",
        port: parseInt(process.env.NODE_PORT) || 2333,
        password: process.env.NODE_PASSWORD || "youshallnotpass",
        secure: process.env.NODE_SECURE === "true" || false,
        name: "MyNodeLink"
    }],
    sendToShard: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
    },
    client: {
        id: process.env.CLIENT_ID,
        username: "NodeLink Keeper"
    }
});

// Hàm tạo Embed trạng thái theo ngôn ngữ
function getStatusEmbed(lang, node) {
    const t = i18n[lang];
    if (!node || node.connected !== true) {
        return new EmbedBuilder().setColor(0xFF0000).setTitle(t.not_connected);
    }

    const stats = node.stats || {};
    const cpuLoad = stats.cpu?.systemLoad ? (stats.cpu.systemLoad * 100).toFixed(2) : 0;
    const usedRam = stats.memory?.used ? (stats.memory.used / 1024 / 1024).toFixed(2) : 0;

    return new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle(t.status_title)
        .addFields(
            { name: `📡 ${t.ping}`, value: `**${node.ping}ms**`, inline: true },
            { name: `🎧 ${t.players}`, value: `**${stats.players || 0}**`, inline: true },
            { name: `💻 ${t.cpu}`, value: `**${cpuLoad}%**`, inline: true },
            { name: `💾 ${t.ram}`, value: `**${usedRam} MB**`, inline: true }
        )
        .setFooter({ text: t.footer })
        .setTimestamp();
}

// Sự kiện Bot sẵn sàng
client.on('ready', async () => {
    console.log(`✅ Bot ${client.user.tag} is online! / Bot đã online!`);
    await lavalinkManager.init({ ...client.user });
    console.log('🎵 Connecting to NodeLink... / Đang kết nối tới NodeLink...');

    // Vòng lặp giữ sống NodeLink
    setInterval(async () => {
        const node = lavalinkManager.nodeManager.getLeastUsedNode();
        if (!node || node.connected !== true) return;

        const randomUrl = youtubeUrls[Math.floor(Math.random() * youtubeUrls.length)];
        try {
            await node.rest.loadTracks(randomUrl);
            console.log(`✅ [EN] Kept alive by loading: ${randomUrl} | [VI] Giữ sống thành công bằng cách tải: ${randomUrl}`);
        } catch (e) {
            console.error(`❌ [EN] Error loading track | [VI] Lỗi tải nhạc:`, e.message);
        }
    }, 60000); // 1 phút
});

// Xử lý lệnh và nút bấm
client.on('interactionCreate', async (interaction) => {
    // 1. Xử lý Nút bấm đổi ngôn ngữ
    if (interaction.isButton()) {
        if (interaction.customId === 'lang_en') {
            const node = lavalinkManager.nodeManager.getLeastUsedNode();
            const embed = getStatusEmbed('en', node);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('lang_vi').setLabel(i18n.vi.switch_btn).setStyle(ButtonStyle.Primary)
            );
            await interaction.update({ embeds: [embed], components: [row] });
        } 
        else if (interaction.customId === 'lang_vi') {
            const node = lavalinkManager.nodeManager.getLeastUsedNode();
            const embed = getStatusEmbed('vi', node);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('lang_en').setLabel(i18n.en.switch_btn).setStyle(ButtonStyle.Primary)
            );
            await interaction.update({ embeds: [embed], components: [row] });
        }
    }

    // 2. Xử lý lệnh Slash Command (/status)
    if (interaction.isChatInputCommand() && interaction.commandName === 'status') {
        const node = lavalinkManager.nodeManager.getLeastUsedNode();
        
        // Mặc định ban đầu là Tiếng Việt, có nút chuyển sang English
        const embed = getStatusEmbed('en', node);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('lang_en').setLabel(i18n.en.switch_btn).setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    }
});

// Đăng ký lệnh /status khi vào server
client.on('guildCreate', async (guild) => {
    await guild.commands.set([
        {
            name: 'status',
            description: 'Kiểm tra trạng thái NodeLink / Check NodeLink status'
        }
    ]);
});

client.on('raw', (d) => lavalinkManager.sendRawData(d));
client.login(process.env.DISCORD_TOKEN);
