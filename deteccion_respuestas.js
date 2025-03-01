const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Inicializa el cliente de WhatsApp Web
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
});

// Escanea el código QR para iniciar sesión
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

// Confirma cuando el bot está listo
client.on('ready', () => {
    console.log('¡Bot conectado y listo para usar!');
});

// Almacena los mensajes enviados por el bot con su ID
const mensajesEnviados = {};

// Evento cuando se envía un mensaje
client.on('message_create', msg => {
    if (msg.fromMe) {
        mensajesEnviados[msg.id.id] = msg.body; // Guarda el mensaje enviado por el bot
    }
});

// Evento para detectar mensajes entrantes
client.on('message', async msg => {
    console.log(`Mensaje recibido de ${msg.from}: ${msg.body}`);

    // Si el mensaje es un comando, el bot responde
    if (msg.body.toLowerCase() === '!test') {
        const mensajeBot = await msg.reply(`Aquí está tu mensaje con ID: ${msg.id.id}`);
        mensajesEnviados[mensajeBot.id.id] = mensajeBot.body; // Guarda el mensaje enviado
    }

    // Verifica si el usuario respondió a un mensaje del bot
    if (msg.hasQuotedMsg) {
        const quotedMsg = await msg.getQuotedMessage();
        if (mensajesEnviados[quotedMsg.id.id]) {
            console.log(`El usuario respondió a un mensaje del bot: ${quotedMsg.body}`);
            msg.reply(`Recibí tu respuesta al mensaje: "${quotedMsg.body}"`);
        }
    }
});

// Inicia el cliente
client.initialize();
//RESPUESTAS