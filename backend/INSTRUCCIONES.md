# Backend Células J&L — Despliegue y acceso por roles

Guía para activar el control de acceso por ministerio (roles `admin` / `lider12`).
El código del backend está en [`Codigo.gs`](Codigo.gs).

---

## 1. Pegar el código en Apps Script

1. Abre el proyecto **"Células J&L - Backend"** en [script.google.com](https://script.google.com).
2. En `Código.gs`: selecciona todo (Ctrl+A), borra y **pega** el contenido de [`Codigo.gs`](Codigo.gs).
3. Guarda (Ctrl+S).

## 2. Crear la hoja "Usuarios" (una sola vez)

1. En el selector de funciones (arriba, donde dice `geocodificarTodas`), elige **`crearHojaUsuarios`**.
2. Clic en **▶ Ejecutar**. La primera vez **autoriza los permisos** con tu cuenta.
3. Esto crea automáticamente la pestaña **`Usuarios`** dentro del Google Sheets de **Inscripciones**, con encabezados y 3 filas de ejemplo.

> No es un archivo nuevo: `Usuarios` es una **pestaña** dentro del spreadsheet de Inscripciones
> (`SHEET_INSCRIPCIONES_ID`). El backend la lee de ahí.

## 3. Llenar la hoja "Usuarios"

Abre la pestaña `Usuarios` y reemplaza las filas de ejemplo por las reales:

| Clave            | Rol       | Lider12        | Nombre                        |
|------------------|-----------|----------------|-------------------------------|
| (clave secreta)  | `admin`   | *(vacío)*      | Ps Jhonatan y Leidy Herrera   |
| (clave secreta)  | `admin`   | *(vacío)*      | Juan David Correa             |
| (clave secreta)  | `lider12` | Aleja Leiva    | Aleja Leiva                   |
| (clave secreta)  | `lider12` | Camila Patiño  | Camila Patiño                 |
| ...              | `lider12` | (su L12)       | (su nombre de líder)          |

**Qué va en cada columna:**

- **Clave** → contraseña secreta y única de esa persona (cualquier texto, ej. `aleja2026`). Es lo que escribe al entrar al dashboard.
- **Rol** → `admin` (ve todo) o `lider12` (ve solo su ministerio + su célula).
- **Lider12** → solo para `lider12`: su nombre de Líder de 12 **tal cual** aparece en el formulario (con tildes). Para `admin` déjala vacía.
- **Nombre** → el "Nombre Líder" de su propia célula, tal cual lo escribió al inscribirse.

### Juan David Correa (admin + su ministerio)

Una sola fila con rol `admin`. Dentro del dashboard usa el selector **L12** de arriba
para alternar entre "Todos los ministerios" y "Juan David Correa" (esa vista ya incluye
su propia célula).

| Clave           | Rol     | Lider12   | Nombre            |
|-----------------|---------|-----------|-------------------|
| (clave secreta) | `admin` | *(vacío)* | Juan David Correa |

## 4. Re-desplegar

1. Botón **Implementar** → **Gestionar implementaciones**.
2. Clic en el **lápiz ✏️** de la implementación actual.
3. **Versión → Nueva versión** → **Implementar**.

> ⚠️ Edita la implementación **que ya existe** (no crees una nueva), así la URL no cambia
> y el dashboard sigue funcionando sin tocar nada.

## 5. Probar

- Clave de un líder → debe ver **solo su ministerio** y arriba "👤 Viendo el ministerio de...".
- Clave `admin` → ve todo, con el selector "Todos los ministerios".
- La clave maestra **`celulas2025`** sigue entrando como admin (compatibilidad), por si
  quieres confirmar que nada se rompió antes de configurar usuarios.

---

## Errores comunes

- **Un líder entra y ve todo vacío** → casi siempre el texto de `Lider12` o `Nombre` no
  coincide **exactamente** (una tilde, un espacio, una mayúscula) con lo que está en los datos.
- **"No autorizado"** → la clave no existe en la hoja `Usuarios` (o no re-desplegaste con
  nueva versión).
- **La hoja no se actualiza** → recuerda el paso 4 (nueva versión); Apps Script no aplica
  cambios hasta re-desplegar.

## Notas de seguridad

- El filtrado es **del lado del servidor**: un `lider12` nunca recibe datos de otros
  ministerios (no basta con abrir las herramientas del navegador).
- Pendiente: la clave viaja en la URL (`?pass=...`). Conviene moverla a POST más adelante.
