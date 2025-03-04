const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');  
const path = require('path');

const sessionPath = path.join(__dirname, '.wwebjs_auth', 'session');

function clearSession() {
    if (fs.existsSync(sessionPath)) {
        console.log("Eliminando sesión para evitar errores...");
        try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log("Sesión eliminada correctamente.");
        } catch (error) {
            console.error("Error eliminando la sesión, intentando con un retraso...");
            setTimeout(() => {
                try {
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                    console.log("Sesión eliminada en el segundo intento.");
                } catch (finalError) {
                    console.error("No se pudo eliminar la sesión después de varios intentos:", finalError);
                }
            }, 3000);
        }
    }
}

clearSession();

const client = new Client({
    authStrategy: new LocalAuth()
});

let keywordsIt = new Set();
let keywordsMan = new Set();
let keywordsAma = new Set();
let confirmationKeywords = [];

const groupBotDestinoId = '120363408965534037@g.us';  
const groupMantenimientoId = '120363393791264206@g.us';  
const groupAmaId = '120363409776076000@g.us'; 
const groupPrincipalId = '120363389868056953@g.us';

function loadKeywords() {
    try {
        const dataIt = fs.readFileSync('keywords_it.txt', 'utf8');
        keywordsIt = new Set(dataIt.split('\n').map(word => word.trim().toLowerCase()).filter(word => word));

        const dataMan = fs.readFileSync('keywords_man.txt', 'utf8');
        keywordsMan = new Set(dataMan.split('\n').map(word => word.trim().toLowerCase()).filter(word => word));

        const dataAma = fs.readFileSync('keywords_ama.txt', 'utf8');
        keywordsAma = new Set(dataAma.split('\n').map(word => word.trim().toLowerCase()).filter(word => word));

        const confirmData = fs.readFileSync('keywords_confirm.txt', 'utf8');
        confirmationKeywords = confirmData.split('\n').map(phrase => phrase.trim().toLowerCase()).filter(phrase => phrase);
    } catch (err) {
        console.error('Error al leer los archivos de palabras clave:', err);
    }
}

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('Bot de WhatsApp conectado y listo.');
    loadKeywords();
});

async function forwardMessage(targetGroupId, category, message, chat) {
    try {
        const targetChat = await client.getChatById(targetGroupId);
        await targetChat.sendMessage(`Nueva tarea recibida en *${category}*:\n\n${message.body}`);
        await chat.sendMessage(`Mensaje enviado a *${category}*.`);
    } catch (error) {
        console.error(`Error al reenviar mensaje a ${category}:`, error);
    }
}

client.on('message', async message => {
    const chat = await message.getChat();
    if (!chat.id._serialized.endsWith('@g.us')) return;

    const cleanedMessage = message.body.toLowerCase().replace(/[^a-z0-9áéíóúüñ\s]/gi, '').trim();
    const wordsSet = new Set(cleanedMessage.split(/\s+/));

    const foundIT = [...keywordsIt].some(word => wordsSet.has(word));
    const foundMan = [...keywordsMan].some(word => wordsSet.has(word));
    const foundAma = [...keywordsAma].some(word => wordsSet.has(word));
    const isConfirmation = confirmationKeywords.some(keyword => wordsSet.has(keyword));

    if (foundIT) await forwardMessage(groupBotDestinoId, "IT", message, chat);
    if (foundMan) await forwardMessage(groupMantenimientoId, "Mantenimiento", message, chat);
    if (foundAma) await forwardMessage(groupAmaId, "Ama de llaves", message, chat);

    if (isConfirmation && [groupBotDestinoId, groupMantenimientoId, groupAmaId].includes(chat.id._serialized)) {
        console.log("Confirmación detectada, enviando al grupo principal...");
        try {
            const groupChat = await client.getChatById(groupPrincipalId);
            await groupChat.sendMessage(`La tarea:\n\n${message.body}\n\nHa sido completada.`);
        } catch (error) {
            console.error("Error al enviar mensaje de confirmación:", error);
        }
    }
});

client.initialize();


//Reinicio bien