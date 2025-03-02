const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const sessionPath = './.wwebjs_auth/session';

// Verifica si la sesión está corrupta y la elimina si es necesario
if (fs.existsSync(sessionPath)) {
    try {
        fs.accessSync(sessionPath, fs.constants.R_OK | fs.constants.W_OK);
    } catch (err) {
        console.log("Sesión corrupta detectada, eliminando...");
        fs.rmSync(sessionPath, { recursive: true, force: true });
    }
}

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
        console.log('Palabras clave Mantenimiento cargadas:', [...keywordsMan]);

        const dataAma = fs.readFileSync('keywords_ama.txt', 'utf8');
        keywordsAma = new Set(dataAma.split('\n').map(word => word.trim().toLowerCase()).filter(word => word));
        console.log('Palabras clave Ama de llaves cargadas:', [...keywordsAma]);

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
    console.log('VICEBOT CONECTADO 🤖\nBy: Gustavo Peralta');

    loadKeywords();
    const chats = await client.getChats();
    console.log(`Chats disponibles: ${chats.length}`);

    const groups = chats.filter(chat => chat.id._serialized.endsWith('@g.us'));
    console.log(`Grupos disponibles: ${groups.length}`);
    groups.forEach(group => {
        console.log(`Grupo: ${group.name} - ID: ${group.id._serialized}`);
    });

    // Envía el mensaje de conexión al grupo de prueba
    const groupITPruebaId = '120363389868056953@g.us';
    const pruebaChat = await client.getChatById(groupITPruebaId);
    await pruebaChat.sendMessage('VICEBOT CONECTADO 🤖\nBy: Gustavo Peralta');
});

client.on('message', async message => {
    console.log(`Mensaje recibido: "${message.body}"`);

    const groupITPruebaId = '120363389868056953@g.us';
    const groupBotDestinoId = '120363408965534037@g.us';
    const groupMantenimientoId = '120363393791264206@g.us';
    const groupAmaId = '120363409776076000@g.us';

    const chat = await message.getChat();
    if (!chat.id._serialized.endsWith('@g.us')) return;

    // Verificación de palabras clave
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
        const forwardedMessage = await targetChat.sendMessage(`*${message.body}*`);
        if (media) await targetChat.sendMessage(media);
        console.log(`Mensaje reenviado a ${category}: ${message.body}`);
    }

    if (foundIT) await forwardMessage(groupBotDestinoId, "IT");
    if (foundMan) await forwardMessage(groupMantenimientoId, "Mantenimiento");
    if (foundAma) await forwardMessage(groupAmaId, "Ama");

    // Manejo de confirmaciones
    if (message.hasQuotedMsg) {
        const quotedMessage = await message.getQuotedMessage();
        const taskMessage = quotedMessage.body.replace('*', '').trim();

        // Verifica si el mensaje pertenece a IT, Mantenimiento o Ama
        let isValidConfirmation = false;
        for (let word of words) {
            if (keywordsConfirm.has(word)) {
                isValidConfirmation = true;
                break;
            }
        }

        if (isValidConfirmation) {
            const confirmationMessage = `La tarea ${taskMessage} ha sido completada.`;

            // Enviar confirmación solo al grupo de prueba
            await client.getChatById(groupITPruebaId).then(groupChat => {
                groupChat.sendMessage(confirmationMessage);
            });

            console.log(`Confirmación recibida en ${chat.name}: ${taskMessage}`);
        }
    }
});

// Manejo de cierre limpio
process.on('SIGINT', async () => {
    console.log("Cerrando sesión y limpiando...");
    await client.destroy();
    process.exit(0);
});

// Manejo de desconexión
client.on('disconnected', async () => {
    console.log("El servicio VICEBOT 🤖 está temporalmente desconectado, por favor avise a su equipo de TI.");

    try {
        const groupITPruebaId = '120363389868056953@g.us';
        const pruebaChat = await client.getChatById(groupITPruebaId);
        await pruebaChat.sendMessage('El servicio VICEBOT 🤖 está temporalmente desconectado, por favor avise a su equipo de TI.');
    } catch (error) {
        console.error("Error al enviar mensaje de desconexión:", error);
    }
});

client.initialize();
//Error de sesion