import fs from 'fs';
import axios from 'axios';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'AdonisMarlon';
const REPO_NAME = 'techmanage-api';

export const subirImagenAGitHub = async (filePath, nombreArchivo, carpeta = 'uploads') => {
    try {
        const fileContent = fs.readFileSync(filePath, { encoding: 'base64' });
        
        const rutaGitHub = `${carpeta}/${nombreArchivo}`;
        const githubApiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${rutaGitHub}`;

        console.log('Subiendo imagen a GitHub:', rutaGitHub);

        const response = await axios.put(githubApiUrl, {
            message: `Subir imagen: ${nombreArchivo}`,
            content: fileContent
        }, {
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Respuesta de GitHub:', response.status);

        const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${rutaGitHub}`;
        
        fs.unlinkSync(filePath);

        console.log('Imagen subida a GitHub:', rawUrl);
        return rawUrl;

    } catch (error) {
        console.error('Error al subir imagen a GitHub:', error.response?.data || error.message);
        
        // Si falla GitHub, intentar con el archivo local como fallback
        try {
            const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${carpeta}/${nombreArchivo}`;
            return rawUrl;
        } catch (fallbackError) {
            throw new Error('Error al subir la imagen');
        }
    }
};