# PV Servicios · pvalencia.cl

Sitio web de **PV Servicios** (Don Pedro, maestro a domicilio) con panel de
administración para publicar trabajos y fotos.

- **Sitio público** (`index.html`): servicios, galería de trabajos con filtros y visor de fotos, contacto por WhatsApp.
- **Panel admin** (`admin.html`): ingreso con correo y contraseña, crear / editar / eliminar trabajos, subir y ordenar fotos, dejar trabajos como borrador.
- **Backend**: [Supabase](https://supabase.com) (base de datos, usuarios y almacenamiento de fotos). El sitio es HTML/CSS/JS sin compilación, publicado en GitHub Pages.

Mientras Supabase no esté conectado, el sitio público funciona igual mostrando
los trabajos de `data/proyectos.json`; solo el panel admin queda deshabilitado.

## 1. Conectar Supabase (una sola vez, ~10 minutos)

1. Crea una cuenta gratis en <https://supabase.com> y un proyecto nuevo (región *South America (São Paulo)*).
2. En **SQL Editor**, pega y ejecuta completo `supabase/schema.sql`. Después ejecuta `supabase/seed.sql` (una sola vez) para cargar los trabajos que ya existían.
3. En **Authentication → Users → Add user**, crea las cuentas de administrador (la tuya y la de tu papá) con correo y contraseña, marcando *Auto Confirm User*.
4. Dales el rol admin. En **SQL Editor**:

   ```sql
   update public.profiles set role = 'admin'
   where email in ('correo-papa@ejemplo.cl', 'tu-correo@ejemplo.cl');
   ```

5. En **Authentication → Sign In / Providers**, desactiva *Allow new users to sign up* (nadie más necesita registrarse).
6. En **Authentication → URL Configuration**, pon `https://pvalencia.cl` como *Site URL* y agrega `https://pvalencia.cl/admin.html` en *Redirect URLs* (lo usa "Olvidé mi contraseña").
7. En **Project Settings → API**, copia la *Project URL* y la clave *anon / publishable* y pégalas en `js/config.js`:

   ```js
   supabaseUrl: 'https://xxxxxxxx.supabase.co',
   supabaseAnonKey: 'eyJ... o sb_publishable_...',
   ```

   Estas dos claves son públicas por diseño y pueden estar en el repositorio.
   **Nunca** pegues aquí la clave `service_role` / *secret*.

## 2. Publicar en GitHub Pages con pvalencia.cl

1. En el repositorio: **Settings → Pages → Build and deployment → Deploy from a branch**, rama `main`, carpeta `/ (root)`.
2. En el mismo lugar, en **Custom domain**, escribe `pvalencia.cl` y guarda.
3. En el proveedor de DNS del dominio crea estos registros:

   | Tipo  | Nombre | Valor                 |
   |-------|--------|-----------------------|
   | A     | `@`    | `185.199.108.153`     |
   | A     | `@`    | `185.199.109.153`     |
   | A     | `@`    | `185.199.110.153`     |
   | A     | `@`    | `185.199.111.153`     |
   | CNAME | `www`  | `<usuario>.github.io` |

   NIC Chile solo registra el dominio; los registros se crean en un servicio de
   DNS (por ejemplo Cloudflare, plan gratis) y en NIC Chile se anotan los
   servidores de nombre de ese servicio.
4. Cuando GitHub valide el dominio, activa **Enforce HTTPS**.

## Cómo usa el panel tu papá

1. Entra a `pvalencia.cl/admin.html` (hay un enlace "Acceso administrador" al pie del sitio).
2. **+ Nuevo trabajo** → título, descripción, tipo de trabajo y **+ Agregar fotos** (puede elegir varias desde la galería del celular).
3. Con las flechas ordena las fotos; la primera es la portada. **Guardar**.

Las fotos se achican automáticamente a 1600 px antes de subirse, así que no
importa que vengan pesadas desde el celular.

## Roles y seguridad

- Los permisos se aplican en la base de datos con *Row Level Security*, no en el navegador: aunque alguien manipule la página, Supabase rechaza cualquier cambio de un usuario que no sea `admin`.
- Visitantes: solo leen trabajos publicados. Usuarios sin rol admin: lo mismo. Admin: todo.
- El rol solo se cambia desde el SQL Editor de Supabase; nadie puede asignárselo desde la web.

## Estructura

```
index.html, admin.html     páginas
css/, js/                  estilos y lógica (js/config.js = claves y WhatsApp)
data/proyectos.json        trabajos de respaldo si Supabase no responde
images/                    fotos originales del sitio anterior
supabase/schema.sql        tablas, roles y permisos
supabase/seed.sql          trabajos iniciales
vendor/, fonts/            cliente de Supabase y tipografías, incluidos en el sitio
.github/workflows/         consulta periódica para que Supabase no se pause
```

Para probar en tu computador: `python3 -m http.server` dentro de la carpeta y abre <http://localhost:8000>.
