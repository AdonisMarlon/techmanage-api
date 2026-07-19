import admin from '../firebase.js';

// ===== ENVIAR NOTIFICACIÓN A UN DISPOSITIVO =====
export const enviarNotificacion = async (fcmToken, title, body, data = {}) => {
    if (!admin) {
        console.log('[FCM] Firebase no disponible');
        return null;
    }

    if (!fcmToken) {
        console.log('[FCM] Token no disponible');
        return null;
    }

    const message = {
        notification: { title, body },
        data: data,
        token: fcmToken,
        android: { priority: 'high', notification: { sound: 'default' } }
    };

    try {
        const response = await admin.messaging().send(message);
        console.log('[FCM] Notificacion enviada correctamente');
        return response;
    } catch (error) {
        console.error('[FCM] Error al enviar:', error.message);
        throw error;
    }
};

    // ===== OBTENER TOKEN DE UN USUARIO ESPECÍFICO =====
    export const getTokenByUsuario = async (conmysql, idUsuario) => {
    try {
        const [result] = await conmysql.query(
        'SELECT fcm_token FROM usuarios WHERE id_usuario = ? AND fcm_token IS NOT NULL AND fcm_token != ""',
        [idUsuario]
        );
        return result.length > 0 ? result[0].fcm_token : null;
    } catch (error) {
        console.error('Error al obtener token:', error);
        return null;
    }
    };

    // ===== NOTIFICACIONES PRE-DEFINIDAS =====

    // 1. Nueva Orden
export const notificarNuevaOrden = async (conmysql, orden, cliente, tecnicoId) => {
    const title = 'Nueva orden de trabajo';
    const body = `Orden ${orden.codigo_orden} - Cliente: ${cliente}`;
    const data = { tipo: 'orden', id_orden: String(orden.id_orden) };
    
    const token = await getTokenByUsuario(conmysql, tecnicoId);
    if (token) {
        await enviarNotificacion(token, title, body, data);
        console.log(`[FCM] Notificacion enviada al tecnico ${tecnicoId}`);
        return;
    }
    console.log(`[FCM] Sin token para tecnico ${tecnicoId}`);
};

    // 2. Cambio de Estado
export const notificarCambioEstado = async (conmysql, orden, cliente, nuevoEstado, tecnicoId) => {
    const title = '📋 Orden actualizada';
    const body = `Orden ${orden.codigo_orden} cambió a "${nuevoEstado}"`;
    const data = { tipo: 'orden', id_orden: String(orden.id_orden) };
    
    const token = await getTokenByUsuario(conmysql, tecnicoId);
    if (token) {
        return await enviarNotificacion(token, title, body, data);
    }
    return null;
};

    // 3. Asignación de Técnico (al técnico Y al admin)
    export const notificarAsignacionTecnico = async (conmysql, orden, cliente, tecnicoId) => {
        const title = '👤 Nueva asignacion';
        const body = `Orden ${orden.codigo_orden} - Cliente: ${cliente}`;
        const data = { tipo: 'orden', id_orden: String(orden.id_orden) };
        
        // 1. Al técnico asignado
        const token = await getTokenByUsuario(conmysql, tecnicoId);
        if (token) {
            await enviarNotificacion(token, title, body, data);
            console.log(`[FCM] Asignacion enviada al tecnico ${tecnicoId}`);
        }
        
        // 2. A todos los admins
        const [admins] = await conmysql.query(
            'SELECT fcm_token FROM usuarios WHERE rol = "ADMIN" AND fcm_token IS NOT NULL AND fcm_token != ""'
        );
        const titleAdmin = `Nueva asignacion por ${tecnicoId}`;
        const bodyAdmin = `Orden ${orden.codigo_orden} - Cliente: ${cliente} - Asignado a tecnico ${tecnicoId}`;
        for (const admin of admins) {
            await enviarNotificacion(admin.fcm_token, titleAdmin, bodyAdmin, data);
            console.log(`[FCM] Asignacion enviada al admin`);
        }
    };

    // 4. Solicitud de Repuesto (stock bajo) - SOLO ADMIN
    export const notificarStockBajo = async (conmysql, repuesto, stock, tecnicoNombre, tecnicoId) => {
        const title = '📦 Solicitud de repuesto';
        const body = `Tecnico ${tecnicoNombre} solicita repuesto "${repuesto.nombre}" - Stock actual: ${stock}`;
        const data = { tipo: 'stock_bajo', id_repuesto: String(repuesto.id_repuesto || 0) };
        
        const [admins] = await conmysql.query(
            'SELECT fcm_token FROM usuarios WHERE rol = "ADMIN" AND fcm_token IS NOT NULL AND fcm_token != ""'
        );
        
        for (const admin of admins) {
            await enviarNotificacion(admin.fcm_token, title, body, data);
            console.log(`[FCM] Stock bajo enviado al admin`);
        }
    };

    // 5. Nuevo Abono - AL ADMIN
    export const notificarNuevoAbono = async (conmysql, orden, monto, cliente) => {
        const title = '💰 Nuevo abono registrado';
        const body = `Orden ${orden.codigo_orden} - Abono: $${monto} - Cliente: ${cliente}`;
        const data = { tipo: 'orden', id_orden: String(orden.id_orden) };
        
        const [admins] = await conmysql.query(
            'SELECT fcm_token FROM usuarios WHERE rol = "ADMIN" AND fcm_token IS NOT NULL AND fcm_token != ""'
        );
        
        for (const admin of admins) {
            await enviarNotificacion(admin.fcm_token, title, body, data);
            console.log(`[FCM] Abono enviado al admin`);
        }
    };

    // 6. Factura Generada - AL ADMIN
    export const notificarFacturaGenerada = async (conmysql, orden, total, cliente, numeroFactura) => {
        const title = '📄 Factura generada';
        const body = `Orden ${orden.codigo_orden} - Total: $${total} - Cliente: ${cliente} - Factura: ${numeroFactura}`;
        const data = { tipo: 'factura', id_orden: String(orden.id_orden) };
        
        const [admins] = await conmysql.query(
            'SELECT fcm_token FROM usuarios WHERE rol = "ADMIN" AND fcm_token IS NOT NULL AND fcm_token != ""'
        );
        
        for (const admin of admins) {
            await enviarNotificacion(admin.fcm_token, title, body, data);
            console.log(`[FCM] Factura enviada al admin`);
        }
    };