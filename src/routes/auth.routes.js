import { Router } from 'express';
import { login, registrarUsuario, guardarTokenFCM  } from '../controladores/authCtrl.js';
import { verificarToken } from '../middlewares/auth.js';

const router = Router();

// Rutas de autenticación
router.post('/login', login);
router.post('/registrar', registrarUsuario);

// Ruta protegida para guardar el token FCM (NUEVA)
router.post('/save-token', verificarToken, guardarTokenFCM);

// Ruta protegida
router.get('/perfil', verificarToken, (req, res) => {
    res.json({
        mensaje: "¡Acceso concedido! Tu token es válido.",
        datos_ocultos: req.user 
    });
});

export default router;