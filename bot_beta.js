const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: false } // Esto muestra la ventana del navegador si es necesario
});

client.on('qr', qr => {
    console.log('Escanea este QR con WhatsApp:', qr);
});

client.on('ready', () => {
    console.log('✅ Bot de WhatsApp conectado y listo.');
});

client.initialize();
