# Sistema de Inventario del Taller de Electrónica - Armada RD

Sistema full-stack para la gestión de inventario, órdenes de trabajo y custodia de herramientas del Taller de Electrónica de la Armada de República Dominicana.

## Tabla de contenidos

- [Descripción](#descripción)
- [Características](#características)
- [Stack tecnológico](#stack-tecnológico)
- [Requisitos previos](#requisitos-previos)
- [Instalación local](#instalación-local)
  - [Backend](#backend)
  - [Frontend](#frontend)
   - [Docker Compose](#docker-compose)
- [Uso](#uso)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Política de ramas](#política-de-ramas)
- [Despliegue](#despliegue)
- [Contribución](#contribución)
- [Documentación](#documentación)
- [Licencia](#licencia)

## Descripción

Este sistema permite al taller de electrónica:

- Controlar el inventario de componentes electrónicos con ubicaciones exactas y alertas de stock crítico.
- Gestionar órdenes de trabajo (OT) con numeración secuencial, asignación de técnicos, solicitud de repuestos y nota de entrega digital.
- Administrar la custodia diaria de herramientas de medición y soporte.
- Mantener una auditoría inmutable de todas las operaciones realizadas.

## Características

- **Autenticación y autorización:** JWT con tokens de sesión configurables, roles (admin, almacenista, técnico) y cierre de sesión por inactividad.
- **Seguridad de acceso:** cambio de contraseña con confirmación por correo, restablecimiento administrativo con contraseña temporal y notificación al registrar técnicos.
- **Inventario:** categorías, artículos, movimientos de stock, carga de imágenes, alertas de stock crítico, reportes PDF/Excel.
- **Órdenes de trabajo:** numeración `OT-YYYY-XXXXX`, solicitud/aprobación/consumo de repuestos, entrega con nota digital.
- **Herramientas:** préstamos diarios, devoluciones, bajas permanentes y detección de vencimientos.
- **Auditoría:** registro automático de creación, actualización y eliminación con usuario, IP y timestamp.
- **Búsqueda global:** barra de búsqueda con atajo `Ctrl + K`.
- **Dashboard:** estadísticas y gráficos del estado del taller.
- **Reportes:** generación de reportes en PDF y Excel para inventario, órdenes y herramientas.

## Stack tecnológico

### Backend
- Python
- Django + Django REST Framework
- Simple JWT para autenticación
- django-filter para filtros
- drf-spectacular para documentación OpenAPI
- SQLite en desarrollo / PostgreSQL en producción

### Frontend
- React 18
- Vite
- TailwindCSS
- Headless UI
- Heroicons
- Axios
- recharts (gráficos)

### Herramientas de desarrollo
- ESLint
- Prettier
- Git

## Requisitos previos

- Python 3.10+
- Node.js 18+
- npm o yarn
- Git

## Instalación local

### Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

El backend estará disponible en `http://127.0.0.1:8000/`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

El frontend estará disponible en `http://localhost:5173/`.

### Docker Compose

Levanta backend + frontend + PostgreSQL con un solo comando:

```bash
docker compose up --build
```

También puedes usar scripts de arranque:

```bash
# Linux/macOS/Git Bash
./start-docker.sh

# PowerShell
./start-docker.ps1
```

Servicios expuestos:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8001/api/v1/`
- Swagger/OpenAPI: `http://localhost:8001/api/v1/docs/`
- PostgreSQL: `localhost:5432`

### Docker Producción

Se incluye un perfil de producción con:

- Sin bind mounts de código.
- Frontend compilado y servido por Nginx.
- Proxy de Nginx para `/api`, `/media` y `/static` hacia backend.
- Healthchecks y orden de arranque por salud.

Archivos relevantes:

- `docker-compose.prod.yml`
- `.env.prod.example`
- `frontend/Dockerfile.prod`
- `frontend/nginx.prod.conf`

Pasos:

```bash
# 1) Crear archivo de entorno de producción
cp .env.prod.example .env.prod

# 2) Editar secretos y dominio real en .env.prod

# 3) Levantar perfil de producción
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

Scripts incluidos:

```bash
# Linux/macOS/Git Bash
./start-docker-prod.sh

# PowerShell
./start-docker-prod.ps1
```

Ver estado:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
```

### Correo SMTP

Las contraseñas temporales se envían mediante SMTP. Configura estas variables en `.env` para desarrollo o en `.env.prod` para producción:

```env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_HOST_USER=cuenta@dominio.com
EMAIL_HOST_PASSWORD=contraseña-de-aplicacion
EMAIL_USE_TLS=True
EMAIL_USE_SSL=False
DEFAULT_FROM_EMAIL=cuenta@dominio.com
```

Usa una contraseña de aplicación cuando el proveedor tenga autenticación multifactor. Para Gmail, cambia el host a `smtp.gmail.com`; para Microsoft 365 conserva `smtp.office365.com`. El puerto `587` usa TLS. No actives TLS y SSL al mismo tiempo.

Después de reiniciar los contenedores, verifica el envío sin mostrar la contraseña:

```bash
docker compose exec backend python manage.py shell -c "from django.core.mail import send_mail; print(send_mail('Prueba SMTP', 'Configuración correcta.', None, ['destino@dominio.com'], fail_silently=False))"
```

## Uso

1. Accede al frontend en el navegador.
2. Inicia sesión con el superusuario creado.
3. Desde el panel lateral navega entre Inventario, Órdenes de Trabajo, Herramientas y Auditoría.

> **Nota:** El backend en desarrollo usa SQLite. En producción configura `DATABASE_URL` para PostgreSQL y las variables de entorno de seguridad.

## Estructura del proyecto

```
.
├── backend/                 # API Django REST
│   ├── accounts/            # Usuarios, roles y autenticación JWT
│   ├── audit/               # Logs de auditoría
│   ├── config/              # Configuración de Django
│   ├── inventory/           # Inventario y movimientos de stock
│   ├── tools/               # Herramientas y préstamos
│   ├── utils/               # Utilidades (reportes)
│   ├── workorders/          # Órdenes de trabajo y repuestos
│   ├── manage.py
│   └── requirements.txt
├── frontend/                # Aplicación React
│   ├── public/
│   ├── src/
│   │   ├── components/      # Componentes reutilizables
│   │   ├── context/         # Contextos (Auth)
│   │   ├── pages/           # Páginas del sistema
│   │   ├── services/        # Llamadas a la API
│   │   ├── utils/           # Utilidades
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── .planning/               # Documentación de planificación
├── CLAUDE.md                # Contexto para agentes de IA
├── DESIGN.md                # Sistema de diseño
├── SPEC.md                  # Especificación funcional
└── README.md                # Este archivo
```

## Política de ramas

- **`main`**: Rama de producción / ambiente controlado. Solo se actualiza mediante Pull Requests aprobadas.
- **`develop`**: Rama de integración. Los nuevos compañeros trabajan aquí y crean Pull Requests desde sus feature branches.
- **Feature branches**: `feat/nombre-de-la-funcionalidad`, `fix/descripcion-del-bug`, `improvement/descripcion`.

### Flujo de trabajo

1. Actualiza `develop` localmente: `git pull origin develop`
2. Crea tu feature branch: `git checkout -b feat/mi-funcionalidad`
3. Realiza tus cambios y commits siguiendo el estilo del proyecto.
4. Sube tu rama: `git push origin feat/mi-funcionalidad`
5. Abre un Pull Request hacia `develop`.
6. Cuando `develop` esté estable, se fusiona a `main` mediante otro Pull Request.

## Despliegue

El proyecto usa una arquitectura dividida:

- **Frontend:** GitHub Pages (estático)
- **Backend:** Render (Python/Django + PostgreSQL)

### Frontend en GitHub Pages

El frontend se despliega automáticamente en GitHub Pages cada vez que se hace push a `main`.

**URL actual:** `https://lanxerz.github.io/SistemadeInventario-ARD/`

#### Configuración manual (primera vez)

1. Ve a **Settings → Pages** del repositorio.
2. En **Source** selecciona **GitHub Actions**.
3. El workflow `.github/workflows/deploy-frontend.yml` se encargará del resto.

### Backend en Render

El backend se despliega automáticamente en Render cada vez que se hace push a `main`.

#### Paso 1: Crear el servicio en Render

1. Inicia sesión en [Render](https://render.com/) con GitHub.
2. Desde el dashboard, selecciona **New → Blueprint**.
3. Conecta el repositorio `LanXerZ/SistemadeInventario-ARD`.
4. Render leerá el archivo `render.yaml` y creará:
   - Web service: `sistemadeinventario-ard-api`
   - Base de datos PostgreSQL: `sistemadeinventario-ard-db`
5. Espera a que el deploy inicial termine (puede tardar 5-10 minutos).

#### Paso 2: Crear superusuario en Render

Una vez desplegado, abre la shell del servicio en Render y ejecuta:

```bash
cd backend
python manage.py createsuperuser
python manage.py migrate
```

#### Paso 3: Configurar secretos en GitHub

Una vez que Render te dé la URL del backend (por ejemplo `https://sistemadeinventario-ard-api.onrender.com`):

1. Ve a **Settings → Secrets and variables → Actions** del repositorio.
2. Crea un nuevo secret **Repository secret** llamado `VITE_API_URL` con el valor:
   ```
   https://sistemadeinventario-ard-api.onrender.com/api/v1
   ```
3. (Opcional) Si quieres usar el deploy hook manual en lugar de `autoDeploy`, crea un secret `RENDER_DEPLOY_HOOK` con la URL del deploy hook de Render.

#### Paso 4: Redesplegar frontend

Haz un pequeño cambio en `main` (o ejecuta el workflow manualmente) para que el frontend se reconstruya con la nueva `VITE_API_URL`.

### Variables de entorno de producción

| Variable | Descripción | Configurado en |
|----------|-------------|----------------|
| `SECRET_KEY` | Clave secreta de Django | Render (generado automáticamente) |
| `DEBUG` | Modo debug | Render (`False`) |
| `DATABASE_URL` | URL de PostgreSQL | Render (desde la DB) |
| `CORS_ALLOWED_ORIGINS` | Orígenes permitidos | Render |
| `ALLOWED_HOSTS` | Hosts permitidos | Render |
| `VITE_API_URL` | URL del backend para el frontend | GitHub Secrets |

### Arquitectura de deploy

```
Push a main
    ├── Backend: Render Blueprint (autoDeploy)
    │   └── sistemadeinventario-ard-api.onrender.com
    └── Frontend: GitHub Actions
        └── lanxerz.github.io/SistemadeInventario-ARD/
```

## Contribución

1. Haz fork del repositorio (si corresponde).
2. Crea una rama desde `develop`.
3. Escribe código claro y sigue las convenciones existentes.
4. Asegúrate de que el backend pase sus tests: `cd backend && python manage.py test`
5. Asegúrate de que el frontend compile: `cd frontend && npm run build`
6. Abre un Pull Request con una descripción clara de los cambios.

## Documentación

- `CLAUDE.md` — Contexto y convenciones para agentes de IA.
- `DESIGN.md` — Sistema de diseño y guías visuales.
- `SPEC.md` — Especificación funcional detallada.
- `MANUAL_USUARIO.md` — Manual de usuario básico del sistema.
- `.planning/PROJECT.md` — Visión general del proyecto.
- `.planning/ROADMAP.md` — Hoja de ruta y fases completadas.
- `.planning/STATE.md` — Estado actual del proyecto.

## Endpoints clave

- `POST /api/v1/auth/change-password/` — Cambio de contraseña del usuario autenticado.
- `POST /api/v1/auth/admin-reset-password/` — Restablecimiento administrativo de contraseña.
- `GET|PUT /api/v1/settings/session/` — Consulta/actualiza el timeout global de sesión.
- `GET /api/v1/work-orders/despachos/{id}/receipt/?type=pdf` — Comprobante de despacho imprimible con firmas.
- `POST /api/v1/inventory/item-loans/{id}/return_unit/` — Registro de devolución de préstamo.
- `POST /api/v1/inventory/item-loans/{id}/extend/` — Extensión de préstamos.
- `GET /api/v1/inventory/item-loans/report/?type=pdf` — Reporte de préstamos con firmas.

## Licencia

Este proyecto es propiedad de la Armada de República Dominicana. Uso interno autorizado.
