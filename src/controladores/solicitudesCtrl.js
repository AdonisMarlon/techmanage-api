import { conmysql } from '../db.js';
import { 
    notificarSolicitudRepuesto, 
    notificarSolicitudServicio, 
    notificarSolicitudTipoEquipo 
} from '../services/notification.service.js';

// ============================================================
// 1. CREAR SOLICITUD DE REPUESTO (Técnico)
// ============================================================
export const crearSolicitudRepuesto = async (req, res) => {
    try {
        const { nombre, descripcion, categoria_sugerida } = req.body;
        const id_tecnico = req.user.id;
        const tecnicoNombre = req.user?.nombre || 'Tecnico';

        if (!nombre || nombre.trim() === '') {
            return res.status(400).json({ error: 'El nombre del repuesto es obligatorio' });
        }

        const [result] = await conmysql.query(
            `INSERT INTO solicitudes_repuestos 
            (id_tecnico, nombre, descripcion, categoria_sugerida) 
            VALUES (?, ?, ?, ?)`,
            [id_tecnico, nombre.trim(), descripcion || '', categoria_sugerida || '']
        );

        // Enviar notificación al admin
        try {
            const solicitud = {
                id_solicitud: result.insertId,
                nombre: nombre.trim(),
                categoria_sugerida: categoria_sugerida || 'Sin categoría'
            };
            await notificarSolicitudRepuesto(conmysql, solicitud, tecnicoNombre);
            console.log('[FCM] Solicitud de repuesto enviada al admin');
        } catch (notifError) {
            console.error('[ERROR] notificarSolicitudRepuesto:', notifError.message);
        }

        res.status(201).json({
            mensaje: 'Solicitud de repuesto enviada al administrador',
            id_solicitud: result.insertId
        });
    } catch (error) {
        console.error('[ERROR] crearSolicitudRepuesto:', error.message);
        res.status(500).json({ error: 'Error al crear la solicitud' });
    }
};

// ============================================================
// 2. CREAR SOLICITUD DE SERVICIO (Técnico)
// ============================================================
export const crearSolicitudServicio = async (req, res) => {
    try {
        const { nombre, descripcion } = req.body;
        const id_tecnico = req.user.id;
        const tecnicoNombre = req.user?.nombre || 'Tecnico';

        if (!nombre || nombre.trim() === '') {
            return res.status(400).json({ error: 'El nombre del servicio es obligatorio' });
        }

        const [result] = await conmysql.query(
            `INSERT INTO solicitudes_servicios 
            (id_tecnico, nombre, descripcion) 
            VALUES (?, ?, ?)`,
            [id_tecnico, nombre.trim(), descripcion || '']
        );

        try {
            const solicitud = {
                id_solicitud: result.insertId,
                nombre: nombre.trim()
            };
            await notificarSolicitudServicio(conmysql, solicitud, tecnicoNombre);
            console.log('[FCM] Solicitud de servicio enviada al admin');
        } catch (notifError) {
            console.error('[ERROR] notificarSolicitudServicio:', notifError.message);
        }

        res.status(201).json({
            mensaje: 'Solicitud de servicio enviada al administrador',
            id_solicitud: result.insertId
        });
    } catch (error) {
        console.error('[ERROR] crearSolicitudServicio:', error.message);
        res.status(500).json({ error: 'Error al crear la solicitud' });
    }
};

// ============================================================
// 3. CREAR SOLICITUD DE TIPO DE EQUIPO (Técnico)
// ============================================================
export const crearSolicitudTipoEquipo = async (req, res) => {
    try {
        const { nombre, descripcion, icono_sugerido } = req.body;
        const id_tecnico = req.user.id;
        const tecnicoNombre = req.user?.nombre || 'Tecnico';

        if (!nombre || nombre.trim() === '') {
            return res.status(400).json({ error: 'El nombre del tipo de equipo es obligatorio' });
        }

        const [result] = await conmysql.query(
            `INSERT INTO solicitudes_tipos_equipo 
            (id_tecnico, nombre, descripcion, icono_sugerido) 
            VALUES (?, ?, ?, ?)`,
            [id_tecnico, nombre.trim(), descripcion || '', icono_sugerido || 'hardware-chip-outline']
        );

        try {
            const solicitud = {
                id_solicitud: result.insertId,
                nombre: nombre.trim()
            };
            await notificarSolicitudTipoEquipo(conmysql, solicitud, tecnicoNombre);
            console.log('[FCM] Solicitud de tipo de equipo enviada al admin');
        } catch (notifError) {
            console.error('[ERROR] notificarSolicitudTipoEquipo:', notifError.message);
        }

        res.status(201).json({
            mensaje: 'Solicitud de tipo de equipo enviada al administrador',
            id_solicitud: result.insertId
        });
    } catch (error) {
        console.error('[ERROR] crearSolicitudTipoEquipo:', error.message);
        res.status(500).json({ error: 'Error al crear la solicitud' });
    }
};

// ============================================================
// 4. OBTENER SOLICITUDES DE REPUESTOS (Admin)
// ============================================================
export const getSolicitudesRepuestos = async (req, res) => {
    try {
        const [result] = await conmysql.query(
            `SELECT sr.*, u.nombre as tecnico_nombre 
            FROM solicitudes_repuestos sr
            INNER JOIN usuarios u ON sr.id_tecnico = u.id_usuario
            WHERE sr.estado = 'pendiente'
            ORDER BY sr.fecha_solicitud DESC`
        );
        res.json(result);
    } catch (error) {
        console.error('[ERROR] getSolicitudesRepuestos:', error.message);
        res.status(500).json({ error: 'Error al obtener solicitudes' });
    }
};

// ============================================================
// 5. OBTENER SOLICITUDES DE SERVICIOS (Admin)
// ============================================================
export const getSolicitudesServicios = async (req, res) => {
    try {
        const [result] = await conmysql.query(
            `SELECT ss.*, u.nombre as tecnico_nombre 
            FROM solicitudes_servicios ss
            INNER JOIN usuarios u ON ss.id_tecnico = u.id_usuario
            WHERE ss.estado = 'pendiente'
            ORDER BY ss.fecha_solicitud DESC`
        );
        res.json(result);
    } catch (error) {
        console.error('[ERROR] getSolicitudesServicios:', error.message);
        res.status(500).json({ error: 'Error al obtener solicitudes' });
    }
};

// ============================================================
// 6. OBTENER SOLICITUDES DE TIPOS DE EQUIPO (Admin)
// ============================================================
export const getSolicitudesTiposEquipo = async (req, res) => {
    try {
        const [result] = await conmysql.query(
            `SELECT ste.*, u.nombre as tecnico_nombre 
            FROM solicitudes_tipos_equipo ste
            INNER JOIN usuarios u ON ste.id_tecnico = u.id_usuario
            WHERE ste.estado = 'pendiente'
            ORDER BY ste.fecha_solicitud DESC`
        );
        res.json(result);
    } catch (error) {
        console.error('[ERROR] getSolicitudesTiposEquipo:', error.message);
        res.status(500).json({ error: 'Error al obtener solicitudes' });
    }
};

// ============================================================
// 7. APROBAR SOLICITUD DE REPUESTO (Admin)
// ============================================================
export const aprobarSolicitudRepuesto = async (req, res) => {
    const conexion = await conmysql.getConnection();
    try {
        await conexion.beginTransaction();
        
        const { id } = req.params;
        const { id_categoria, nombre, descripcion, cantidad_stock, precio_unitario } = req.body;

        // Verificar que la solicitud existe y está pendiente
        const [solicitud] = await conexion.query(
            'SELECT * FROM solicitudes_repuestos WHERE id_solicitud = ? AND estado = "pendiente"',
            [id]
        );

        if (solicitud.length === 0) {
            return res.status(404).json({ error: 'Solicitud no encontrada o ya procesada' });
        }

        // Crear el repuesto en inventario
        const [result] = await conexion.query(
            `INSERT INTO inventario (id_categoria, nombre, descripcion, cantidad_stock, precio_unitario) 
            VALUES (?, ?, ?, ?, ?)`,
            [id_categoria, nombre, descripcion, cantidad_stock, precio_unitario]
        );

        // Marcar solicitud como aprobada
        await conexion.query(
            'UPDATE solicitudes_repuestos SET estado = "aprobada" WHERE id_solicitud = ?',
            [id]
        );

        await conexion.commit();

        res.status(201).json({
            mensaje: 'Repuesto creado y solicitud aprobada',
            id_repuesto: result.insertId
        });
    } catch (error) {
        await conexion.rollback();
        console.error('[ERROR] aprobarSolicitudRepuesto:', error.message);
        res.status(500).json({ error: 'Error al aprobar la solicitud' });
    } finally {
        conexion.release();
    }
};

// ============================================================
// 8. APROBAR SOLICITUD DE SERVICIO (Admin)
// ============================================================
export const aprobarSolicitudServicio = async (req, res) => {
    const conexion = await conmysql.getConnection();
    try {
        await conexion.beginTransaction();
        
        const { id } = req.params;
        const { nombre, descripcion, precio_base } = req.body;

        const [solicitud] = await conexion.query(
            'SELECT * FROM solicitudes_servicios WHERE id_solicitud = ? AND estado = "pendiente"',
            [id]
        );

        if (solicitud.length === 0) {
            return res.status(404).json({ error: 'Solicitud no encontrada o ya procesada' });
        }

        const [result] = await conexion.query(
            `INSERT INTO servicios (nombre, descripcion, precio_base) 
            VALUES (?, ?, ?)`,
            [nombre, descripcion, precio_base]
        );

        await conexion.query(
            'UPDATE solicitudes_servicios SET estado = "aprobada" WHERE id_solicitud = ?',
            [id]
        );

        await conexion.commit();

        res.status(201).json({
            mensaje: 'Servicio creado y solicitud aprobada',
            id_servicio: result.insertId
        });
    } catch (error) {
        await conexion.rollback();
        console.error('[ERROR] aprobarSolicitudServicio:', error.message);
        res.status(500).json({ error: 'Error al aprobar la solicitud' });
    } finally {
        conexion.release();
    }
};

// ============================================================
// 9. APROBAR SOLICITUD DE TIPO DE EQUIPO (Admin)
// ============================================================
export const aprobarSolicitudTipoEquipo = async (req, res) => {
    const conexion = await conmysql.getConnection();
    try {
        await conexion.beginTransaction();
        
        const { id } = req.params;
        const { nombre, descripcion, icono } = req.body;

        const [solicitud] = await conexion.query(
            'SELECT * FROM solicitudes_tipos_equipo WHERE id_solicitud = ? AND estado = "pendiente"',
            [id]
        );

        if (solicitud.length === 0) {
            return res.status(404).json({ error: 'Solicitud no encontrada o ya procesada' });
        }

        const [result] = await conexion.query(
            `INSERT INTO categorias_equipos (nombre, descripcion, icono) 
            VALUES (?, ?, ?)`,
            [nombre, descripcion || '', icono || 'hardware-chip-outline']
        );

        await conexion.query(
            'UPDATE solicitudes_tipos_equipo SET estado = "aprobada" WHERE id_solicitud = ?',
            [id]
        );

        await conexion.commit();

        res.status(201).json({
            mensaje: 'Tipo de equipo creado y solicitud aprobada',
            id_categoria_equipo: result.insertId
        });
    } catch (error) {
        await conexion.rollback();
        console.error('[ERROR] aprobarSolicitudTipoEquipo:', error.message);
        res.status(500).json({ error: 'Error al aprobar la solicitud' });
    } finally {
        conexion.release();
    }
};

// ============================================================
// 10. RECHAZAR SOLICITUD (Admin)
// ============================================================
export const rechazarSolicitud = async (req, res) => {
    try {
        const { id } = req.params;
        const { tabla } = req.query;

        let query = '';
        if (tabla === 'repuestos') {
            query = 'UPDATE solicitudes_repuestos SET estado = "rechazada" WHERE id_solicitud = ?';
        } else if (tabla === 'servicios') {
            query = 'UPDATE solicitudes_servicios SET estado = "rechazada" WHERE id_solicitud = ?';
        } else if (tabla === 'tipos_equipo') {
            query = 'UPDATE solicitudes_tipos_equipo SET estado = "rechazada" WHERE id_solicitud = ?';
        } else {
            return res.status(400).json({ error: 'Tabla no especificada' });
        }

        const [result] = await conmysql.query(query, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }

        res.json({ mensaje: 'Solicitud rechazada' });
    } catch (error) {
        console.error('[ERROR] rechazarSolicitud:', error.message);
        res.status(500).json({ error: 'Error al rechazar la solicitud' });
    }
};