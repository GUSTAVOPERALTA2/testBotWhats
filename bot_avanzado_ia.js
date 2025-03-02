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

        const dataMan = fs.readFileSync('keywords_man.txt', 'utf8');
        keywordsMan = new Set(dataMan.split('\n').map(word => word.trim().toLowerCase()).filter(word => word));

        const dataAma = fs.readFileSync('keywords_ama.txt', 'utf8');
        keywordsAma = new Set(dataAma.split('\n').map(word => word.trim().toLowerCase()).filter(word => word));

        const dataConfirm = fs.readFileSync('keywords_confirm.txt', 'utf8');
        keywordsConfirm = new Set(dataConfirm.split('\n').map(word => word.trim().toLowerCase()).filter(word => word));

        console.log('Palabras clave cargadas correctamente.');
    } catch (err) {
        console.error('Error al leer los archivos de palabras clave:', err);
    }
}

// Enviar QR para escanear
client.on('qr', qr => {
    console.log('Escanea este QR con WhatsApp Web:');
    qrcode.generate(qr, { small: true });
});

// Cuando el bot esté listo
client.on('ready', async () => {
    console.log('VICEBOT CONECTADO 🤖\nBy: Gustavo Peralta');
    loadKeywords();

    try {
        const groupITPruebaId = '120363389868056953@g.us';
        const pruebaChat = await client.getChatById(groupITPruebaId);
        await pruebaChat.sendMessage('VICEBOT CONECTADO 🤖\nBy: Gustavo Peralta');
    } catch (error) {
        console.error("No se pudo obtener el chat de prueba. Puede que la sesión no esté activa aún.", error);
    }
});

// Mapeo de grupos
const groupIds = {
    it: '120363408965534037@g.us',
    mantenimiento: '120363393791264206@g.us',
    ama: '120363409776076000@g.us',
    prueba: '120363389868056953@g.us'
};

client.on('message', async message => {
    console.log(`Mensaje recibido: "${message.body}"`);

    const chat = await message.getChat();
    if (!chat.isGroup) return;

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
        try {
            const targetChat = await client.getChatById(targetGroupId);
            const forwardedMessage = await targetChat.sendMessage(`*${message.body}*`);
            if (media) await targetChat.sendMessage(media);
            console.log(`Mensaje reenviado a ${category}: ${message.body}`);
        } catch (error) {
            console.error(`Error al reenviar mensaje a ${category}:`, error);
        }
    }

    if (foundIT) await forwardMessage(groupIds.it, "IT");
    if (foundMan) await forwardMessage(groupIds.mantenimiento, "Mantenimiento");
    if (foundAma) await forwardMessage(groupIds.ama, "Ama de llaves");

    // Confirmación de tareas
    if (message.hasQuotedMsg) {
        const quotedMessage = await message.getQuotedMessage();

        if (quotedMessage.body.startsWith("*") && quotedMessage.fromMe) {
            const taskMessage = quotedMessage.body;
            const confirmationMessage = `La tarea ${taskMessage} ha sido completada.`;

            // Verificar si la confirmación contiene una palabra válida
            let confirmationValid = false;
            for (let word of words) {
                if (keywordsConfirm.has(word)) {
                    confirmationValid = true;
                    break;
                }
            }

            if (confirmationValid) {
                let targetGroupId = null;
                if (chat.id._serialized === groupIds.it) {
                    targetGroupId = groupIds.prueba;
                } else if (chat.id._serialized === groupIds.mantenimiento) {
                    targetGroupId = groupIds.prueba;
                } else if (chat.id._serialized === groupIds.ama) {
                    targetGroupId = groupIds.prueba;
                }

                if (targetGroupId) {
                    try {
                        const targetChat = await client.getChatById(targetGroupId);
                        await targetChat.sendMessage(confirmationMessage);
                        console.log(`Confirmación enviada a Prueba: ${confirmationMessage}`);
                    } catch (error) {
                        console.error("Error al enviar la confirmación de tarea:", error);
                    }
                }
            }
        }
    }
});

// Manejo de desconexión
client.on('disconnected', async (reason) => {
    console.log("El servicio VICEBOT 🤖 está temporalmente desconectado. Razón:", reason);

    try {
        const pruebaChat = await client.getChatById(groupIds.prueba);
        await pruebaChat.sendMessage('El servicio VICEBOT 🤖 está temporalmente desconectado, por favor avise a su equipo de TI.');
    } catch (error) {
        console.error("Error al enviar mensaje de desconexión, probablemente la sesión ya no esté activa.", error);
    }
});

// Manejo de cierre limpio con Ctrl+C
process.on('SIGINT', async () => {
    console.log("Cerrando sesión y limpiando...");
    await client.destroy();
    process.exit(0);
});

client.initialize();
//Error de sesion2