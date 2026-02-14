# 🚀 Guía de Despliegue en Vercel

Tu proyecto ya está preparado para desplegarse en **Vercel**. Sigue estos pasos:

## 1. Subir a GitHub
Asegúrate de que tu código está subido a un repositorio de GitHub.

## 2. Crear Proyecto en Vercel
1. Ve a [Vercel Dashboard](https://vercel.com/dashboard).
2. Haz clic en **"Add New..."** -> **"Project"**.
3. Importa tu repositorio de GitHub.

## 3. Configuración del Proyecto
Vercel detectará automáticamente que es un proyecto **Vite**.
- **Framework Preset**: Vite
- **Root Directory**: `./` (la raíz)

## 4. Variables de Entorno (Environment Variables)
Es **CRUCIAL** que añadas las siguientes variables en la sección "Environment Variables" de Vercel (copia los valores de tu fichero `.env`):

| Variable | Descripción |
|----------|-------------|
| `GEMINI_API_KEY` | Tu clave de API de Google Gemini |
| `GEMINI_MODEL` | `gemini-2.0-flash` (o el que uses) |
| `SUPABASE_URL` | URL de tu proyecto Supabase |
| `SUPABASE_SERVICE_ROLE` | Clave secreta (service_role) de Supabase |

> **Nota:** No necesitas añadir `SUPABASE_KEY` (anon) si no la usas en el frontend. El frontend ahora se comunica exclusivamente a través de la API (`/api/...`).

## 5. Desplegar
Haz clic en **"Deploy"**.

### Verificación
Una vez desplegado:
1. Abre la URL que te da Vercel.
2. Verifica que cargan los temas (esto confirma que la API `/api/topics` conecta con Supabase).
3. Prueba a entrar en un tema y enviar una respuesta.

## Solución de Problemas
- Si obtienes error **500** en la API, revisa los "Function Logs" en Vercel. Normalmente es porque falta alguna variable de entorno.
- Si obtienes **404** en la API, asegúrate de que el archivo `vercel.json` está en la raíz del proyecto.
