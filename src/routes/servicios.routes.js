import { Router } from 'express';
import { getServicios, getServicioById, crearServicio, actualizarServicio, eliminarServicio } from '../controladores/serviciosCtrl.js';
import { verificarToken, verificarAdmin } from '../middlewares/auth.js';

const router = Router();

// Todos los autenticados pueden ver servicios
router.get('/servicios', verificarToken, getServicios);
router.get('/servicios/:id', verificarToken, getServicioById);

// Solo ADMIN puede gestionar servicios
router.post('/servicios', verificarToken, verificarAdmin, crearServicio);
router.put('/servicios/:id', verificarToken, verificarAdmin, actualizarServicio);
router.delete('/servicios/:id', verificarToken, verificarAdmin, eliminarServicio);

export default router;