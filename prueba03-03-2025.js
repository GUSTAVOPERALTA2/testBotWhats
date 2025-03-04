const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');  
const path = require('path');
const { exec } = require('child_process');

// Ruta del directorio de la sesión
const sessionPath = path.join(__dirname, '.wwebjs_auth', 'session');

// Función para eliminar la sesión de manera segura
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
            }, 3000); // Espera 3 segundos antes de intentar nuevamente
        }
    }
}

// Eliminar sesión al iniciar para evitar conflictos
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

        const confirmData = fs.readFileSync('keywords_confirm.txt', 'utf8');
        confirmationKeywords = confirmData.split('\n').map(phrase => phrase.trim().toLowerCase()).filter(phrase => phrase);
        console.log('Frases de confirmación cargadas:', confirmationKeywords);
        
    } catch (err) {
        console.error('Error al leer los archivos de palabras clave:', err);
    }
}

client.on('qr', qr => {
    console.log('Escanea este QR con WhatsApp Web para iniciar sesión:');
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
        console.log(`Mensaje reenviado a ${category}: ${message.body}`);
        await chat.sendMessage(`Mensaje enviado a *${category}*.`);
    } catch (error) {
        console.error(`Error al reenviar mensaje a ${category}:`, error);
    }
}

client.on('message', async message => {
    console.log(`Mensaje recibido: "${message.body}" de ${message.from}`);
    
    const chat = await message.getChat();
    if (!chat.id._serialized.endsWith('@g.us')) return;

    const cleanedMessage = message.body.toLowerCase().replace(/[^a-z0-9áéíóúüñ\s]/gi, '').trim();
    const wordsSet = new Set(cleanedMessage.split(/\s+/));
    console.log("Palabras detectadas en el mensaje:", wordsSet);

    const foundIT = [...keywordsIt].some(word => wordsSet.has(word));
    const foundMan = [...keywordsMan].some(word => wordsSet.has(word));
    const foundAma = [...keywordsAma].some(word => wordsSet.has(word));

    if (foundIT) {
        console.log("Detectada palabra clave en IT, enviando mensaje...");
        await forwardMessage(groupBotDestinoId, "IT", message, chat);
    }
    if (foundMan) {
        console.log("Detectada palabra clave en Mantenimiento, enviando mensaje...");
        await forwardMessage(groupMantenimientoId, "Mantenimiento", message, chat);
    }
    if (foundAma) {
        console.log("Detectada palabra clave en Ama de llaves, enviando mensaje...");
        await forwardMessage(groupAmaId, "Ama de llaves", message, chat);
    }
});

client.on('disconnected', async () => {
    console.log("Sesión cerrada. Eliminando sesión y reiniciando bot...");
    clearSession();
    setTimeout(() => {
        console.log("Reiniciando bot...");
        exec("node bot_beta.js", (error, stdout, stderr) => {
            if (error) {
                console.error("Error al reiniciar el bot:", error);
                return;
            }
            console.log(stdout);
            console.error(stderr);
        });
    }, 5000); 
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log("Cierre manual detectado. Eliminando sesión antes de salir...");
    clearSession();
    process.exit(0);
});

client.initialize();

//Cierre y reenvio 2