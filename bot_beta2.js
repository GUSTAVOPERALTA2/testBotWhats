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
        // Filtrar solo los chats que son grupos (basado en el ID del chat)
        const groups = chats.filter(chat => chat.id._serialized.includes('@g.us'));
        console.log('Grupos disponibles:');

        if (groups.length === 0) {
            console.log('❌ No se encontraron grupos');
        } else {
            groups.forEach(group => {
                console.log(`Grupo encontrado: ${group.name}, ID: ${group.id._serialized}`);  // Muestra el nombre y el ID de cada grupo
            });
        }
    } else {
        console.log('❌ No se encontraron chats');
    }
});

// Evento para recibir y procesar los mensajes
client.on('message', async message => {
    console.log(`📩 Mensaje recibido: ${message.body}`);

    // Palabras clave para reenviar
    const keywords = ["TV"];

    // ID de los grupos
    const groupITPruebaId = '120363389868056953@g.us';  // ID del grupo "IT prueba"
    const groupBotDestinoId = '120363408965534037@g.us';  // ID del grupo "Bot destino"

    // Verifica si el mensaje contiene alguna palabra clave
    if (keywords.some(word => message.body.toLowerCase().includes(word.toLowerCase()))) {
        const chat = await message.getChat();

        // Verifica si el mensaje es del grupo "IT prueba"
        if (chat.id._serialized === groupITPruebaId) {
            console.log('🔹 Mensaje de "IT prueba" contiene "TV", reenviando...');

            // Reenvía el mensaje al grupo "Bot destino"
            const targetChat = await client.getChatById(groupBotDestinoId);
            await targetChat.sendMessage(message.body);
            console.log('✅ Mensaje reenviado al grupo "Bot destino".');
        }
    }
});

// Inicializa el cliente de WhatsApp
client.initialize();
