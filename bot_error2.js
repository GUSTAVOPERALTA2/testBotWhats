const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Ruta del directorio de sesión
const sessionPath = '/home/gustavo.peralta/whatsapp-bot/.wwebjs_auth/session/';

// Eliminar la carpeta de sesión si existe
function deleteSessionIfNeeded() {
    try {
        if (fs.existsSync(sessionPath)) {
            fs.rmdirSync(sessionPath, { recursive: true });
            console.log('Directorio de sesión eliminado para evitar errores de autenticación.');
        }
    } catch (err) {
        console.error('Error al eliminar la sesión:', err);
    }
}

deleteSessionIfNeeded();  // Llamada a la función antes de iniciar el bot

const client = new Client({
    authStrategy: new LocalAuth()
});

let keywordsIt = new Set();
let keywordsMan = new Set();
let keywordsAma = new Set();
let confirmationKeywords = [];

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

        // Cargar las palabras clave de confirmación desde el archivo
        const confirmData = fs.readFileSync('keywords_confirm.txt', 'utf8');
        confirmationKeywords = confirmData.split('\n').map(phrase => phrase.trim().toLowerCase()).filter(phrase => phrase);
        console.log('Frases de confirmación cargadas:', confirmationKeywords);

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

    // Mensaje inicial cuando el bot esté listo
    const chats = await client.getChats();
    const groups = chats.filter(chat => chat.id._serialized.endsWith('@g.us'));
    
    groups.forEach(group => {
        if (group.id._serialized === '120363389868056953@g.us') {
            client.getChatById(group.id._serialized).then(chat => {
                chat.sendMessage('VICEBOT🤖 en Línea');
            });
        }
    });

    console.log(`Grupos disponibles: ${groups.length}`);
    groups.forEach(group => {
        console.log(`Grupo: ${group.name} - ID: ${group.id._serialized}`);
    });
});

client.on('message', async message => {
    console.log(`Mensaje recibido: "${message.body}"`);

    const groupITPruebaId = '120363389868056953@g.us';
    const groupBotDestinoId = '120363408965534037@g.us';
    const groupMantenimientoId = '120363393791264206@g.us';
    const groupAmaId = '120363409776076000@g.us';
    const groupPruebaId = '120363389868056953@g.us'; // ID del grupo de Prueba

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
        const forwardedMessage = await targetChat.sendMessage(`Nueva tarea recibida: \n \n*${message.body}*`);
        if (media) await targetChat.sendMessage(media);
        console.log(`Mensaje reenviado a ${category}: ${message.body}`);

        // Confirmación del grupo donde se mandó el mensaje
        await client.getChatById(groupPruebaId).then(groupChat => {
            groupChat.sendMessage(`El mensaje se ha enviado al grupo *${category}*`);
        });
    }

    if (foundIT) await forwardMessage(groupBotDestinoId, "IT");
    if (foundMan) await forwardMessage(groupMantenimientoId, "Mantenimiento");
    if (foundAma) await forwardMessage(groupAmaId, "Ama");

    // Segundo bloque para manejar confirmación de tarea
    if (message.hasQuotedMsg) {
        const quotedMessage = await message.getQuotedMessage();
        if (quotedMessage.body.startsWith("Nueva tarea recibida: \n")) {
            // Eliminamos el prefijo "Nueva tarea recibida" y ponemos la tarea en negritas
            const taskMessage = quotedMessage.body.replace('Nueva tarea recibida: \n \n', '');
            const confirmationMessage = `La tarea: \n ${taskMessage} \n esta *COMPLETADA*.`; 

            // Lógica para verificar si la respuesta contiene las palabras clave de confirmación
            const responseMessage = message.body.toLowerCase();
            if (confirmationKeywords.some(keyword => responseMessage.includes(keyword))) {
                await chat.sendMessage(confirmationMessage);

                // Reenviar solo al grupo de prueba
                await client.getChatById(groupPruebaId).then(groupChat => {
                    groupChat.sendMessage(confirmationMessage);
                });

                console.log(`Confirmación recibida en ${chat.name}: ${taskMessage}`);
            } else {
                console.log(`Respuesta no válida en ${chat.name}: ${message.body}`);
            }
        }
    }
});

client.initialize();
//Mejoras implementadas