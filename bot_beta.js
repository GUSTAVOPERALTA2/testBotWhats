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
        // Recorre todos los chats y muestra la información completa
        chats.forEach(async chat => {
            // Verificar el número de participantes para determinar si es un grupo o no
            const isGroupChat = chat.participants && chat.participants.length > 2;
            console.log(`Chat: ${chat.name}, Participantes: ${chat.participants.length}`);
            console.log('¿Es un grupo?:', isGroupChat);

            if (isGroupChat) {
                console.log(`✅ Este es un grupo. ID: ${chat.id._serialized}`);
            } else {
                console.log(`❌ Este es un chat normal.`);
            }
        });
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

        // Verifica si el número de participantes en el chat es mayor a 2
        const isGroupChat = chat.participants && chat.participants.length > 2;
        if (isGroupChat) {
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
