import { conmysql } from '../db.js';
import bcrypt from 'bcryptjs';
import { notificarNuevoUsuario } from '../services/notification.service.js';

// ============================================================
// OBTENER TECNICOS
// ============================================================
export const getTecnicos = async (req, res) => {
    try {
        const [result] = await conmysql.query(
            'SELECT id_usuario, nombre, correo, rol, estado FROM usuarios WHERE rol = "TECNICO" ORDER BY nombre ASC'
        );
        res.json(result);
    } catch (error) {
        console.error('[ERROR] getTecnicos:', error.message);
        res.status(500).json({ error: 'Error al obtener los tecnicos' });
    }
};

// ============================================================
// CREAR USUARIO (SOLO ADMIN)
// - Notifica al admin cuando se crea un nuevo usuario
// ============================================================
export const crearUsuario = async (req, res) => {
    try {
        const { nombre, correo, password, rol } = req.body;
        const adminNombre = req.user?.nombre || 'Admin';
        
        const salt = await bcrypt.genSalt(10);
        const passwordEncriptada = await bcrypt.hash(password, salt);

        const [result] = await conmysql.query(
            'INSERT INTO usuarios (nombre, correo, password, rol) VALUES (?, ?, ?, ?)',
            [nombre, correo, passwordEncriptada, rol || 'TECNICO']
        );

        //NOTIFICACIÓN: Nuevo usuario creado
        try {
            await notificarNuevoUsuario(
                conmysql,
                { nombre, rol: rol || 'TECNICO' },
                adminNombre
            );
            console.log('[FCM] Notificacion de nuevo usuario enviada al admin');
        } catch (notifError) {
            console.error('[ERROR] notificarNuevoUsuario:', notifError.message);
        }

        res.status(201).json({ 
            mensaje: 'Usuario creado con éxito', 
            id_usuario: result.insertId 
        });
    } catch (error) {
        console.error('[ERROR] crearUsuario:', error.message);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'El correo ya está registrado' });
        }
        res.status(500).json({ error: 'Error al crear el usuario' });
    }
};

// ============================================================
// ACTUALIZAR USUARIO (SOLO ADMIN)
// ============================================================
export const actualizarUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, correo, estado } = req.body;
        const adminNombre = req.user?.nombre || 'Admin';

        // Obtener datos anteriores para la notificación
        const [usuarioAnterior] = await conmysql.query(
            'SELECT nombre, rol FROM usuarios WHERE id_usuario = ?',
            [id]
        );

        const [result] = await conmysql.query(
            'UPDATE usuarios SET nombre = ?, correo = ?, estado = ? WHERE id_usuario = ?',
            [nombre, correo, estado, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // NOTIFICACIÓN: Usuario editado (opcional, si quieres notificar)
        // Puedes agregar una función notificarUsuarioEditado si lo deseas
        // Por ahora solo log
        console.log(`[FCM] Usuario ${usuarioAnterior[0]?.nombre || 'N/A'} actualizado por ${adminNombre}`);

        res.json({ mensaje: 'Usuario actualizado con éxito' });
    } catch (error) {
        console.error('[ERROR] actualizarUsuario:', error.message);
        res.status(500).json({ error: 'Error al actualizar el usuario' });
    }
};

// ============================================================
// ELIMINAR USUARIO (SOLO ADMIN)
// ============================================================
export const eliminarUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const adminNombre = req.user?.nombre || 'Admin';
        
        // No permitir eliminar al admin principal
        const [usuario] = await conmysql.query(
            'SELECT rol, nombre FROM usuarios WHERE id_usuario = ?',
            [id]
        );
        
        if (usuario.length > 0 && usuario[0].rol === 'ADMIN') {
            return res.status(400).json({ error: 'No se puede eliminar un usuario administrador' });
        }

        const [result] = await conmysql.query(
            'DELETE FROM usuarios WHERE id_usuario = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // NOTIFICACIÓN: Usuario eliminado (opcional)
        console.log(`[FCM] Usuario ${usuario[0]?.nombre || 'N/A'} eliminado por ${adminNombre}`);

        res.json({ mensaje: 'Usuario eliminado con éxito' });
    } catch (error) {
        console.error('[ERROR] eliminarUsuario:', error.message);
        res.status(500).json({ error: 'Error al eliminar el usuario' });
    }
};

// ============================================================
// CAMBIAR CONTRASEÑA (Admin)
// ============================================================
export const cambiarPasswordAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { nuevaPassword } = req.body;

        if (!nuevaPassword || nuevaPassword.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordEncriptada = await bcrypt.hash(nuevaPassword, salt);

        const [result] = await conmysql.query(
            'UPDATE usuarios SET password = ? WHERE id_usuario = ?',
            [passwordEncriptada, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ mensaje: 'Contraseña actualizada con éxito' });
    } catch (error) {
        console.error('[ERROR] cambiarPasswordAdmin:', error.message);
        res.status(500).json({ error: 'Error al cambiar la contraseña' });
    }
};

// ============================================================
// CAMBIAR PROPIA CONTRASEÑA (Técnico)
// ============================================================
export const cambiarPasswordPropio = async (req, res) => {
    try {
        const userId = req.user.id;
        const { passwordActual, nuevaPassword } = req.body;

        if (!passwordActual || !nuevaPassword) {
            return res.status(400).json({ error: 'Debe ingresar la contraseña actual y la nueva' });
        }

        if (nuevaPassword.length < 6) {
            return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
        }

        // Verificar contraseña actual
        const [usuario] = await conmysql.query(
            'SELECT password FROM usuarios WHERE id_usuario = ?',
            [userId]
        );

        if (usuario.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const passwordValida = await bcrypt.compare(passwordActual, usuario[0].password);
        if (!passwordValida) {
            return res.status(401).json({ error: 'Contraseña actual incorrecta' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordEncriptada = await bcrypt.hash(nuevaPassword, salt);

        await conmysql.query(
            'UPDATE usuarios SET password = ? WHERE id_usuario = ?',
            [passwordEncriptada, userId]
        );

        res.json({ mensaje: 'Contraseña actualizada con éxito' });
    } catch (error) {
        console.error('[ERROR] cambiarPasswordPropio:', error.message);
        res.status(500).json({ error: 'Error al cambiar la contraseña' });
    }
};