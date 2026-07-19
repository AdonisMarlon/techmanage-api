import { conmysql } from '../db.js';
import { 
    notificarNuevaOrden, 
    notificarCambioEstado, 
    notificarAsignacionTecnico 
} from '../services/notification.service.js';

// ============================================================
// 1. OBTENER TODAS LAS ÓRDENES
// ============================================================
export const getOrdenes = async (req, res) => {
    try {
        const query = `
            SELECT o.*, 
                    c.nombre_completo as cliente, 
                    c.cedula as cliente_cedula,
                    c.telefono as cliente_telefono,
                    c.correo as cliente_correo,
                    c.direccion as cliente_direccion,
                    e.tipo_equipo, e.marca, e.modelo, e.numero_serie,
                    cat.nombre as categoria_nombre,
                    u.nombre as tecnico,
                    COALESCE((SELECT SUM(a.monto) FROM abonos a WHERE a.id_orden = o.id_orden), 0) as total_abonos,
                    DATEDIFF(o.fecha_garantia, NOW()) as dias_garantia_restantes
            FROM ordenes_trabajo o
            INNER JOIN clientes c ON o.id_cliente = c.id_cliente
            INNER JOIN equipos e ON o.id_equipo = e.id_equipo
            LEFT JOIN categorias_equipos cat ON e.id_categoria_equipo = cat.id_categoria_equipo
            INNER JOIN usuarios u ON o.id_tecnico = u.id_usuario
            ORDER BY o.fecha_ingreso DESC
        `;
        const [result] = await conmysql.query(query);
        res.json(result);
    } catch (error) {
        console.error('[ERROR] getOrdenes:', error.message);
        res.status(500).json({ error: 'Error al obtener las órdenes' });
    }
};

// ============================================================
// 2. OBTENER ORDEN POR ID
// ============================================================
export const getOrdenById = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT o.*, 
                    c.nombre_completo as cliente, 
                    c.cedula as cliente_cedula,
                    c.telefono as cliente_telefono,
                    c.correo as cliente_correo,
                    c.direccion as cliente_direccion,
                    e.tipo_equipo, e.marca, e.modelo, e.numero_serie,
                    cat.nombre as categoria_nombre,
                    u.nombre as tecnico,
                    COALESCE((SELECT SUM(a.monto) FROM abonos a WHERE a.id_orden = o.id_orden), 0) as total_abonos,
                    DATEDIFF(o.fecha_garantia, NOW()) as dias_garantia_restantes
            FROM ordenes_trabajo o
            INNER JOIN clientes c ON o.id_cliente = c.id_cliente
            INNER JOIN equipos e ON o.id_equipo = e.id_equipo
            LEFT JOIN categorias_equipos cat ON e.id_categoria_equipo = cat.id_categoria_equipo
            INNER JOIN usuarios u ON o.id_tecnico = u.id_usuario
            WHERE o.id_orden = ?
        `;
        const [result] = await conmysql.query(query, [id]);
        
        if (result.length === 0) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }
        res.json(result[0]);
    } catch (error) {
        console.error('[ERROR] getOrdenById:', error.message);
        res.status(500).json({ error: 'Error al obtener la orden' });
    }
};

// ============================================================
// 3. CREAR ORDEN
// - Notifica al técnico asignado
// - Notifica al admin
// ============================================================
export const crearOrden = async (req, res) => {
    try {
        const { id_cliente, id_equipo, id_tecnico, problema_reportado, diagnostico_tecnico } = req.body;
        const tecnicoNombre = req.user?.nombre || 'Tecnico';

        const fecha = new Date();
        const año = String(fecha.getFullYear()).slice(-2);
        const mes = String(fecha.getMonth() + 1).padStart(2, '0');
        const dia = String(fecha.getDate()).padStart(2, '0');
        const prefijo = `ORD-${año}${mes}${dia}`;

        const [ultimo] = await conmysql.query(
            `SELECT codigo_orden FROM ordenes_trabajo 
            WHERE codigo_orden LIKE CONCAT(?, '-%')
            ORDER BY codigo_orden DESC LIMIT 1`,
            [prefijo]
        );

        let numero = 1;
        if (ultimo.length > 0) {
            const ultimoCodigo = ultimo[0].codigo_orden;
            const partes = ultimoCodigo.split('-');
            const numeroStr = partes[partes.length - 1];
            numero = parseInt(numeroStr) + 1;
        }

        const codigo_orden = `${prefijo}-${String(numero).padStart(4, '0')}`;

        const [result] = await conmysql.query(
            `INSERT INTO ordenes_trabajo 
            (codigo_orden, id_cliente, id_equipo, id_tecnico, problema_reportado, diagnostico_tecnico) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [codigo_orden, id_cliente, id_equipo, id_tecnico, problema_reportado, diagnostico_tecnico || null]
        );

        // Obtener datos para la notificación
        const [clienteData] = await conmysql.query(
            'SELECT nombre_completo FROM clientes WHERE id_cliente = ?',
            [id_cliente]
        );
        const clienteNombre = clienteData[0]?.nombre_completo || 'Cliente';

        const [equipoData] = await conmysql.query(
            'SELECT tipo_equipo FROM equipos WHERE id_equipo = ?',
            [id_equipo]
        );
        const equipoTipo = equipoData[0]?.tipo_equipo || 'Equipo';

        const ordenData = {
            id_orden: result.insertId,
            codigo_orden: codigo_orden,
            tipo_equipo: equipoTipo
        };

        // NOTIFICACIÓN: Al técnico asignado
        try {
            await notificarNuevaOrden(conmysql, ordenData, clienteNombre, id_tecnico, tecnicoNombre);
            console.log(`[FCM] Notificacion nueva orden enviada al tecnico ${id_tecnico}`);
        } catch (notificationError) {
            console.error('[ERROR] Notificacion nueva orden (tecnico):', notificationError.message);
        }

        res.status(201).json({
            mensaje: 'Orden creada con exito',
            id_orden: result.insertId,
            codigo_orden: codigo_orden
        });

    } catch (error) {
        console.error('[ERROR] crearOrden:', error.message);
        res.status(500).json({ error: 'Error al crear la orden' });
    }
};

// ============================================================
// 4. ACTUALIZAR ESTADO DE LA ORDEN
// - Notifica al técnico asignado
// - Notifica al admin
// ============================================================
export const actualizarEstadoOrden = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado_reparacion, diagnostico_tecnico } = req.body;
        const userId = req.user.id;
        const userRol = req.user.rol;
        const usuarioNombre = req.user?.nombre || 'Tecnico';

        const [orden] = await conmysql.query(
            'SELECT id_tecnico, estado_reparacion FROM ordenes_trabajo WHERE id_orden = ?',
            [id]
        );

        if (orden.length === 0) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        if (userRol !== 'ADMIN' && orden[0].id_tecnico !== userId) {
            return res.status(403).json({ 
                error: 'No tienes permisos para cambiar el estado de esta orden.' 
            });
        }

        const estadosValidos = ['Ingreso', 'Diagnostico', 'En curso', 'Listo', 'Entregado'];
        if (!estadosValidos.includes(estado_reparacion)) {
            return res.status(400).json({ error: 'Estado no válido' });
        }

        if (estado_reparacion === 'Entregado') {
            const [totalResult] = await conmysql.query(
                `SELECT 
                    COALESCE((SELECT SUM(dr.cantidad_usada * dr.precio_aplicado) FROM detalles_reparacion dr WHERE dr.id_orden = ?), 0) +
                    COALESCE((SELECT SUM(ds.precio_aplicado) FROM detalles_servicios ds WHERE ds.id_orden = ?), 0) as total`,
                [id, id]
            );
            const total = totalResult[0]?.total || 0;

            const [abonosResult] = await conmysql.query(
                `SELECT COALESCE(SUM(monto), 0) as total_abonos FROM abonos WHERE id_orden = ?`,
                [id]
            );
            const totalAbonos = abonosResult[0]?.total_abonos || 0;

            const saldoPendiente = total - totalAbonos;

            if (saldoPendiente > 0) {
                return res.status(400).json({
                    error: 'No se puede entregar la orden. Saldo pendiente: $' + saldoPendiente.toFixed(2),
                    saldo_pendiente: saldoPendiente
                });
            }
        }

        const [result] = await conmysql.query(
            `UPDATE ordenes_trabajo 
            SET estado_reparacion = ?, 
                diagnostico_tecnico = COALESCE(?, diagnostico_tecnico),
                fecha_entrega = ?,
                fecha_garantia = ?
            WHERE id_orden = ?`,
            [
                estado_reparacion,
                diagnostico_tecnico,
                estado_reparacion === 'Entregado' ? new Date() : null,
                estado_reparacion === 'Entregado' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        // Obtener datos para la notificación
        const [clienteData] = await conmysql.query(
            'SELECT nombre_completo FROM clientes WHERE id_cliente = (SELECT id_cliente FROM ordenes_trabajo WHERE id_orden = ?)',
            [id]
        );
        const clienteNombre = clienteData[0]?.nombre_completo || 'Cliente';
        
        const [ordenData] = await conmysql.query(
            'SELECT codigo_orden FROM ordenes_trabajo WHERE id_orden = ?',
            [id]
        );
        
        const [tecnicoData] = await conmysql.query(
            'SELECT id_tecnico FROM ordenes_trabajo WHERE id_orden = ?',
            [id]
        );
        const tecnicoId = tecnicoData[0]?.id_tecnico;
        
        const ordenNotif = {
            id_orden: id,
            codigo_orden: ordenData[0]?.codigo_orden || 'N/A'
        };
        
        // NOTIFICACIÓN: Al técnico asignado
        if (tecnicoId) {
            try {
                await notificarCambioEstado(conmysql, ordenNotif, clienteNombre, estado_reparacion, tecnicoId, usuarioNombre);
                console.log(`[FCM] Notificacion cambio estado enviada al tecnico ${tecnicoId}`);
            } catch (notificationError) {
                console.error('[ERROR] Notificacion cambio estado (tecnico):', notificationError.message);
            }
        }

        res.json({
            mensaje: 'Orden actualizada correctamente'
        });

    } catch (error) {
        console.error('[ERROR] actualizarEstadoOrden:', error.message);
        res.status(500).json({ error: 'Error al actualizar la orden' });
    }
};

// ============================================================
// 5. ACTUALIZAR DATOS DE LA ORDEN (EDITAR)
// - Notifica al nuevo técnico si cambia
// - Notifica al admin
// ============================================================
export const actualizarOrden = async (req, res) => {
    try {
        const { id } = req.params;
        const { id_tecnico, problema_reportado, diagnostico_tecnico } = req.body;
        const userId = req.user.id;
        const userRol = req.user.rol;
        const usuarioNombre = req.user?.nombre || 'Tecnico';

        const [orden] = await conmysql.query(
            'SELECT id_tecnico FROM ordenes_trabajo WHERE id_orden = ?',
            [id]
        );

        if (orden.length === 0) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        if (userRol !== 'ADMIN' && orden[0].id_tecnico !== userId) {
            return res.status(403).json({ 
                error: 'No tienes permisos para editar esta orden.' 
            });
        }

        const [result] = await conmysql.query(
            `UPDATE ordenes_trabajo 
            SET id_tecnico = ?, problema_reportado = ?, diagnostico_tecnico = ?
            WHERE id_orden = ?`,
            [id_tecnico, problema_reportado, diagnostico_tecnico, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        // Obtener datos para la notificación de asignación
        const [ordenAntes] = await conmysql.query(
            'SELECT id_tecnico FROM ordenes_trabajo WHERE id_orden = ?',
            [id]
        );
        
        const tecnicoAnterior = ordenAntes[0]?.id_tecnico;
        
        // ✅ NOTIFICACIÓN: Si cambió el técnico
        if (tecnicoAnterior !== id_tecnico) {
            try {
                // Obtener nombre del técnico anterior
                let tecnicoAnteriorNombre = 'Sin técnico';
                if (tecnicoAnterior) {
                    const [tecnicoAnt] = await conmysql.query(
                        'SELECT nombre FROM usuarios WHERE id_usuario = ?',
                        [tecnicoAnterior]
                    );
                    tecnicoAnteriorNombre = tecnicoAnt[0]?.nombre || 'Técnico anterior';
                }

                // Obtener nombre del nuevo técnico
                let nuevoTecnicoNombre = 'Técnico';
                if (id_tecnico) {
                    const [tecnicoNuevo] = await conmysql.query(
                        'SELECT nombre FROM usuarios WHERE id_usuario = ?',
                        [id_tecnico]
                    );
                    nuevoTecnicoNombre = tecnicoNuevo[0]?.nombre || 'Técnico';
                }

                const [clienteData] = await conmysql.query(
                    'SELECT nombre_completo FROM clientes WHERE id_cliente = (SELECT id_cliente FROM ordenes_trabajo WHERE id_orden = ?)',
                    [id]
                );
                const clienteNombre = clienteData[0]?.nombre_completo || 'Cliente';
                
                const [ordenData] = await conmysql.query(
                    'SELECT codigo_orden FROM ordenes_trabajo WHERE id_orden = ?',
                    [id]
                );
                
                const ordenNotif = {
                    id_orden: id,
                    codigo_orden: ordenData[0]?.codigo_orden || 'N/A'
                };
                
                await notificarAsignacionTecnico(
                    conmysql, 
                    ordenNotif, 
                    clienteNombre, 
                    id_tecnico, 
                    nuevoTecnicoNombre, 
                    tecnicoAnteriorNombre
                );
                console.log(`[FCM] Notificacion asignacion enviada al tecnico ${id_tecnico}`);
            } catch (notificationError) {
                console.error('[ERROR] Notificacion asignacion:', notificationError.message);
            }
        }

        res.json({ mensaje: 'Orden actualizada con exito' });

    } catch (error) {
        console.error('[ERROR] actualizarOrden:', error.message);
        res.status(500).json({ error: 'Error al actualizar la orden' });
    }
};

// ========== REPUESTOS ==========
export const getRepuestosByOrden = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(
            `SELECT dr.*, i.nombre as repuesto_nombre, i.descripcion as repuesto_descripcion
            FROM detalles_reparacion dr
            INNER JOIN inventario i ON dr.id_repuesto = i.id_repuesto
            WHERE dr.id_orden = ?
            ORDER BY dr.id_detalle DESC`,
            [id]
        );
        res.json(result);
    } catch (error) {
        console.error('[ERROR] getRepuestosByOrden:', error.message);
        res.status(500).json({ error: 'Error al obtener los repuestos' });
    }
};

export const agregarRepuestoAOrden = async (req, res) => {
    const conexion = await conmysql.getConnection();
    try {
        const { id_orden, id_repuesto, cantidad_usada, precio_aplicado } = req.body;
        const userId = req.user.id;
        const userRol = req.user.rol;

        const [orden] = await conexion.query(
            'SELECT id_tecnico FROM ordenes_trabajo WHERE id_orden = ?',
            [id_orden]
        );

        if (orden.length === 0) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        if (userRol !== 'ADMIN' && orden[0].id_tecnico !== userId) {
            return res.status(403).json({
                error: 'No tienes permisos para modificar esta orden.'
            });
        }

        await conexion.beginTransaction();

        await conexion.query(
            `INSERT INTO detalles_reparacion (id_orden, id_repuesto, cantidad_usada, precio_aplicado)
            VALUES (?, ?, ?, ?)`,
            [id_orden, id_repuesto, cantidad_usada, precio_aplicado]
        );

        await conexion.query(
            `UPDATE inventario SET cantidad_stock = cantidad_stock - ? WHERE id_repuesto = ?`,
            [cantidad_usada, id_repuesto]
        );

        const [totalResult] = await conexion.query(
            `SELECT COALESCE(SUM(dr.cantidad_usada * dr.precio_aplicado), 0) as total
            FROM detalles_reparacion dr
            WHERE dr.id_orden = ?`,
            [id_orden]
        );
        const total = totalResult[0]?.total || 0;

        await conexion.query(
            `UPDATE ordenes_trabajo SET total_reparacion = ? WHERE id_orden = ?`,
            [total, id_orden]
        );

        await conexion.commit();
        res.status(201).json({ mensaje: 'Repuesto agregado correctamente', total: total });

    } catch (error) {
        await conexion.rollback();
        console.error('[ERROR] agregarRepuestoAOrden:', error.message);
        res.status(500).json({ error: 'Error al agregar el repuesto' });
    } finally {
        conexion.release();
    }
};

export const eliminarRepuestoDeOrden = async (req, res) => {
    const conexion = await conmysql.getConnection();
    try {
        await conexion.beginTransaction();
        const { id } = req.params;
        
        const [detalle] = await conexion.query(
            `SELECT id_orden, id_repuesto, cantidad_usada FROM detalles_reparacion WHERE id_detalle = ?`,
            [id]
        );
        
        if (detalle.length === 0) {
            return res.status(404).json({ error: 'Detalle no encontrado' });
        }
        
        const { id_orden, id_repuesto, cantidad_usada } = detalle[0];
        
        await conexion.query(`DELETE FROM detalles_reparacion WHERE id_detalle = ?`, [id]);
        await conexion.query(`UPDATE inventario SET cantidad_stock = cantidad_stock + ? WHERE id_repuesto = ?`, [cantidad_usada, id_repuesto]);
        
        const [totalResult] = await conexion.query(
            `SELECT COALESCE(SUM(dr.cantidad_usada * dr.precio_aplicado), 0) as total
            FROM detalles_reparacion dr
            WHERE dr.id_orden = ?`,
            [id_orden]
        );
        const total = totalResult[0]?.total || 0;
        
        await conexion.query(`UPDATE ordenes_trabajo SET total_reparacion = ? WHERE id_orden = ?`, [total, id_orden]);
        await conexion.commit();
        
        res.json({ mensaje: 'Repuesto eliminado correctamente', total: total });
    } catch (error) {
        await conexion.rollback();
        console.error('[ERROR] eliminarRepuestoDeOrden:', error.message);
        res.status(500).json({ error: 'Error al eliminar el repuesto' });
    } finally {
        conexion.release();
    }
};

export const actualizarCantidadRepuesto = async (req, res) => {
    const conexion = await conmysql.getConnection();
    try {
        await conexion.beginTransaction();
        const { id } = req.params;
        const { cantidad_usada } = req.body;
        
        if (!cantidad_usada || cantidad_usada < 1) {
            return res.status(400).json({ error: 'Cantidad invalida' });
        }
        
        const [detalle] = await conexion.query(
            `SELECT id_orden, id_repuesto, cantidad_usada as cantidad_anterior 
            FROM detalles_reparacion WHERE id_detalle = ?`,
            [id]
        );
        
        if (detalle.length === 0) {
            return res.status(404).json({ error: 'Detalle no encontrado' });
        }
        
        const { id_orden, id_repuesto, cantidad_anterior } = detalle[0];
        const diferencia = cantidad_usada - cantidad_anterior;
        
        if (diferencia > 0) {
            const [stock] = await conexion.query(
                `SELECT cantidad_stock FROM inventario WHERE id_repuesto = ?`,
                [id_repuesto]
            );
            if (stock.length === 0 || stock[0].cantidad_stock < diferencia) {
                return res.status(400).json({ error: 'Stock insuficiente' });
            }
            await conexion.query(`UPDATE inventario SET cantidad_stock = cantidad_stock - ? WHERE id_repuesto = ?`, [diferencia, id_repuesto]);
        } else if (diferencia < 0) {
            await conexion.query(`UPDATE inventario SET cantidad_stock = cantidad_stock + ? WHERE id_repuesto = ?`, [-diferencia, id_repuesto]);
        }
        
        await conexion.query(`UPDATE detalles_reparacion SET cantidad_usada = ? WHERE id_detalle = ?`, [cantidad_usada, id]);
        
        const [totalResult] = await conexion.query(
            `SELECT COALESCE(SUM(dr.cantidad_usada * dr.precio_aplicado), 0) as total
            FROM detalles_reparacion dr
            WHERE dr.id_orden = ?`,
            [id_orden]
        );
        const total = totalResult[0]?.total || 0;
        
        await conexion.query(`UPDATE ordenes_trabajo SET total_reparacion = ? WHERE id_orden = ?`, [total, id_orden]);
        await conexion.commit();
        
        res.json({ mensaje: 'Cantidad actualizada correctamente', total: total });
    } catch (error) {
        await conexion.rollback();
        console.error('[ERROR] actualizarCantidadRepuesto:', error.message);
        res.status(500).json({ error: 'Error al actualizar la cantidad' });
    } finally {
        conexion.release();
    }
};

// ========== ABONOS ==========
export const getAbonosByOrden = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(
            `SELECT * FROM abonos WHERE id_orden = ? ORDER BY fecha_abono DESC`,
            [id]
        );
        res.json(result);
    } catch (error) {
        console.error('[ERROR] getAbonosByOrden:', error.message);
        res.status(500).json({ error: 'Error al obtener los abonos' });
    }
};

export const registrarAbono = async (req, res) => {
    try {
        const { id_orden, monto, metodo_pago, observacion } = req.body;
        const userId = req.user.id;
        const userRol = req.user.rol;

        const [orden] = await conmysql.query(
            'SELECT id_tecnico FROM ordenes_trabajo WHERE id_orden = ?',
            [id_orden]
        );

        if (orden.length === 0) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        if (userRol !== 'ADMIN' && orden[0].id_tecnico !== userId) {
            return res.status(403).json({
                error: 'No tienes permisos para registrar abonos en esta orden.'
            });
        }

        const [result] = await conmysql.query(
            `INSERT INTO abonos (id_orden, monto, metodo_pago, observacion)
            VALUES (?, ?, ?, ?)`,
            [id_orden, monto, metodo_pago, observacion]
        );

        res.status(201).json({
            mensaje: 'Abono registrado correctamente',
            id_abono: result.insertId
        });

    } catch (error) {
        console.error('[ERROR] registrarAbono:', error.message);
        res.status(500).json({ error: 'Error al registrar el abono' });
    }
};

export const eliminarAbono = async (req, res) => {
    try {
        const { id } = req.params;
        await conmysql.query(`DELETE FROM abonos WHERE id_abono = ?`, [id]);
        res.json({ mensaje: 'Abono eliminado correctamente' });
    } catch (error) {
        console.error('[ERROR] eliminarAbono:', error.message);
        res.status(500).json({ error: 'Error al eliminar el abono' });
    }
};

// ========== SERVICIOS ==========
export const getServiciosByOrden = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(
            `SELECT ds.*, s.nombre as servicio_nombre, s.descripcion as servicio_descripcion
            FROM detalles_servicios ds
            INNER JOIN servicios s ON ds.id_servicio = s.id_servicio
            WHERE ds.id_orden = ?
            ORDER BY ds.id_detalle_servicio DESC`,
            [id]
        );
        res.json(result);
    } catch (error) {
        console.error('[ERROR] getServiciosByOrden:', error.message);
        res.status(500).json({ error: 'Error al obtener los servicios' });
    }
};

export const agregarServicioAOrden = async (req, res) => {
    const conexion = await conmysql.getConnection();
    try {
        const { id_orden, id_servicio, precio_aplicado } = req.body;
        const userId = req.user.id;
        const userRol = req.user.rol;

        const [orden] = await conexion.query(
            'SELECT id_tecnico FROM ordenes_trabajo WHERE id_orden = ?',
            [id_orden]
        );

        if (orden.length === 0) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        if (userRol !== 'ADMIN' && orden[0].id_tecnico !== userId) {
            return res.status(403).json({
                error: 'No tienes permisos para modificar esta orden.'
            });
        }

        await conexion.beginTransaction();

        await conexion.query(
            `INSERT INTO detalles_servicios (id_orden, id_servicio, precio_aplicado)
            VALUES (?, ?, ?)`,
            [id_orden, id_servicio, precio_aplicado]
        );

        const [totalResult] = await conexion.query(
            `SELECT 
                COALESCE((SELECT SUM(dr.cantidad_usada * dr.precio_aplicado) FROM detalles_reparacion dr WHERE dr.id_orden = ?), 0) +
                COALESCE((SELECT SUM(ds.precio_aplicado) FROM detalles_servicios ds WHERE ds.id_orden = ?), 0) as total`,
            [id_orden, id_orden]
        );
        const total = totalResult[0]?.total || 0;

        await conexion.query(`UPDATE ordenes_trabajo SET total_reparacion = ? WHERE id_orden = ?`, [total, id_orden]);
        await conexion.commit();

        res.status(201).json({ mensaje: 'Servicio agregado correctamente', total: total });
    } catch (error) {
        await conexion.rollback();
        console.error('[ERROR] agregarServicioAOrden:', error.message);
        res.status(500).json({ error: 'Error al agregar el servicio' });
    } finally {
        conexion.release();
    }
};

export const eliminarServicioDeOrden = async (req, res) => {
    const conexion = await conmysql.getConnection();
    try {
        await conexion.beginTransaction();
        const { id } = req.params;
        
        const [detalle] = await conexion.query(
            `SELECT id_orden FROM detalles_servicios WHERE id_detalle_servicio = ?`,
            [id]
        );
        
        if (detalle.length === 0) {
            return res.status(404).json({ error: 'Detalle no encontrado' });
        }
        
        const id_orden = detalle[0].id_orden;
        await conexion.query(`DELETE FROM detalles_servicios WHERE id_detalle_servicio = ?`, [id]);
        
        const [totalResult] = await conexion.query(
            `SELECT 
                COALESCE((SELECT SUM(dr.cantidad_usada * dr.precio_aplicado) FROM detalles_reparacion dr WHERE dr.id_orden = ?), 0) +
                COALESCE((SELECT SUM(ds.precio_aplicado) FROM detalles_servicios ds WHERE ds.id_orden = ?), 0) as total`,
            [id_orden, id_orden]
        );
        const total = totalResult[0]?.total || 0;
        
        await conexion.query(`UPDATE ordenes_trabajo SET total_reparacion = ? WHERE id_orden = ?`, [total, id_orden]);
        await conexion.commit();
        
        res.json({ mensaje: 'Servicio eliminado correctamente', total: total });
    } catch (error) {
        await conexion.rollback();
        console.error('[ERROR] eliminarServicioDeOrden:', error.message);
        res.status(500).json({ error: 'Error al eliminar el servicio' });
    } finally {
        conexion.release();
    }
};

// ========== DASHBOARD ==========
export const getOrdenesPorEstado = async (req, res) => {
    try {
        const [result] = await conmysql.query(
            `SELECT estado_reparacion, COUNT(*) as cantidad 
            FROM ordenes_trabajo 
            GROUP BY estado_reparacion`
        );
        res.json(result);
    } catch (error) {
        console.error('[ERROR] getOrdenesPorEstado:', error.message);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};

export const getOrdenesHoy = async (req, res) => {
    try {
        const [result] = await conmysql.query(
            `SELECT COUNT(*) as total FROM ordenes_trabajo 
            WHERE DATE(fecha_ingreso) = CURDATE()`
        );
        res.json(result[0]);
    } catch (error) {
        console.error('[ERROR] getOrdenesHoy:', error.message);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};

export const getIngresosMes = async (req, res) => {
    try {
        const [result] = await conmysql.query(
            `SELECT COALESCE(SUM(total_reparacion), 0) as total 
            FROM ordenes_trabajo 
            WHERE estado_reparacion = 'Entregado' 
            AND MONTH(fecha_entrega) = MONTH(CURDATE()) 
            AND YEAR(fecha_entrega) = YEAR(CURDATE())`
        );
        res.json(result[0]);
    } catch (error) {
        console.error('[ERROR] getIngresosMes:', error.message);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};

export const getRepuestosMasUsados = async (req, res) => {
    try {
        const [result] = await conmysql.query(
            `SELECT i.nombre, SUM(dr.cantidad_usada) as total_usado
            FROM detalles_reparacion dr
            INNER JOIN inventario i ON dr.id_repuesto = i.id_repuesto
            GROUP BY dr.id_repuesto
            ORDER BY total_usado DESC
            LIMIT 5`
        );
        res.json(result);
    } catch (error) {
        console.error('[ERROR] getRepuestosMasUsados:', error.message);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};

export const getUltimasOrdenes = async (req, res) => {
    try {
        const [result] = await conmysql.query(
            `SELECT o.id_orden, o.codigo_orden, o.estado_reparacion, 
                    c.nombre_completo as cliente, o.total_reparacion,
                    o.fecha_ingreso
            FROM ordenes_trabajo o
            INNER JOIN clientes c ON o.id_cliente = c.id_cliente
            ORDER BY o.id_orden DESC
            LIMIT 5`
        );
        res.json(result);
    } catch (error) {
        console.error('[ERROR] getUltimasOrdenes:', error.message);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};

export const getOrdenesByCliente = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(
            `SELECT o.id_orden, o.codigo_orden, o.estado_reparacion, 
                    o.total_reparacion, o.fecha_ingreso, o.fecha_entrega,
                    c.nombre_completo as cliente,
                    c.cedula as cliente_cedula,
                    c.telefono as cliente_telefono,
                    c.correo as cliente_correo,
                    e.tipo_equipo, e.marca, e.modelo, e.numero_serie,
                    u.nombre as tecnico
            FROM ordenes_trabajo o
            INNER JOIN clientes c ON o.id_cliente = c.id_cliente
            INNER JOIN equipos e ON o.id_equipo = e.id_equipo
            INNER JOIN usuarios u ON o.id_tecnico = u.id_usuario
            WHERE o.id_cliente = ?
            ORDER BY o.fecha_ingreso DESC`,
            [id]
        );
        res.json(result);
    } catch (error) {
        console.error('[ERROR] getOrdenesByCliente:', error.message);
        res.status(500).json({ error: 'Error al obtener el historial del cliente' });
    }
};

export const getOrdenesPorEstadoFiltrado = async (req, res) => {
    try {
        const { estado } = req.params;
        if (!estado) {
            return res.status(400).json({ error: 'Se requiere un estado para filtrar' });
        }
        const query = `
            SELECT o.id_orden, o.codigo_orden, o.estado_reparacion, 
                    o.total_reparacion, o.fecha_ingreso,
                    c.nombre_completo as cliente,
                    e.tipo_equipo, e.marca, e.modelo
            FROM ordenes_trabajo o
            INNER JOIN clientes c ON o.id_cliente = c.id_cliente
            INNER JOIN equipos e ON o.id_equipo = e.id_equipo
            WHERE o.estado_reparacion = ?
            ORDER BY o.fecha_ingreso DESC
        `;
        const [result] = await conmysql.query(query, [estado]);
        res.json(result);
    } catch (error) {
        console.error('[ERROR] getOrdenesPorEstadoFiltrado:', error.message);
        res.status(500).json({ error: 'Error al obtener las órdenes' });
    }
};

// ========== HISTORIAL ==========
export const getHistorialEstados = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(
            `SELECT * FROM historial_estados 
            WHERE id_orden = ?
            ORDER BY fecha_cambio DESC`,
            [id]
        );
        res.json(result);
    } catch (error) {
        console.error('[ERROR] getHistorialEstados:', error.message);
        res.status(500).json({ error: 'Error al obtener el historial' });
    }
};

// ========== GARANTÍAS ==========
export const verificarGarantia = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(
            `SELECT 
                id_orden,
                fecha_garantia,
                DATEDIFF(fecha_garantia, NOW()) as dias_restantes,
                CASE 
                    WHEN fecha_garantia IS NULL THEN 'Sin garantía'
                    WHEN fecha_garantia < NOW() THEN 'Garantía vencida'
                    ELSE 'En garantía'
                END as estado_garantia
            FROM ordenes_trabajo 
            WHERE id_orden = ?`,
            [id]
        );
        if (result.length === 0) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }
        res.json(result[0]);
    } catch (error) {
        console.error('[ERROR] verificarGarantia:', error.message);
        res.status(500).json({ error: 'Error al verificar la garantía' });
    }
};

export const getGarantiasPorVencer = async (req, res) => {
    try {
        const [result] = await conmysql.query(
            `SELECT o.id_orden, o.codigo_orden, o.fecha_garantia,
                    c.nombre_completo as cliente,
                    e.tipo_equipo, e.marca, e.modelo,
                    DATEDIFF(o.fecha_garantia, NOW()) as dias_restantes
            FROM ordenes_trabajo o
            INNER JOIN clientes c ON o.id_cliente = c.id_cliente
            INNER JOIN equipos e ON o.id_equipo = e.id_equipo
            WHERE o.estado_reparacion = 'Entregado'
            AND o.fecha_garantia IS NOT NULL
            AND o.fecha_garantia >= NOW()
            AND DATEDIFF(o.fecha_garantia, NOW()) <= 7
            ORDER BY o.fecha_garantia ASC
            LIMIT 20`
        );
        res.json(result);
    } catch (error) {
        console.error('[ERROR] getGarantiasPorVencer:', error.message);
        res.status(500).json({ error: 'Error al obtener las garantías por vencer' });
    }
};

export const getGarantiasVencidas = async (req, res) => {
    try {
        const [result] = await conmysql.query(
            `SELECT o.id_orden, o.codigo_orden, o.fecha_garantia,
                    c.nombre_completo as cliente,
                    e.tipo_equipo, e.marca, e.modelo,
                    DATEDIFF(NOW(), o.fecha_garantia) as dias_vencidos
            FROM ordenes_trabajo o
            INNER JOIN clientes c ON o.id_cliente = c.id_cliente
            INNER JOIN equipos e ON o.id_equipo = e.id_equipo
            WHERE o.estado_reparacion = 'Entregado'
            AND o.fecha_garantia IS NOT NULL
            AND o.fecha_garantia < NOW()
            ORDER BY o.fecha_garantia ASC
            LIMIT 20`
        );
        res.json(result);
    } catch (error) {
        console.error('[ERROR] getGarantiasVencidas:', error.message);
        res.status(500).json({ error: 'Error al obtener las garantías vencidas' });
    }
};

export const getResumenGarantias = async (req, res) => {
    try {
        const [vencenPronto] = await conmysql.query(
            `SELECT COUNT(*) as total
            FROM ordenes_trabajo
            WHERE estado_reparacion = 'Entregado'
            AND fecha_garantia IS NOT NULL
            AND fecha_garantia >= NOW()
            AND DATEDIFF(fecha_garantia, NOW()) <= 7`
        );
        const [vencidas] = await conmysql.query(
            `SELECT COUNT(*) as total
            FROM ordenes_trabajo
            WHERE estado_reparacion = 'Entregado'
            AND fecha_garantia IS NOT NULL
            AND fecha_garantia < NOW()`
        );
        const [vigentes] = await conmysql.query(
            `SELECT COUNT(*) as total
            FROM ordenes_trabajo
            WHERE estado_reparacion = 'Entregado'
            AND fecha_garantia IS NOT NULL
            AND fecha_garantia >= NOW()
            AND DATEDIFF(fecha_garantia, NOW()) > 7`
        );
        res.json({
            vencen_pronto: vencenPronto[0]?.total || 0,
            vencidas: vencidas[0]?.total || 0,
            vigentes: vigentes[0]?.total || 0
        });
    } catch (error) {
        console.error('[ERROR] getResumenGarantias:', error.message);
        res.status(500).json({ error: 'Error al obtener el resumen de garantías' });
    }
};