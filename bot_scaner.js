const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    console.log('🔹 Escanea este QR con WhatsApp Web:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('✅ Bot de WhatsApp conectado y listo.');

    // Obtener todos los chats del usuario
    const chats = await client.getChats();
    
    // Filtrar solo los grupos
    const groups = chats.filter(chat => chat.isGroup);
    
    // Mostrar los IDs de los grupos
    console.log('🔹 Grupos disponibles:');
    groups.forEach(group => {
        console.log(`ID del grupo: ${group.id._serialized} - Nombre: ${group.name}`);
    });
});

client.on('message', async message => {
    console.log(`📩 Mensaje recibido: ${message.body}`);

    // Palabras clave para reenviar
    const keywords = ["TV", "controles", "luces"];

    if (keywords.some(word => message.body.toLowerCase().includes(word.toLowerCase()))) {
        const chat = await message.getChat();
        if (chat.isGroup) {
            console.log('📤 Reenviando mensaje...');
            await message.forward('GRUPO_DESTINO_ID'); // Reemplaza con el ID real del grupo destino
        }
    }
});

client.initialize();
