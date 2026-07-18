import { conmysql } from '../db.js';

// 1. Obtener todos los clientes
export const getClientes = async (req, res) => {
    try {
        const [result] = await conmysql.query('SELECT * FROM clientes ORDER BY fecha_registro DESC');
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener los clientes' });
    }
};

// 2. Obtener un cliente por su ID
export const getClienteById = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query('SELECT * FROM clientes WHERE id_cliente = ?', [id]);
        
        if (result.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        res.json(result[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener el cliente' });
    }
};

// 3. Crear un nuevo cliente
export const crearCliente = async (req, res) => {
    try {
        const { cedula, nombre_completo, telefono, correo, direccion } = req.body;
        
        // Insertar en la base de datos
        const [result] = await conmysql.query(
            'INSERT INTO clientes (cedula, nombre_completo, telefono, correo, direccion) VALUES (?, ?, ?, ?, ?)',
            [cedula, nombre_completo, telefono, correo, direccion]
        );

        res.status(201).json({ 
            mensaje: 'Cliente registrado con éxito', 
            id_cliente: result.insertId 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al registrar el cliente. Verifica que la cédula no esté duplicada.' });
    }
    
};

// 4. Actualizar datos de un cliente
export const actualizarCliente = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre_completo, telefono, correo, direccion } = req.body;
        
        await conmysql.query(
            'UPDATE clientes SET nombre_completo = ?, telefono = ?, correo = ?, direccion = ? WHERE id_cliente = ?',
            [nombre_completo, telefono, correo, direccion, id]
        );

        res.json({ mensaje: 'Cliente actualizado con éxito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar el cliente' });
    }
};

// ==================== BUSCAR CLIENTES ====================
export const buscarClientes = async (req, res) => {
    try {
        const { q } = req.query;
        
        // Si no hay término de búsqueda, devolver array vacío
        if (!q || q.trim() === '') {
            return res.json([]);
        }
        
        const termino = `%${q.trim()}%`;
        const [result] = await conmysql.query(
            `SELECT * FROM clientes 
            WHERE cedula LIKE ? 
            OR nombre_completo LIKE ? 
            OR telefono LIKE ?
            ORDER BY nombre_completo ASC
            LIMIT 20`,
            [termino, termino, termino]
        );
        res.json(result);
    } catch (error) {
        console.error('Error al buscar clientes:', error);
        res.status(500).json({ error: 'Error al buscar clientes' });
    }
};

// ===== ELIMINAR CLIENTE =====
export const eliminarCliente = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar que el cliente no tenga órdenes activas
        const [ordenes] = await conmysql.query(
            'SELECT COUNT(*) as total FROM ordenes_trabajo WHERE id_cliente = ?',
            [id]
        );
        
        if (ordenes[0].total > 0) {
            return res.status(400).json({ 
                error: `No se puede eliminar. El cliente tiene ${ordenes[0].total} órdenes asociadas.` 
            });
        }

        const [result] = await conmysql.query(
            'DELETE FROM clientes WHERE id_cliente = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        res.json({ mensaje: 'Cliente eliminado con éxito' });
    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        res.status(500).json({ error: 'Error al eliminar el cliente' });
    }
};