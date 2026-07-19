import { Router } from 'express';
import { verificarToken, verificarAdmin } from '../middlewares/auth.js';
import {
    crearSolicitudRepuesto,
    crearSolicitudServicio,
    crearSolicitudTipoEquipo,
    getSolicitudesRepuestos,
    getSolicitudesServicios,
    getSolicitudesTiposEquipo,
    aprobarSolicitudRepuesto,
    aprobarSolicitudServicio,
    aprobarSolicitudTipoEquipo,
    rechazarSolicitud
} from '../controladores/solicitudesCtrl.js';

const router = Router();

// ==================== CREAR SOLICITUDES (Técnico) ====================
router.post('/solicitudes/repuestos', verificarToken, crearSolicitudRepuesto);
router.post('/solicitudes/servicios', verificarToken, crearSolicitudServicio);
router.post('/solicitudes/tipos-equipo', verificarToken, crearSolicitudTipoEquipo);

// ==================== VER SOLICITUDES (Admin) ====================
router.get('/solicitudes/repuestos', verificarToken, verificarAdmin, getSolicitudesRepuestos);
router.get('/solicitudes/servicios', verificarToken, verificarAdmin, getSolicitudesServicios);
router.get('/solicitudes/tipos-equipo', verificarToken, verificarAdmin, getSolicitudesTiposEquipo);

// ==================== APROBAR SOLICITUDES (Admin) ====================
router.post('/solicitudes/repuestos/:id/aprobar', verificarToken, verificarAdmin, aprobarSolicitudRepuesto);
router.post('/solicitudes/servicios/:id/aprobar', verificarToken, verificarAdmin, aprobarSolicitudServicio);
router.post('/solicitudes/tipos-equipo/:id/aprobar', verificarToken, verificarAdmin, aprobarSolicitudTipoEquipo);

// ==================== RECHAZAR SOLICITUDES (Admin) ====================
router.delete('/solicitudes/:id', verificarToken, verificarAdmin, rechazarSolicitud);

export default router;