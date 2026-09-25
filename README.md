# Logia Masónica PWA — Sistema Integral de Gestión

Aplicación web progresiva (PWA) de nivel de producción diseñada para la administración privada, protocolar y documental de una logia masónica (Resp.·. Log.·. Unión Fraternal No. 21, Valle de Panamá, bajo la jurisdicción de la Gran Logia de Panamá).

El sistema respeta rigurosamente las tradiciones masónicas, la jerarquía de oficiales, la confidencialidad de los trazados por grado, la trazabilidad de acuerdos, y la normativa de protección de datos de la **República de Panamá (Ley 81 de 2019)**.

---

## 🏛️ Stack Tecnológico

- **Frontend**: React 18, TypeScript, Vite
- **Estilos y Diseño**: Tailwind CSS, Shadcn UI, Radix Primitives
- **Identidad Visual**: Fondo marfil cálido (`#FBF9F5`), Borgoña/Rojo vino (`#6B1F2E`), Acento Dorado Champaña (`#C5A059`), tipografías *Newsreader* (serif protocolar) e *Inter* (sans-serif para interfaz)
- **Rutas**: React Router 7 (`createBrowserRouter`)
- **Backend & DB**: Supabase (PostgreSQL, Row Level Security, Triggers, Storage y Auth)
- **Formularios & Validación**: React Hook Form con Zod
- **Iconografía**: Lucide React
- **Pruebas**: Vitest

---

## 🚀 Inicio Rápido e Instalación

### 1. Requisitos Previos

- Node.js 18+ o 20+
- npm 9+
- Una instancia o proyecto en [Supabase](https://supabase.com)

### 2. Instalación de Dependencias

```bash
npm install
```

### 3. Configuración del Entorno

Copia el archivo de ejemplo y configura tus claves:

```bash
cp .env.example .env
```

Variables disponibles:

| Variable | Propósito | Obligatorio |
|---|---|---|
| `VITE_SUPABASE_URL` | URL de tu proyecto Supabase | Sí (para persistencia en nube) |
| `VITE_SUPABASE_ANON_KEY` | Clave anónima pública de Supabase | Sí (para persistencia en nube) |
| `VITE_IDENTITY_PROVIDER` | Proveedor biométrico (`internal_liveness`, `onfido`, etc.) | Opcional |
| `VITE_IDENTITY_API_KEY` | Clave API del proveedor de identidad externo | Opcional (si se integra proveedor externo) |
| `VITE_EMAIL_PROVIDER` | Proveedor transaccional (`resend`, `sendgrid`) | Opcional |

> **Nota de seguridad:** Si las variables de Supabase no están configuradas en `.env`, el sistema utiliza un modo demostrativo seguro y auditable sin credenciales falsas en producción. Al configurar tus claves en `.env`, el sistema se enlaza automáticamente a tu base de datos remota con RLS.

### 4. Scripts de Desarrollo y Calidad

```bash
# Servidor de desarrollo local
npm run dev

# Verificación de tipos de TypeScript
npm run typecheck

# Análisis de código estático (ESLint)
npm run lint

# Ejecución de la suite de pruebas unitarias
npm test

# Compilación para producción
npm run build
```

---

## 🗄️ Base de Datos y Migraciones (Supabase)

La migración completa con las 19 tablas requeridas se encuentra en:
📁 `supabase/migrations/20260925000000_init_logia_schema.sql`

### Tablas Incluidas:
1. `profiles`: Perfiles de usuarios vinculados a `auth.users` de Supabase.
2. `roles`: Catálogo de 16 cargos masónicos y roles técnicos.
3. `permissions`: Catálogo de 13 permisos granulares del taller.
4. `role_permissions`: Matriz de asignación de permisos por cargo.
5. `members`: Ficha masónica completa de miembros (grados, pasaportes, diplomas, afiliaciones).
6. `member_roles`: Trazabilidad histórica de asignación de cargos.
7. `invitations`: Códigos de registro expedidos por la Secretaría.
8. `identity_verifications`: Registro de consentimiento (Ley 81 de Panamá) y comprobación de presencia facial.
9. `bodies`: Cuerpos masónicos y grados con símbolos heráldicos.
10. `events`: Tenidas rituales y eventos administrativos.
11. `event_conflicts`: Registro de superposiciones horarias y justificaciones protocolares.
12. `minutes`: Libro de actas digitalizado con formato `XX-YYYY`.
13. `minute_access`: Permisos de lectura individual y registros de lectura.
14. `minute_corrections`: Observaciones y correcciones al trazado antes de sanción.
15. `attendance`: Control de asistencia por tenida con estados (Presente, Excusa, Ausente).
16. `attendance_visitors`: Registro formal de hermanos visitantes y logias de origen.
17. `lodge_settings`: Parámetros institucionales, carta patente y sede.
18. `official_visit_checklist`: Los 8 elementos para la visita oficial de Gran Logia.
19. `audit_logs`: Registro inmutable de acciones críticas (quién, qué y cuándo).

### Cómo aplicar la migración:
1. En tu panel de Supabase, ve a **SQL Editor**.
2. Abre y pega el contenido de `supabase/migrations/20260925000000_init_logia_schema.sql`.
3. Haz clic en **Run**.

---

## 🛡️ Autenticación y Validación de Identidad

### 1. Flujo de Registro por Invitación
El acceso no es público:
1. **Invitación**: El usuario debe ingresar un código emitido por el Secretario (ej. `UF21-HERMANO-2026`).
2. **Datos Personales**: Nombres, apellidos, correo y contraseña validados con Zod.
3. **Comprobación Facial en Vivo**:
   - Apertura obligatoria de cámara frontal (`facingMode: "user"`).
   - Bloqueo total de carga desde galería o archivos, arrastrar/pegar imágenes.
   - Guía facial ovalada en pantalla con solicitud de iluminación frontal adecuada.
   - Análisis de fotogramas para detección de micro-movimiento o parpadeo (liveness).
4. **Consentimiento Explícito (Ley 81 de 2019 de Panamá)**:
   - Checkbox obligatorio con texto legal visible.
   - No se almacenan fotos personales sin consentimiento.
5. **Estado de Aprobación Honesto**:
   - Si no hay una API Key de un proveedor biométrico externo (ej. Onfido, Persona, Jumio) configurada, el sistema **NUNCA** marca falsamente "Identidad verificada".
   - En su lugar, reporta el estado real: **"Validación pendiente"**, quedando la confirmación final sujeta a la revisión manual del Secretario o Venerable Maestro.
6. **Confirmación y Acceso**: Redirección según el resultado obtenido.

---

## 👥 Roles Institucionales y Matriz de Permisos

El sistema separa estrictamente tres dimensiones:
1. **Cargo Institucional Masónico**
2. **Rol Técnico del Sistema** (`admin`, `secretary`, `dignitary`, `treasurer`, `member`)
3. **Permisos Granulares** (13 permisos específicos)

### Dignatarios
- **Venerable Maestro (VM)**: Aprobación formal de actas, supervisión general, consulta de conflictos, ajustes de taller.
- **Primer Vigilante (PV)**: Gestión de eventos, visualización de datos de taller.
- **Segundo Vigilante (SV)**: Instrucción de aprendices y eventos.
- **Secretario (SEC)**: Administración operativa plena (miembros, actas, asistencias, invitaciones, exportaciones).
- **Tesorero (TES)**: Control de finanzas y cuotas cuando el módulo esté habilitado.
- **Orador (ORA)**: Supervisión de acuerdos y actas.
- **Maestro de Ceremonia (MC)**: Conducción protocolar y apoyo en asistencias.
- **Venerable Maestro Inmediato (VMI)**: Consejo y supervisión.

### Oficiales
- Primer Experto, Segundo Experto, Primer Diácono, Segundo Diácono, Guarda Templo, Hospitalario, Maestro de la Armonía.

### Rol General
- **Hermano**: Acceso a su calendario autorizado y trazados aprobados según su grado masónico.

---

## 📅 Módulos Principales

### Calendario y Detección de Conflictos
- Soporte para cuerpos: **Logia UF21 (📐)**, **Gran Logia de Panamá (🏛️)**, **Interlogias (🤝)**, **Rito York (☩)**, **Supremo Consejo (🦅)** y **Shriners (🌙)**. Los símbolos heráldicos siempre acompañan el nombre del cuerpo.
- **Detección de Conflictos**: Superposición horaria entre tenidas de uno o varios días y eventos de día completo.
- **Sugerencia de Fechas Alternativas**: Algoritmo en `eventService.ts` que calcula fechas libres dentro de los próximos 60 días, priorizando el mismo día de la semana y duración.
- **Guardado Forzado con Justificación**: Requiere motivo explícito que queda registrado en el registro de auditoría.

### Convocatorias Protocolares
- Redacción solemne y automática del texto protocolar.
- Filtro de hermanos por grado (Aprendiz, Compañero, Maestro).
- Difusión rápida mediante copia a portapapeles, enlace directo a WhatsApp y correo vía `mailto` con destinatarios en copia oculta (**CCO/BCC**) para no exponer datos personales.
- Actualización automática de estado de tenida de *Programada* a *Convocada*.

### Libro de Actas
- Numeración consecutiva obligatoria anual: formato `XX-YYYY` (ej. `01-2026`).
- Ciclo de vida: *Borrador* → *Circulada* → *Aprobada* → *Firmada* → *Archivada*.
- **Acceso Restringido por Grado**: Un Aprendiz no puede visualizar ni acceder a actas de Grado de Maestro o Compañero.
- Control de Tomo, Folio, observaciones de hermanos y validación de PDF adjuntos.

### Control de Asistencia
- Registro por tenida (Presente, Excusa, Ausente).
- Botón "Marcar todos presentes".
- Registro de hermanos visitantes de otros talleres masónicos (Nombre, Logia de origen, Grado).
- Cálculo histórico de porcentaje excluyendo eventos sociales o profanos.

### Filiación de Miembros
- Alta, edición y baja lógica (*soft delete*).
- Protección de campos sensibles (**Número de Diploma**, **Pasaporte Masónico**, **Otros Cuerpos**) que solo son visibles con el permiso `view_sensitive_info`.
- Exportación e importación masiva en CSV con validación de columnas y correos.

### Visita Oficial e Inspección de Gran Logia
- Checklist reglamentario de 8 elementos:
  1. Lista de asistencia.
  2. Libro de Actas.
  3. Libro de Tesorería.
  4. Carta Constitutiva.
  5. Código Masónico Reformado.
  6. Estatutos del Taller.
  7. Libros de Registro.
  8. Cuestionario de Visitas Oficiales.
- **Resumen Automático**: Calculado en vivo a partir de los datos reales del taller (asistencias válidas, tenidas celebradas, actas aprobadas y fichas de miembros), diferenciando visualmente los datos calculados de los manuales.

### Respaldo y Auditoría
- Exportación completa en JSON y CSV.
- Importación con vista previa, conteo de duplicados y confirmación explícita.
- Registro inmutable de auditoría (`audit_logs`) con trazabilidad de usuario, acción, entidad y fecha.

---

## 🔒 Cumplimiento Legal (Ley 81 de 2019 de Panamá)

El sistema incorpora los principios de:
1. **Consentimiento Previo e Informado**: Para la captura facial.
2. **Finalidad Limitada**: Uso exclusivo para control de acceso fraternal y prevención de suplantación.
3. **No Retención Innecesaria**: No se guardan fotografías crudas en servidores públicos sin infraestructura cifrada dedicada.
4. **Protección de Datos Sensibles**: Enmascaramiento de documentos masónicos y datos de contacto según roles autorizados.

---

## 🧪 Pruebas Automatizadas

La suite de pruebas en `src/test/domain.test.ts` valida:
- Permisos por rol institucional.
- Detección de colisiones de horario y eventos multi-día.
- Sugerencia de fechas alternativas en 60 días.
- Acceso restringido a actas según el grado masónico del hermano.
- Exclusión de eventos profanos en estadísticas de asistencia.
- Cálculo automático del resumen de visita oficial.
- Enmascaramiento de información sensible.
- Validación biométrica y consentimiento según la Ley 81 de Panamá.
- Generación del texto protocolar de convocatoria.

Para ejecutar las pruebas:
```bash
npm test
```
