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
        console.error('[ERROR] getTokenByUsuario:', error.message);
        return null;
    }
};

// ===== OBTENER TOKENS DE TODOS LOS ADMINS =====
export const getTokensAdmins = async (conmysql) => {
    try {
        const [result] = await conmysql.query(
            'SELECT fcm_token FROM usuarios WHERE rol = "ADMIN" AND fcm_token IS NOT NULL AND fcm_token != ""'
        );
        return result.map(row => row.fcm_token);
    } catch (error) {
        console.error('[ERROR] getTokensAdmins:', error.message);
        return [];
    }
};

// ===== ENVIAR NOTIFICACIÓN A TODOS LOS ADMINS =====
export const notificarAdmins = async (conmysql, title, body, data = {}) => {
    const tokens = await getTokensAdmins(conmysql);
    if (tokens.length === 0) {
        console.log('[FCM] No hay admins con token');
        return;
    }
    for (const token of tokens) {
        await enviarNotificacion(token, title, body, data);
    }
    console.log(`[FCM] Notificacion enviada a ${tokens.length} admin(s)`);
};

// ============================================================
// 1. NUEVA ORDEN
// ============================================================
export const notificarNuevaOrden = async (conmysql, orden, cliente, tecnicoId, tecnicoNombre) => {
    const data = { tipo: 'orden', id_orden: String(orden.id_orden) };
    
    const tokenTecnico = await getTokenByUsuario(conmysql, tecnicoId);
    if (tokenTecnico) {
        const titleTecnico = '📋 Nueva orden asignada';
        const bodyTecnico = `Orden ${orden.codigo_orden} - Cliente: ${cliente}`;
        await enviarNotificacion(tokenTecnico, titleTecnico, bodyTecnico, data);
        console.log(`[FCM] Nueva orden enviada al tecnico ${tecnicoId}`);
    }
    
    const titleAdmin = `📋 Nueva orden creada`;
    const bodyAdmin = `Orden ${orden.codigo_orden} - Cliente: ${cliente} - Equipo: ${orden.tipo_equipo}`;
    await notificarAdmins(conmysql, titleAdmin, bodyAdmin, data);
};

// ============================================================
// 2. CAMBIO DE ESTADO
// ============================================================
export const notificarCambioEstado = async (conmysql, orden, cliente, nuevoEstado, tecnicoId, tecnicoNombre) => {
    const data = { tipo: 'orden', id_orden: String(orden.id_orden) };
    
    const tokenTecnico = await getTokenByUsuario(conmysql, tecnicoId);
    if (tokenTecnico) {
        const titleTecnico = '📌 Orden actualizada';
        const bodyTecnico = `Orden ${orden.codigo_orden} cambió a "${nuevoEstado}"`;
        await enviarNotificacion(tokenTecnico, titleTecnico, bodyTecnico, data);
        console.log(`[FCM] Cambio estado enviado al tecnico ${tecnicoId}`);
    }
    
    const titleAdmin = `📌 Orden ${orden.codigo_orden} cambió a "${nuevoEstado}"`;
    const bodyAdmin = `Cliente: ${cliente}`;
    await notificarAdmins(conmysql, titleAdmin, bodyAdmin, data);
};

// ============================================================
// 3. ASIGNACIÓN DE TÉCNICO
// ============================================================
export const notificarAsignacionTecnico = async (conmysql, orden, cliente, nuevoTecnicoId, nuevoTecnicoNombre, tecnicoAnteriorNombre) => {
    const data = { tipo: 'orden', id_orden: String(orden.id_orden) };
    
    // Al nuevo técnico
    const tokenTecnico = await getTokenByUsuario(conmysql, nuevoTecnicoId);
    if (tokenTecnico) {
        const titleTecnico = '👤 Nueva asignación';
        const bodyTecnico = `Orden ${orden.codigo_orden} - Cliente: ${cliente}`;
        await enviarNotificacion(tokenTecnico, titleTecnico, bodyTecnico, data);
        console.log(`[FCM] Asignacion enviada al tecnico ${nuevoTecnicoId}`);
    }
    
    // A todos los admins
    const titleAdmin = `👤 Técnico reasignado en orden ${orden.codigo_orden}`;
    const bodyAdmin = `Cliente: ${cliente}`;
    await notificarAdmins(conmysql, titleAdmin, bodyAdmin, data);
};

// ============================================================
// 4. REPUESTO AGREGADO A ORDEN
// ============================================================
export const notificarRepuestoAgregado = async (conmysql, orden, repuestoNombre, cantidad, tecnicoNombre) => {
    const title = `🔧 Repuesto agregado a orden ${orden.codigo_orden}`;
    const body = `Técnico ${tecnicoNombre} agregó "${repuestoNombre}" x${cantidad}`;
    const data = { tipo: 'orden', id_orden: String(orden.id_orden) };
    await notificarAdmins(conmysql, title, body, data);
};

// ============================================================
// 5. SERVICIO AGREGADO A ORDEN
// ============================================================
export const notificarServicioAgregado = async (conmysql, orden, servicioNombre, tecnicoNombre) => {
    const title = `🛠️ Servicio agregado a orden ${orden.codigo_orden}`;
    const body = `Técnico ${tecnicoNombre} agregó servicio "${servicioNombre}"`;
    const data = { tipo: 'orden', id_orden: String(orden.id_orden) };
    await notificarAdmins(conmysql, title, body, data);
};

// ============================================================
// 6. NUEVO ABONO
// ============================================================
export const notificarNuevoAbono = async (conmysql, orden, monto, cliente, tecnicoNombre) => {
    const title = `💰 Nuevo abono en orden ${orden.codigo_orden}`;
    const body = `Técnico ${tecnicoNombre} registró abono de $${monto} - Cliente: ${cliente}`;
    const data = { tipo: 'orden', id_orden: String(orden.id_orden) };
    await notificarAdmins(conmysql, title, body, data);
};

// ============================================================
// 7. FACTURA GENERADA
// ============================================================
export const notificarFacturaGenerada = async (conmysql, orden, total, cliente, numeroFactura, tecnicoNombre) => {
    const title = `🧾 Factura generada para orden ${orden.codigo_orden}`;
    const body = `Técnico ${tecnicoNombre} - Factura: ${numeroFactura} - Total: $${total} - Cliente: ${cliente}`;
    const data = { tipo: 'factura', id_orden: String(orden.id_orden) };
    await notificarAdmins(conmysql, title, body, data);
};

// ============================================================
// 8. STOCK BAJO (SOLICITUD DE REPUESTO)
// ============================================================
export const notificarStockBajo = async (conmysql, repuesto, stock, tecnicoNombre) => {
    const title = `⚠️ Solicitud de repuesto: "${repuesto.nombre}"`;
    const body = `Técnico ${tecnicoNombre} solicita stock - Actual: ${stock} unidades`;
    const data = { tipo: 'stock_bajo', id_repuesto: String(repuesto.id_repuesto || 0) };
    await notificarAdmins(conmysql, title, body, data);
};

// ============================================================
// 9. NUEVO CLIENTE REGISTRADO
// ============================================================
export const notificarNuevoCliente = async (conmysql, cliente, usuarioNombre) => {
    const title = `👤 Nuevo cliente registrado`;
    const body = `${usuarioNombre} registró a "${cliente.nombre_completo}" - Cédula: ${cliente.cedula}`;
    const data = { tipo: 'cliente' };
    await notificarAdmins(conmysql, title, body, data);
};

// ============================================================
// 10. CLIENTE EDITADO
// ============================================================
export const notificarClienteEditado = async (conmysql, cliente, usuarioNombre) => {
    const title = `✏️ Cliente editado`;
    const body = `${usuarioNombre} editó a "${cliente.nombre_completo}" - Cédula: ${cliente.cedula}`;
    const data = { tipo: 'cliente' };
    await notificarAdmins(conmysql, title, body, data);
};

// ============================================================
// 11. NUEVO EQUIPO REGISTRADO
// ============================================================
export const notificarNuevoEquipo = async (conmysql, equipo, clienteNombre, usuarioNombre) => {
    const title = `💻 Nuevo equipo registrado`;
    const body = `${usuarioNombre} agregó equipo "${equipo.tipo_equipo}" - ${equipo.marca} ${equipo.modelo} - Cliente: ${clienteNombre}`;
    const data = { tipo: 'equipo' };
    await notificarAdmins(conmysql, title, body, data);
};

// ============================================================
// 12. EQUIPO EDITADO
// ============================================================
export const notificarEquipoEditado = async (conmysql, equipo, clienteNombre, usuarioNombre) => {
    const title = `✏️ Equipo editado`;
    const body = `${usuarioNombre} editó equipo "${equipo.tipo_equipo}" - ${equipo.marca} ${equipo.modelo} - Cliente: ${clienteNombre}`;
    const data = { tipo: 'equipo' };
    await notificarAdmins(conmysql, title, body, data);
};

// ============================================================
// 13. NUEVO REPUESTO EN INVENTARIO
// ============================================================
export const notificarNuevoRepuesto = async (conmysql, repuesto, usuarioNombre) => {
    const title = `📦 Nuevo repuesto en inventario`;
    const body = `${usuarioNombre} agregó "${repuesto.nombre}" - Stock: ${repuesto.cantidad_stock} - Precio: $${repuesto.precio_unitario}`;
    const data = { tipo: 'inventario' };
    await notificarAdmins(conmysql, title, body, data);
};

// ============================================================
// 14. REPUESTO EDITADO EN INVENTARIO
// ============================================================
export const notificarRepuestoEditado = async (conmysql, repuesto, usuarioNombre) => {
    const title = `✏️ Repuesto editado en inventario`;
    const body = `${usuarioNombre} editó "${repuesto.nombre}" - Stock: ${repuesto.cantidad_stock} - Precio: $${repuesto.precio_unitario}`;
    const data = { tipo: 'inventario' };
    await notificarAdmins(conmysql, title, body, data);
};

// ============================================================
// 15. SOLICITUD DE REPUESTO (Técnico → Admin)
// ============================================================
export const notificarSolicitudRepuesto = async (conmysql, solicitud, tecnicoNombre) => {
    const title = `📦 Solicitud de repuesto: "${solicitud.nombre}"`;
    const body = `Un técnico solicita repuesto - Categoría: ${solicitud.categoria_sugerida || 'Sin categoría'}`;
    const data = { tipo: 'solicitud_repuesto', id_solicitud: String(solicitud.id_solicitud) };
    await notificarAdmins(conmysql, title, body, data);
};

// ============================================================
// 16. SOLICITUD DE SERVICIO (Técnico → Admin)
// ============================================================
export const notificarSolicitudServicio = async (conmysql, solicitud, tecnicoNombre) => {
    const title = `🛠️ Solicitud de servicio: "${solicitud.nombre}"`;
    const body = `Un técnico solicita nuevo servicio`;
    const data = { tipo: 'solicitud_servicio', id_solicitud: String(solicitud.id_solicitud) };
    await notificarAdmins(conmysql, title, body, data);
};

// ============================================================
// 17. SOLICITUD DE TIPO DE EQUIPO (Técnico → Admin)
// ============================================================
export const notificarSolicitudTipoEquipo = async (conmysql, solicitud, tecnicoNombre) => {
    const title = `📋 Solicitud de tipo de equipo: "${solicitud.nombre}"`;
    const body = `Un técnico solicita nuevo tipo de equipo`;
    const data = { tipo: 'solicitud_tipo_equipo', id_solicitud: String(solicitud.id_solicitud) };
    await notificarAdmins(conmysql, title, body, data);
};

// ============================================================
// 18. NUEVO USUARIO REGISTRADO
// ============================================================
export const notificarNuevoUsuario = async (conmysql, usuario, adminNombre) => {
    const title = `👤 Nuevo usuario registrado`;
    const body = `${adminNombre} registró a "${usuario.nombre}" como ${usuario.rol}`;
    const data = { tipo: 'usuario' };
    await notificarAdmins(conmysql, title, body, data);
};