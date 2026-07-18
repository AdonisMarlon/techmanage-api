import { Router } from 'express';
import { actualizarOrden, getOrdenes, getOrdenById, crearOrden, actualizarEstadoOrden 
    ,getRepuestosByOrden, agregarRepuestoAOrden, eliminarRepuestoDeOrden, actualizarCantidadRepuesto,
    getServiciosByOrden,
    agregarServicioAOrden,
    eliminarServicioDeOrden,
    getAbonosByOrden, registrarAbono, eliminarAbono,getOrdenesPorEstado,
    getOrdenesHoy,
    getIngresosMes,
    getRepuestosMasUsados, getHistorialEstados, 
    getUltimasOrdenes, getOrdenesByCliente, getOrdenesPorEstadoFiltrado,
    verificarGarantia,           
    getGarantiasPorVencer,       
    getGarantiasVencidas,        
    getResumenGarantias  

} from '../controladores/ordenesCtrl.js';
import { verificarToken } from '../middlewares/auth.js';

const router = Router();

// Todas las rutas protegidas
// ==================== ORDENES ====================
router.get('/ordenes', verificarToken, getOrdenes);
router.get('/ordenes/:id', verificarToken, getOrdenById);
router.post('/ordenes', verificarToken, crearOrden);
router.put('/ordenes/:id', verificarToken, actualizarOrden);
router.put('/ordenes/:id/estado', verificarToken, actualizarEstadoOrden);


// ==================== REPUESTOS ====================
router.get('/ordenes/:id/repuestos', verificarToken, getRepuestosByOrden);
router.post('/ordenes/repuestos', verificarToken, agregarRepuestoAOrden);
router.put('/detalles-reparacion/:id', verificarToken, actualizarCantidadRepuesto);
router.delete('/detalles-reparacion/:id', verificarToken, eliminarRepuestoDeOrden);

// ==================== SERVICIOS ====================
router.get('/ordenes/:id/servicios', verificarToken, getServiciosByOrden);
router.post('/ordenes/servicios', verificarToken, agregarServicioAOrden);
router.delete('/detalles-servicios/:id', verificarToken, eliminarServicioDeOrden);

// ==================== ABONOS ====================
router.get('/ordenes/:id/abonos', verificarToken, getAbonosByOrden);   
router.post('/abonos', verificarToken, registrarAbono);                 
router.delete('/abonos/:id', verificarToken, eliminarAbono); 

// ==================== DASHBOARD ====================
router.get('/dashboard/ordenes-estado', verificarToken, getOrdenesPorEstado);
router.get('/dashboard/ordenes-hoy', verificarToken, getOrdenesHoy);
router.get('/dashboard/ingresos-mes', verificarToken, getIngresosMes);
router.get('/dashboard/repuestos-top', verificarToken, getRepuestosMasUsados);
router.get('/dashboard/ultimas-ordenes', verificarToken, getUltimasOrdenes);
router.get('/dashboard/ordenes-filtradas/:estado', verificarToken, getOrdenesPorEstadoFiltrado);

// ==================== GARANTÍAS ====================  NUEVA SECCIÓN
router.get('/ordenes/:id/garantia', verificarToken, verificarGarantia);
router.get('/garantias/por-vencer', verificarToken, getGarantiasPorVencer);
router.get('/garantias/vencidas', verificarToken, getGarantiasVencidas);
router.get('/garantias/resumen', verificarToken, getResumenGarantias);



// ==================== CLIENTES ====================
router.get('/clientes/:id/ordenes', verificarToken, getOrdenesByCliente);



router.get('/ordenes/:id/historial', verificarToken, getHistorialEstados);

export default router;