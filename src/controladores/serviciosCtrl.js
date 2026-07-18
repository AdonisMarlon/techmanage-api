import { conmysql } from '../db.js';

// 1. Obtener todos los servicios (Catálogo de mano de obra)
export const getServicios = async (req, res) => {
    try {
        const [result] = await conmysql.query('SELECT * FROM servicios ORDER BY nombre ASC');
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener los servicios' });
    }
};

// 2. Obtener un servicio por su ID
export const getServicioById = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query('SELECT * FROM servicios WHERE id_servicio = ?', [id]);
        
        if (result.length === 0) {
            return res.status(404).json({ error: 'Servicio no encontrado' });
        }
        res.json(result[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener el servicio' });
    }
};

// 3. Crear un nuevo servicio
export const crearServicio = async (req, res) => {
    try {
        const { nombre, descripcion, precio_base } = req.body;
        
        const [result] = await conmysql.query(
            'INSERT INTO servicios (nombre, descripcion, precio_base) VALUES (?, ?, ?)',
            [nombre, descripcion, precio_base]
        );

        res.status(201).json({ 
            mensaje: 'Servicio registrado con éxito', 
            id_servicio: result.insertId 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al registrar el servicio.' });
    }
};

// 4. ACTUALIZAR un servicio (NUEVO)
export const actualizarServicio = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, precio_base } = req.body;
        
        const [result] = await conmysql.query(
            'UPDATE servicios SET nombre = ?, descripcion = ?, precio_base = ? WHERE id_servicio = ?',
            [nombre, descripcion, precio_base, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Servicio no encontrado' });
        }

        res.json({ mensaje: 'Servicio actualizado con éxito' });
    } catch (error) {
        console.error('Error al actualizar el servicio:', error);
        res.status(500).json({ error: 'Error al actualizar el servicio' });
    }
};

//  OBTENER ABONOS DE UNA ORDEN
export const getAbonosByOrden = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(
            `SELECT * FROM abonos WHERE id_orden = ? ORDER BY fecha_abono DESC`,
            [id]
        );
        res.json(result);
    } catch (error) {
        console.error('Error al obtener abonos:', error);
        res.status(500).json({ error: 'Error al obtener los abonos' });
    }
};

//  REGISTRAR UN ABONO
export const registrarAbono = async (req, res) => {
    try {
        const { id_orden, monto, metodo_pago, observacion } = req.body;
        
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
        console.error('Error al registrar abono:', error);
        res.status(500).json({ error: 'Error al registrar el abono' });
    }
};

//  ELIMINAR UN ABONO
export const eliminarAbono = async (req, res) => {
    try {
        const { id } = req.params;
        await conmysql.query(`DELETE FROM abonos WHERE id_abono = ?`, [id]);
        res.json({ mensaje: 'Abono eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar abono:', error);
        res.status(500).json({ error: 'Error al eliminar el abono' });
    }
};

// ===== ELIMINAR SERVICIO =====
export const eliminarServicio = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar que el servicio no esté usado en órdenes
        const [usado] = await conmysql.query(
            'SELECT COUNT(*) as total FROM detalles_servicios WHERE id_servicio = ?',
            [id]
        );
        
        if (usado[0].total > 0) {
            return res.status(400).json({ 
                error: `No se puede eliminar. El servicio ha sido usado en ${usado[0].total} reparaciones.` 
            });
        }

        const [result] = await conmysql.query(
            'DELETE FROM servicios WHERE id_servicio = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Servicio no encontrado' });
        }

        res.json({ mensaje: 'Servicio eliminado con éxito' });
    } catch (error) {
        console.error('Error al eliminar servicio:', error);
        res.status(500).json({ error: 'Error al eliminar el servicio' });
    }
};