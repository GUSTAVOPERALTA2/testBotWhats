const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    console.log('?? Escanea este QR con WhatsApp Web:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('? Bot de WhatsApp conectado y listo.');
});

client.on('message', async message => {
    console.log(`?? Mensaje recibido: ${message.body}`);

    // Palabras clave para reenviar
    const keywords = ["TV", "controles", "luces"];

    if (keywords.some(word => message.body.toLowerCase().includes(word.toLowerCase()))) {
        const chat = await message.getChat();
        if (chat.isGroup) {
            console.log('?? Reenviando mensaje...');
            await message.forward('GRUPO_DESTINO_ID'); // Reemplaza con el ID real del grupo destino
        }
    }
});

client.initialize();
