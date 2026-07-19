import admin from 'firebase-admin';

function initFirebase() {
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            if (!admin.apps || admin.apps.length === 0) {
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
            }
            console.log('[FCM] Firebase inicializado');
            return admin;
        }
        console.warn('[FCM] Sin credenciales de Firebase');
        return null;
    } catch (error) {
        console.error('[FCM] Error al inicializar:', error.message);
        return null;
    }
}

const firebaseAdmin = initFirebase();
export default firebaseAdmin;