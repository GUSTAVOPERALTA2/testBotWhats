const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Cargar credenciales
const serviceAccount = require('./firebase_credentials.json');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Verificar si la colección `wwebjs_sessions` existe
async function checkFirestore() {
    const snapshot = await db.collection('wwebjs_sessions').get();
    if (snapshot.empty) {
        console.log("Firestore está vacío. No hay sesiones guardadas.");
    } else {
        console.log("Firestore tiene sesiones guardadas:");
        snapshot.forEach(doc => {
            console.log(doc.id, "=>", doc.data());
        });
    }
}

checkFirestore();
