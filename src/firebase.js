import admin from 'firebase-admin';

function initFirebase() {
    try {
        // Intentar desde variable de entorno (Render)
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        if (!admin.apps || admin.apps.length === 0) {
            admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
            });
        }
        console.log('Firebase inicializado desde variable de entorno');
        return admin;
        }
        
        console.warn('No hay credenciales de Firebase. Las notificaciones NO funcionarán.');
        return null;
    } catch (error) {
        console.error('Error al inicializar Firebase:', error.message);
        return null;
    }
}

const firebaseAdmin = initFirebase();
export default firebaseAdmin;