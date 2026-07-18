import jwt from 'jsonwebtoken';

export const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(403).json({ error: 'Falta el token de autorización' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Token inválido o expirado' });
        }
        
        req.user = decoded;
        next(); 
    });
};


// ===== VERIFICAR QUE SEA ADMIN =====
export const verificarAdmin = (req, res, next) => {
    if (req.user && req.user.rol === 'ADMIN') {
        next();
    } else {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
    }
};

// ===== VERIFICAR QUE SEA ADMIN O EL PROPIO TECNICO =====
export const verificarAdminOrTecnicoPropio = (req, res, next) => {
    if (req.user && req.user.rol === 'ADMIN') {
        return next();
    }
    
    // Si es TECNICO, pasar al controlador para verificar si es suyo
    // El controlador usará req.user.id para validar
    next();
};