const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');  

const client = new Client({
    authStrategy: new LocalAuth()
});

let keywordsIt = new Set();
let keywordsMan = new Set();
let keywordsAma = new Set();
let keywordsConfirm = new Set();

function loadKeywords() {
    try {
        const dataIt = fs.readFileSync('keywords_it.txt', 'utf8');
        keywordsIt = new Set(dataIt.split('\n').map(word => word.trim().toLowerCase()).filter(word => word));
        console.log('Palabras clave IT cargadas:', [...keywordsIt]);

        const dataMan = fs.readFileSync('keywords_man.txt', 'utf8');
        keywordsMan = new Set(dataMan.split('\n').map(word => word.trim().toLowerCase()).filter(word => word));
        console.log('Palabras clave Man cargadas:', [...keywordsMan]);

        const dataAma = fs.readFileSync('keywords_ama.txt', 'utf8');
        keywordsAma = new Set(dataAma.split('\n').map(word => word.trim().toLowerCase()).filter(word => word));
        console.log('Palabras clave Ama cargadas:', [...keywordsAma]);

        const dataConfirm = fs.readFileSync('keywords_confirm.txt', 'utf8');
        keywordsConfirm = new Set(dataConfirm.split('\n').map(word => word.trim().toLowerCase()).filter(word => word));
        console.log('Palabras clave de confirmación cargadas:', [...keywordsConfirm]);
    } catch (err) {
        console.error('Error al leer los archivos de palabras clave:', err);
    }
}

client.on('qr', qr => {
    console.log('Escanea este QR con WhatsApp Web:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('Bot de WhatsApp conectado y listo.');
    loadKeywords();

    const chats = await client.getChats();
    console.log(`Chats disponibles: ${chats.length}`);

    const groups = chats.filter(chat => chat.id._serialized.endsWith('@g.us'));
    console.log(`Grupos disponibles: ${groups.length}`);
    groups.forEach(group => {
        console.log(`Grupo: ${group.name} - ID: ${group.id._serialized}`);
    });

    // Enviar mensaje de bienvenida cuando el bot se inicia
    const groupITPruebaId = '120363389868056953@g.us';
    const groupChat = await client.getChatById(groupITPruebaId);
    await groupChat.sendMessage('VICEBOT CONECTADO 🤖\nBy: Gustavo Peralta');
});

client.on('message', async message => {
    console.log(`Mensaje recibido: "${message.body}"`);

    const groupITPruebaId = '120363389868056953@g.us';  
    const groupBotDestinoId = '120363408965534037@g.us';  
    const groupMantenimientoId = '120363393791264206@g.us';  
    const groupAmaId = '120363409776076000@g.us'; 

    const chat = await message.getChat();
    if (!chat.id._serialized.endsWith('@g.us')) return;

    // Primer bloque para manejar palabras clave
    const cleanedMessage = message.body.toLowerCase().replace(/[.,!?()]/g, '');
    if (!cleanedMessage.trim()) return;

    const words = cleanedMessage.split(/\s+/);

    let foundIT = false, foundMan = false, foundAma = false;
    for (let word of words) {
        if (keywordsIt.has(word)) foundIT = true;
        if (keywordsMan.has(word)) foundMan = true;
        if (keywordsAma.has(word)) foundAma = true;
    }

    let media = null;
    if (message.hasMedia && (foundIT || foundMan || foundAma)) {
        media = await message.downloadMedia();
    }

    async function forwardMessage(targetGroupId, category) {
        const targetChat = await client.getChatById(targetGroupId);
        await targetChat.sendMessage(`*${message.body}*`);
        if (media) await targetChat.sendMessage(media);
        console.log(`Mensaje reenviado a ${category}: ${message.body}`);
    }

    if (foundIT) await forwardMessage(groupBotDestinoId, "IT");
    if (foundMan) await forwardMessage(groupMantenimientoId, "Mantenimiento");
    if (foundAma) await forwardMessage(groupAmaId, "Ama");

    // Manejo de confirmaciones de tarea
    if (message.hasQuotedMsg) {
        const quotedMessage = await message.getQuotedMessage();
        if (quotedMessage.body.startsWith("*")) {
            const taskMessage = quotedMessage.body;
            if (keywordsConfirm.has(cleanedMessage)) {
                const confirmationMessage = `La tarea ${taskMessage} ha sido completada.`;
                await client.getChatById(groupITPruebaId).then(groupChat => {
                    groupChat.sendMessage(confirmationMessage);
                });
                console.log(`Confirmación recibida en ${chat.name}: ${taskMessage}`);
            }
        }
    }
});

// Manejo de salida del bot para asegurar que el mensaje de desconexión se envíe
async function sendDisconnectMessage() {
    try {
        const groupITPruebaId = '120363389868056953@g.us';
        const groupChat = await client.getChatById(groupITPruebaId);
        await groupChat.sendMessage('El servicio VICEBOT 🤖, está temporalmente desconectado, por favor avise a su equipo de TI');
        console.log('Mensaje de desconexión enviado.');
    } catch (err) {
        console.error('Error al enviar el mensaje de desconexión:', err);
    }
}

client.on('disconnected', async () => {
    console.log('VICEBOT se ha desconectado.');
    await sendDisconnectMessage();
});

process.on('SIGINT', async () => {
    console.log('Cierre detectado (Ctrl + C). Enviando mensaje de desconexión...');
    await sendDisconnectMessage();
    process.exit();
});

process.on('exit', async () => {
    console.log('Proceso finalizando. Enviando mensaje de desconexión...');
    await sendDisconnectMessage();
});

client.initialize();

//BOT IA 2