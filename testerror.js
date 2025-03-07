const { Client, RemoteAuth } = require('whatsapp-web.js');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Cargar credenciales de Firebase
const serviceAccount = require('./firebase_credentials.json');

// Inicializar Firebase
initializeApp({
    credential: cert(serviceAccount)
});
const db = getFirestore();

// Configuración del cliente de WhatsApp con RemoteAuth
const client = new Client({
    authStrategy: new RemoteAuth({
        clientId: 'vicebot-test', // Identificador único para la sesión
        firestore: db, // Firestore como almacenamiento de sesión
    }),
    puppeteer: {
        headless: true, // Para producción, debe ser true
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

// Eventos del cliente
client.on('qr', (qr) => {
    console.warn("[Auth] Escanea este QR en WhatsApp para iniciar sesión:");
    console.log(qr); // Puedes mostrarlo en consola o generar un código QR en una interfaz
});

client.on('ready', () => {
    console.log('[Auth] Bot de WhatsApp conectado y autenticado correctamente.');
});

client.on('disconnected', (reason) => {
    console.warn(`[Auth] Cliente desconectado: ${reason}`);
    if (reason === 'LOGOUT') {
        console.warn("[Auth] Cierre de sesión detectado. Escanea el QR nuevamente.");
    }
});

client.on('auth_failure', (message) => {
    console.error(`[Auth] Error de autenticación: ${message}`);
});

client.on('error', (error) => {
    console.error("[Auth] Error en el cliente:", error);
});

// Iniciar el cliente
client.initialize();


//Nuevo enfoque