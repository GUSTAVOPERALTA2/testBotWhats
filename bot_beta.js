const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth()
});

// Evento para mostrar el QR en consola
client.on('qr', qr => {
    console.log('🔹 Escanea este QR con WhatsApp Web:');
    qrcode.generate(qr, { small: true });
});

// Evento cuando el cliente está listo
client.on('ready', async () => {
    console.log('✅ Bot de WhatsApp conectado y listo.');

    // Obtener todos los chats
    const chats = await client.getChats();
    console.log('Chats disponibles:', chats);

    if (chats && chats.length > 0) {
        // Filtrar solo los chats que son grupos
        const groups = chats.filter(chat => chat.isGroup);
        console.log('Grupos disponibles:');
        groups.forEach(group => {
            console.log(`ID del grupo: ${group.id._serialized}`);  // Muestra el ID de cada grupo
        });

        // Si no se encuentran grupos
        if (groups.length === 0) {
            console.log('❌ No se encontraron grupos');
        }
    } else {
        console.log('❌ No se encontraron chats');
    }
});

// Evento para recibir y procesar los mensajes
client.on('message', async message => {
    console.log(`📩 Mensaje recibido: ${message.body}`);

    // Palabras clave para reenviar
    const keywords = ["TV", "controles", "luces"];

    // Verifica si el mensaje contiene alguna palabra clave
    if (keywords.some(word => message.body.toLowerCase().includes(word.toLowerCase()))) {
        const chat = await message.getChat();

        // Verifica si es un grupo y si el mensaje contiene palabras clave
        if (chat.isGroup) {
            console.log('📤 Reenviando mensaje...');

            // ID del grupo de destino
            const targetGroupId = '120363408965534037';  // ID real del grupo de destino

            // Reenvía el mensaje al grupo de destino
            await message.forward(targetGroupId);
            console.log('✅ Mensaje reenviado al grupo de destino.');
        }
    }
});

// Inicializa el cliente de WhatsApp
client.initialize();
