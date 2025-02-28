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

    try {
        // Obtener todos los chats disponibles (grupos e individuales)
        const chats = await client.getChats();
        
        // Imprimir todos los chats disponibles
        console.log('🔹 Todos los chats disponibles:');
        chats.forEach(chat => {
            console.log(`Chat ID: ${chat.id._serialized} - Nombre: ${chat.name} - Es grupo: ${chat.isGroup}`);
        });

        // Filtrar los grupos
        const groups = chats.filter(chat => chat.isGroup);

        if (groups.length > 0) {
            console.log('🔹 Grupos disponibles:');
            groups.forEach(group => {
                console.log(`ID del grupo: ${group.id._serialized} - Nombre: ${group.name}`);
            });
        } else {
            console.log('🔹 No se encontraron grupos.');
        }
    } catch (error) {
        console.error('Error al obtener los chats:', error);
    }
});

client.on('message', async message => {
    console.log(`📩 Mensaje recibido: ${message.body}`);

    // Palabras clave para reenviar
    const keywords = ["TV", "controles", "luces"];

    // Verificar si el mensaje contiene alguna de las palabras clave
    if (keywords.some(word => message.body.toLowerCase().includes(word.toLowerCase()))) {
        const chat = await message.getChat();
        if (chat.isGroup) {
            console.log('📤 Reenviando mensaje...');
            const grupoDestinoId = '120363408965534037'; // Reemplaza con el ID real del grupo destino
            await message.forward(grupoDestinoId); // Reenviar el mensaje al grupo destino
        }
    }
});
+
client.initialize();
