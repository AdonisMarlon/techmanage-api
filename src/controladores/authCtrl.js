import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { conmysql } from '../db.js';

// ===== LOGIN =====
export const login = async (req, res) => {
    try {
        const { correo, password } = req.body;

        const [result] = await conmysql.query(
            'SELECT id_usuario, nombre, correo, password, rol, estado FROM usuarios WHERE correo = ?',
            [correo]
        );

        if (result.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const user = result[0];

        if (user.estado === 0) {
            return res.status(403).json({ error: 'Usuario inactivo. Contacte al administrador.' });
        }

        const passwordValida = await bcrypt.compare(password, user.password);

        if (!passwordValida) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        const token = jwt.sign(
            { 
                id: user.id_usuario, 
                correo: user.correo, 
                rol: user.rol 
            }, 
            process.env.JWT_SECRET, 
            { expiresIn: '2h' }
        );

        return res.json({ 
            mensaje: 'Login exitoso', 
            token: token,
            usuario: {
                id: user.id_usuario,
                nombre: user.nombre,
                correo: user.correo,
                rol: user.rol
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        return res.status(500).json({ error: 'Error en el servidor al hacer login' });
    }
};

// ===== REGISTRAR USUARIO (solo Admin) =====
export const registrarUsuario = async (req, res) => {
    try {
        const { nombre, correo, password, rol } = req.body;
        
        const salt = await bcrypt.genSalt(10);
        const passwordEncriptada = await bcrypt.hash(password, salt);

        const [result] = await conmysql.query(
            'INSERT INTO usuarios (nombre, correo, password, rol) VALUES (?, ?, ?, ?)',
            [nombre, correo, passwordEncriptada, rol || 'TECNICO']
        );

        res.status(201).json({ 
            mensaje: 'Usuario registrado con éxito', 
            id_usuario: result.insertId 
        });
        
    } catch (error) {
        console.error('Error al registrar usuario:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'El correo ya está registrado' });
        }
        res.status(500).json({ error: 'Error al registrar el usuario' });
    }
};

// GUARDAR TOKEN FCM DEL USUARIO (NUEVO)
export const guardarTokenFCM = async (req, res) => {
    try {
        console.log('🔵 1. Llegó a guardarTokenFCM');
        console.log('🔵 2. Body:', req.body);
        
        const { fcmToken } = req.body;
        const userId = req.user.id;
        
        console.log('🔵 3. Token recibido:', fcmToken);
        console.log('🔵 4. Usuario ID:', userId);

        if (!fcmToken) {
            console.log('🔴 5. Error: Token FCM es requerido');
            return res.status(400).json({ error: 'Token FCM es requerido' });
        }

        const [result] = await conmysql.query(
            'UPDATE usuarios SET fcm_token = ? WHERE id_usuario = ?',
            [fcmToken, userId]
        );

        console.log('🔵 6. Resultado de la consulta:', result);

        if (result.affectedRows === 0) {
            console.log('🔴 7. Error: Usuario no encontrado');
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        console.log('🟢 8. Token guardado correctamente para usuario:', userId);
        res.json({
            mensaje: 'Token FCM guardado correctamente',
            id_usuario: userId
        });
    } catch (error) {
        console.error('🔴 9. Error al guardar token FCM:', error);
        res.status(500).json({ error: 'Error al guardar token' });
    }
};