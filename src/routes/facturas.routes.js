import { Router } from 'express';
import { agregarRepuestoAOrden, agregarServicioAOrden, registrarAbono, generarFactura, getFacturaByOrden   } from '../controladores/facturasCtrl.js';
import { verificarToken } from '../middlewares/auth.js';

const router = Router();

// Todas las rutas financieras protegidas
router.post('/ordenes/repuestos', verificarToken, agregarRepuestoAOrden);
router.post('/ordenes/servicios', verificarToken, agregarServicioAOrden);
router.post('/abonos', verificarToken, registrarAbono);
router.post('/facturas', verificarToken, generarFactura);
router.get('/ordenes/:id/factura', verificarToken, getFacturaByOrden);


export default router;