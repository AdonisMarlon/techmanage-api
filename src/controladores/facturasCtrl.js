import { conmysql } from '../db.js';
import { 
    notificarRepuestoAgregado, 
    notificarServicioAgregado, 
    notificarNuevoAbono, 
    notificarFacturaGenerada 
} from '../services/notification.service.js';

// ============================================================
// 1. AGREGAR REPUESTO A ORDEN
// - Notifica al admin cuando se agrega un repuesto
// ============================================================
export const agregarRepuestoAOrden = async (req, res) => {
    const conexion = await conmysql.getConnection();
    
    try {
        const { id_orden, id_repuesto, cantidad_usada, precio_aplicado } = req.body;
        const userId = req.user.id;
        const userRol = req.user.rol;

        // Verificar si la orden existe y quién la creó
        const [orden] = await conexion.query(
            'SELECT id_tecnico FROM ordenes_trabajo WHERE id_orden = ?',
            [id_orden]
        );

        if (orden.length === 0) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        // Si es TECNICO, verificar que sea el dueño
        if (userRol !== 'ADMIN' && orden[0].id_tecnico !== userId) {
            return res.status(403).json({
                error: 'No tienes permisos para modificar esta orden. Solo el técnico asignado puede hacerlo.'
            });
        }

        // Obtener nombre del repuesto para la notificación
        const [repuestoData] = await conexion.query(
            'SELECT nombre FROM inventario WHERE id_repuesto = ?',
            [id_repuesto]
        );
        const repuestoNombre = repuestoData[0]?.nombre || 'Repuesto';

        await conexion.beginTransaction();

        // Insertar detalle
        await conexion.query(
            'INSERT INTO detalles_reparacion (id_orden, id_repuesto, cantidad_usada, precio_aplicado) VALUES (?, ?, ?, ?)',
            [id_orden, id_repuesto, cantidad_usada, precio_aplicado]
        );

        // Descontamos del inventario automáticamente
        await conexion.query(
            'UPDATE inventario SET cantidad_stock = cantidad_stock - ? WHERE id_repuesto = ?',
            [cantidad_usada, id_repuesto]
        );

        await conexion.commit();

        // NOTIFICACIÓN: Repuesto agregado a orden
        try {
            const tecnicoNombre = req.user?.nombre || 'Tecnico';
            await notificarRepuestoAgregado(
                conexion,
                { id_orden, codigo_orden: orden[0]?.codigo_orden || 'N/A' },
                repuestoNombre,
                cantidad_usada,
                tecnicoNombre
            );
            console.log('[FCM] Notificacion de repuesto agregado enviada al admin');
        } catch (notifError) {
            console.error('[ERROR] notificarRepuestoAgregado:', notifError.message);
        }

        res.status(201).json({ mensaje: 'Repuesto agregado y stock actualizado' });
    } catch (error) {
        await conexion.rollback();
        console.error('[ERROR] agregarRepuestoAOrden:', error.message);
        res.status(500).json({ error: 'Error al agregar el repuesto a la orden' });
    } finally {
        conexion.release();
    }
};

// ============================================================
// 2. AGREGAR SERVICIO A ORDEN
// - Notifica al admin cuando se agrega un servicio
// ============================================================
export const agregarServicioAOrden = async (req, res) => {
    try {
        const { id_orden, id_servicio, precio_aplicado } = req.body;
        const userId = req.user.id;
        const userRol = req.user.rol;

        // Verificar si la orden existe y quién la creó
        const [orden] = await conmysql.query(
            'SELECT id_tecnico FROM ordenes_trabajo WHERE id_orden = ?',
            [id_orden]
        );

        if (orden.length === 0) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        // Si es TECNICO, verificar que sea el dueño
        if (userRol !== 'ADMIN' && orden[0].id_tecnico !== userId) {
            return res.status(403).json({
                error: 'No tienes permisos para modificar esta orden. Solo el técnico asignado puede hacerlo.'
            });
        }

        // Obtener nombre del servicio para la notificación
        const [servicioData] = await conmysql.query(
            'SELECT nombre FROM servicios WHERE id_servicio = ?',
            [id_servicio]
        );
        const servicioNombre = servicioData[0]?.nombre || 'Servicio';

        await conmysql.query(
            'INSERT INTO detalles_servicios (id_orden, id_servicio, precio_aplicado) VALUES (?, ?, ?)',
            [id_orden, id_servicio, precio_aplicado]
        );

        // NOTIFICACIÓN: Servicio agregado a orden
        try {
            const tecnicoNombre = req.user?.nombre || 'Tecnico';
            await notificarServicioAgregado(
                conmysql,
                { id_orden, codigo_orden: orden[0]?.codigo_orden || 'N/A' },
                servicioNombre,
                tecnicoNombre
            );
            console.log('[FCM] Notificacion de servicio agregado enviada al admin');
        } catch (notifError) {
            console.error('[ERROR] notificarServicioAgregado:', notifError.message);
        }

        res.status(201).json({ mensaje: 'Servicio agregado a la orden' });
    } catch (error) {
        console.error('[ERROR] agregarServicioAOrden:', error.message);
        res.status(500).json({ error: 'Error al agregar el servicio' });
    }
};

// ============================================================
// 3. REGISTRAR ABONO
// - Notifica al admin cuando se registra un abono
// ============================================================
export const registrarAbono = async (req, res) => {
    try {
        const { id_orden, monto, metodo_pago, observacion } = req.body;
        const userId = req.user.id;
        const userRol = req.user.rol;

        // Verificar si la orden existe y quién la creó
        const [orden] = await conmysql.query(
            'SELECT id_tecnico FROM ordenes_trabajo WHERE id_orden = ?',
            [id_orden]
        );

        if (orden.length === 0) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        // Si es TECNICO, verificar que sea el dueño
        if (userRol !== 'ADMIN' && orden[0].id_tecnico !== userId) {
            return res.status(403).json({
                error: 'No tienes permisos para registrar abonos en esta orden. Solo el técnico asignado puede hacerlo.'
            });
        }

        // Obtener datos para la notificación
        const [ordenData] = await conmysql.query(
            `SELECT o.codigo_orden, c.nombre_completo as cliente
            FROM ordenes_trabajo o
            INNER JOIN clientes c ON o.id_cliente = c.id_cliente
            WHERE o.id_orden = ?`,
            [id_orden]
        );

        await conmysql.query(
            'INSERT INTO abonos (id_orden, monto, metodo_pago, observacion) VALUES (?, ?, ?, ?)',
            [id_orden, monto, metodo_pago, observacion]
        );

        // NOTIFICACIÓN: Nuevo abono registrado
        try {
            const tecnicoNombre = req.user?.nombre || 'Tecnico';
            if (ordenData.length > 0) {
                await notificarNuevoAbono(
                    conmysql,
                    { id_orden, codigo_orden: ordenData[0].codigo_orden },
                    monto,
                    ordenData[0].cliente,
                    tecnicoNombre
                );
                console.log('[FCM] Notificacion de abono enviada al admin');
            }
        } catch (notifError) {
            console.error('[ERROR] notificarNuevoAbono:', notifError.message);
        }

        res.status(201).json({ mensaje: 'Abono registrado con éxito' });
    } catch (error) {
        console.error('[ERROR] registrarAbono:', error.message);
        res.status(500).json({ error: 'Error al registrar el abono' });
    }
};

// ============================================================
// OBTENER FACTURA DE UNA ORDEN
// ============================================================
export const getFacturaByOrden = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(
            `SELECT * FROM facturas WHERE id_orden = ?`,
            [id]
        );
        if (result.length === 0) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }
        res.json(result[0]);
    } catch (error) {
        console.error('[ERROR] getFacturaByOrden:', error.message);
        res.status(500).json({ error: 'Error al obtener la factura' });
    }
};

// ============================================================
// GENERAR FACTURA
// - Notifica al admin cuando se genera una factura
// - También notifica cambio de estado a "Entregado"
// ============================================================
export const generarFactura = async (req, res) => {
    const conexion = await conmysql.getConnection();
    
    try {
        await conexion.beginTransaction();
        
        const { id_orden, subtotal, impuestos, total_final, saldo_pendiente, metodo_pago } = req.body;
        const userId = req.user.id;
        const userRol = req.user.rol;
        
        // Verificar que la orden exista
        const [orden] = await conexion.query(
            `SELECT id_orden, id_tecnico, estado_reparacion FROM ordenes_trabajo WHERE id_orden = ?`,
            [id_orden]
        );
        
        if (orden.length === 0) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }
        
        // Si es TECNICO, verificar que sea el dueño
        if (userRol !== 'ADMIN' && orden[0].id_tecnico !== userId) {
            return res.status(403).json({
                error: 'No tienes permisos para generar factura de esta orden. Solo el técnico asignado puede hacerlo.'
            });
        }
        
        // Validación: No generar factura si hay saldo pendiente
        if (saldo_pendiente > 0) {
            return res.status(400).json({ 
                error: 'No se puede generar factura. El cliente tiene saldo pendiente: $' + saldo_pendiente 
            });
        }
        
        // Verificar que la orden no esté ya facturada
        const [facturaExistente] = await conexion.query(
            `SELECT id_factura FROM facturas WHERE id_orden = ?`,
            [id_orden]
        );
        
        if (facturaExistente.length > 0) {
            return res.status(400).json({ error: 'Esta orden ya tiene una factura' });
        }
        
        // Obtener datos para la notificación
        const [ordenData] = await conexion.query(
            `SELECT o.codigo_orden, c.nombre_completo as cliente
            FROM ordenes_trabajo o
            INNER JOIN clientes c ON o.id_cliente = c.id_cliente
            WHERE o.id_orden = ?`,
            [id_orden]
        );
        
        // GENERAR NÚMERO DE FACTURA SECUENCIAL
        const fecha = new Date();
        const año = String(fecha.getFullYear()).slice(-2);
        const mes = String(fecha.getMonth() + 1).padStart(2, '0');
        const dia = String(fecha.getDate()).padStart(2, '0');
        const prefijo = `FAC-${año}${mes}${dia}`;

        // Buscar el ultimo numero de factura con ese prefijo
        const [ultimo] = await conexion.query(
            `SELECT numero_factura FROM facturas 
            WHERE numero_factura LIKE CONCAT(?, '-%')
            ORDER BY numero_factura DESC LIMIT 1`,
            [prefijo]
        );

        let numero = 1;
        if (ultimo.length > 0) {
            const ultimoNumero = ultimo[0].numero_factura;
            const partes = ultimoNumero.split('-');
            const numeroStr = partes[partes.length - 1];
            numero = parseInt(numeroStr) + 1;
        }

        const numero_factura = `${prefijo}-${String(numero).padStart(4, '0')}`;
        
        // Crear factura con el numero secuencial
        await conexion.query(
            `INSERT INTO facturas (id_orden, numero_factura, subtotal, impuestos, total_final, saldo_pendiente, metodo_pago)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id_orden, numero_factura, subtotal, impuestos, total_final, saldo_pendiente, metodo_pago]
        );
        
        // ACTUALIZAR: Cambiar estado a "Entregado" y calcular garantía
        const fechaEntrega = new Date();
        const fechaGarantia = new Date(fechaEntrega.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 días después
        
        await conexion.query(
            `UPDATE ordenes_trabajo 
            SET estado_reparacion = "Entregado", 
                fecha_entrega = ?,
                fecha_garantia = ?
            WHERE id_orden = ?`,
            [fechaEntrega, fechaGarantia, id_orden]
        );
        
        await conexion.commit();

        // NOTIFICACIÓN: Factura generada
        try {
            const tecnicoNombre = req.user?.nombre || 'Tecnico';
            if (ordenData.length > 0) {
                await notificarFacturaGenerada(
                    conexion,
                    { id_orden, codigo_orden: ordenData[0].codigo_orden },
                    total_final,
                    ordenData[0].cliente,
                    numero_factura,
                    tecnicoNombre
                );
                console.log('[FCM] Notificacion de factura enviada al admin');
            }
        } catch (notifError) {
            console.error('[ERROR] notificarFacturaGenerada:', notifError.message);
        }
        
        res.status(201).json({ 
            mensaje: 'Factura generada correctamente',
            numero_factura: numero_factura,
            fecha_garantia: fechaGarantia
        });
        
    } catch (error) {
        await conexion.rollback();
        console.error('[ERROR] generarFactura:', error.message);
        res.status(500).json({ error: 'Error al generar la factura' });
    } finally {
        conexion.release();
    }
};