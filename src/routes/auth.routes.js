import { Router } from 'express';
import { login, registrarUsuario } from '../controladores/authCtrl.js';
import { verificarToken } from '../middlewares/auth.js';

const router = Router();

// Rutas de autenticación
router.post('/login', login);
router.post('/registrar', registrarUsuario);

// Ruta protegida
router.get('/perfil', verificarToken, (req, res) => {
    res.json({
        mensaje: "¡Acceso concedido! Tu token es válido.",
        datos_ocultos: req.user 
    });
});

export default router;