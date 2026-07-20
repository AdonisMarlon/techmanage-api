import { Router } from 'express';
import { getEquipos, getEquipoById, crearEquipo, actualizarEquipo, eliminarEquipo,subirImagenEquipo  } from '../controladores/equiposCtrl.js';
import { verificarToken, verificarAdmin } from '../middlewares/auth.js';

const router = Router();

router.get('/equipos', verificarToken, getEquipos);
router.get('/equipos/:id', verificarToken, getEquipoById);
router.post('/equipos', verificarToken, crearEquipo);
router.put('/equipos/:id', verificarToken, actualizarEquipo);

// Solo ADMIN puede eliminar equipos
router.delete('/equipos/:id', verificarToken, verificarAdmin, eliminarEquipo);

//subir imagen 
router.post('/equipos/:id/imagen', verificarToken, upload.single('imagen'), subirImagenEquipo);

export default router;