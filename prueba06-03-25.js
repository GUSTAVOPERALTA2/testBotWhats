const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const client = new Client({
    authStrategy: new LocalAuth()
});

let keywordsIt = new Set();
let keywordsMan = new Set();
let keywordsAma = new Set();
let confirmationKeywords = [];
let keywordsLoaded = false; // Evita recarga innecesaria

function loadKeywords() {
    if (keywordsLoaded) return; // Si ya están cargadas, no recargar
    try {
        const dataIt = fs.readFileSync('keywords_it.txt', 'utf8');
        keywordsIt = new Set(dataIt.split('\n').map(word => word.trim().toLowerCase()).filter(word => word));

        const dataMan = fs.readFileSync('keywords_man.txt', 'utf8');
        keywordsMan = new Set(dataMan.split('\n').map(word => word.trim().toLowerCase()).filter(word => word));

        const dataAma = fs.readFileSync('keywords_ama.txt', 'utf8');
        keywordsAma = new Set(dataAma.split('\n').map(word => word.trim().toLowerCase()).filter(word => word));

        const confirmData = fs.readFileSync('keywords_confirm.txt', 'utf8');
        confirmationKeywords = confirmData.split('\n').map(phrase => phrase.trim().toLowerCase()).filter(phrase => phrase);

        console.log('Palabras clave cargadas correctamente.');
        keywordsLoaded = true; // Marcar como cargadas
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
});

client.on('disconnected', async (reason) => {
    console.log(`Bot desconectado: ${reason}`);

    try {
        await client.destroy();
        console.log('Sesión cerrada correctamente tras desconexión.');
    } catch (error) {
        console.error('Error al intentar cerrar la sesión tras desconexión:', error);
    }

    // Intentar eliminar manualmente la carpeta de sesión si persiste el error
    const sessionPath = path.join(__dirname, '.wwebjs_auth/session');
    try {
        fs.rmdirSync(sessionPath, { recursive: true }); // Eliminar la carpeta completa
        console.log('Carpeta de sesión eliminada.');
    } catch (err) {
        console.error('No se pudo eliminar la carpeta de sesión:', err);
    }

    console.log('Vuelve a iniciar el bot para escanear el código QR.');
    process.exit(1);
});

process.on('SIGINT', async () => {
    console.log('Deteniendo el bot de WhatsApp...');
    if (client) {
        try {
            await client.destroy();
            console.log('Sesión de WhatsApp cerrada correctamente.');
        } catch (error) {
            console.error('Error al cerrar la sesión de WhatsApp:', error);
        }
    }
    process.exit(0);
});

client.initialize();
