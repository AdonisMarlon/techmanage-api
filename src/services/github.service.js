import fs from 'fs';
import axios from 'axios';

// Variables de entorno
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'AdonisMarlon';
const REPO_NAME = 'techmanage-api';

export const subirImagenAGitHub = async (filePath, nombreArchivo, carpeta = 'uploads') => {
    try {
        // 1. Leer el archivo y convertirlo a Base64
        const fileContent = fs.readFileSync(filePath, { encoding: 'base64' });
        
        // 2. Ruta en GitHub
        const rutaGitHub = `${carpeta}/${nombreArchivo}`;
        const githubApiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${rutaGitHub}`;

        console.log('📤 Subiendo imagen a GitHub:', rutaGitHub);

        // 3. Subir a GitHub
        await axios.put(githubApiUrl, {
            message: `Subir imagen: ${nombreArchivo}`,
            content: fileContent
        }, {
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        // 4. URL pública raw de GitHub
        const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${rutaGitHub}`;
        
        // 5. Eliminar archivo temporal
        fs.unlinkSync(filePath);

        console.log('Imagen subida a GitHub:', rawUrl);
        return rawUrl;

    } catch (error) {
        console.error('Error al subir imagen a GitHub:', error.response?.data || error.message);
        throw new Error('Error al subir la imagen');
    }
};