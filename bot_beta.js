const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
});

client.on('qr', (qr) => {
    console.log('Escanea este QR con tu teléfono:', qr);
});

client.on('ready', async () => {
    console.log('✅ Bot de WhatsApp conectado y listo.');

    try {
        const chats = await client.getChats();

        for (const chat of chats) {
            console.log(`Chat: ${chat.name}`);

            if (chat.id.server === 'g.us') {  // Verifica si es un grupo
                try {
                    const groupChat = await client.getChatById(chat.id._serialized); // Obtiene detalles completos
                    const participants = groupChat.participants || []; // Asegura que haya participantes

                    console.log(`Participantes: ${participants.length}`);
                } catch (error) {
                    console.error(`❌ Error al obtener participantes del grupo ${chat.name}:`, error);
                }
            } else {
                console.log("🔹 Este chat no es un grupo.");
            }
        }
    } catch (error) {
        console.error("❌ Error al obtener los chats:", error);
    }
});

client.initialize();
