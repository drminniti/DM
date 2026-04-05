# Especificación de Módulo: Core de Desafíos Fitness (MVP)

**Versión de la Especificación:** 1.1.0
**Fecha:** 2026-03-29
**Arquitecto/Autor:** Damián Roque Minniti
**Estado:** Listo para Generación

## 1. Visión General y Contexto

* **Propósito:** Gestionar la creación, seguimiento y cumplimiento de desafíos fitness diarios, permitiendo modalidades individuales y en equipo, y fomentando la retención mediante un sistema de rachas (streaks) y notificaciones de progreso. Todo bajo una interfaz minimalista.
* **Alcance:** Aplicación web (optimizada para celulares - Mobile First). Incluye la creación del desafío, gestión de participantes mediante enlaces de invitación, registro diario de cumplimiento mediante un simple botón (sin evidencia en el MVP), cálculo de rachas y notificaciones. 
* **Fuera del alcance (MVP):** Evidencias fotográficas, validación cruzada de cumplimiento, pagos, perfiles sociales complejos, integración con wearables.

## 2. Recopilación de Requisitos (Lógica Empresarial)

### 2.1. Historias de Usuario y Criterios de Aceptación

**Historia 1:** Como Creador del desafío, quiero configurar el reto y obtener un enlace, para invitar a mis amigos fácilmente.
* **Criterio 1.1 (Creación exitosa):** [ ] Dado que el usuario está logueado, cuando ingresa el nombre, cantidad de días y modo (equipo/individual), entonces se crea el desafío en la base de datos y se le proporciona un enlace único para compartir (ej. `midominio.com/join/ID`).

**Historia 2:** Como Jugador, quiero unirme a un desafío y marcar mi día como "cumplido" rápidamente, para mantener mi racha activa.
* **Criterio 2.1 (Unirse al reto):** [ ] Dado que el usuario recibe un enlace, cuando entra y se autentica, entonces es agregado automáticamente a la lista de jugadores del desafío.
* **Criterio 2.2 (Registro rápido):** [ ] Dado que el jugador tiene un desafío activo hoy, cuando presiona el botón "Cumplido", entonces el sistema marca su día como completado y actualiza la racha visualmente.
* **Criterio 2.3 (Disparo de notificación):** [ ] Dado que un jugador completa su desafío, cuando se registra el éxito, entonces el sistema envía una notificación (push/email) al resto de los participantes.

**Historia 3:** Como Sistema, necesito evaluar el estado del desafío al final del día (medianoche), para ajustar las rachas según la modalidad.
* **Criterio 3.1 (Penalización Modo Individual):** [ ] Dado un desafío "Individual", cuando un jugador no registra su cumplimiento, entonces su racha personal se resetea a 0 (los demás no se ven afectados).
* **Criterio 3.2 (Penalización Modo Equipo):** [ ] Dado un desafío "En Equipo", cuando al menos UN jugador no registra su cumplimiento, entonces la racha colectiva de TODOS se resetea a 0.

### 2.2. Reglas de Negocio

* El desafío debe tener una duración definida (Ej: 30 días).
* **Modalidad Equipo:** Todos dependen de todos. Si uno falla, el contador (racha) vuelve a cero para el grupo.
* **Modalidad Individual:** Si uno falla, solo pierde su propia racha, el desafío continúa.
* Las notificaciones de recordatorio deben enviarse en un horario 'X' (ej. 8:00 PM) si el usuario aún no ha cumplido el reto.
* **Diseño UI:** Estrictamente minimalista. Uso intensivo de espacios en blanco, tipografías claras y botones de acción grandes para el móvil.

### 2.3. Restricciones del Sistema

* **Plataforma:** Web Responsiva (Mobile First). No se desarrollarán apps nativas en esta fase.
* **Autenticación:** Firebase Auth (Google Sign-In / Email link) para minimizar barreras de entrada.
* **Usabilidad:** Completar la tarea diaria no debe tomar más de 1 clic al abrir la app.

## 3. Diseño de la Arquitectura

### 3.1. Modelos de Datos (Esquemas de Firebase Firestore)

```json
// Colección: challenges (Desafíos)
{
  "id": "string (generado por Firestore)",
  "name": "string",
  "totalDays": "number",
  "mode": "enum('TEAM', 'INDIVIDUAL')",
  "creatorId": "string (uid)",
  "createdAt": "timestamp",
  "status": "enum('ACTIVE', 'COMPLETED')"
}

// Colección: participants (Jugadores dentro de un desafío) -> Subcolección de challenges o colección raíz
{
  "id": "string",
  "challengeId": "string",
  "userId": "string (uid)",
  "playerName": "string",
  "currentStreak": "number",
  "fcmToken": "string (para notificaciones Push)"
}

// Colección: daily_logs (Registros Diarios)
{
  "id": "string",
  "participantId": "string",
  "challengeId": "string",
  "date": "string (YYYY-MM-DD)",
  "isCompleted": "boolean"
}

## 4. Features Adicionales Implementadas (Evolución del MVP)
Durante el desarrollo se identificaron e incorporaron las siguientes funciones para mejorar significativamente la experiencia del usuario, retención y estabilidad técnica:

### 4.1. UX & Retención
* **Historial de Cumplimiento (Compliance Grid):** Visualización en grilla tipo calendario 🟩/⬜ bajo cada participante para permitir un rastreo de progreso rápido e intuitivo.
* **Celebraciones y Gamificación:** Animaciones de confeti con motor de partículas (`ChallengeCompletedModal.tsx` y `CompleteButton.tsx`) al marcar un día o completar exitosamente el total del desafío.
* **Archivado / Soft-Delete:** Funcionalidad para ocultar o abandonar "desafíos muertos" sin corromper la base de datos para el resto del equipo (`isArchived: true`).
* **Perfil de Usuario:** Página (`/profile`) unificada con visualización del avatar de Google, permitiendo cerrar sesión o eliminar permanentemente la cuenta de usuario y sus datos de participación por privacidad.

### 4.2. Técnico & PWA
* **Real-time (onSnapshot):** Actualización instantánea de rachas, participantes y checkboxes en todos los dispositivos conectados sin necesidad de recargar la página.
* **Notificaciones Push y Recordatorios Diarios:** Implementación mediante Firebase Cloud Messaging. Además se implementó un Cron Job en Vercel para emitir recordatorios a quienes faltan completar el reto.
* **Husos Horarios Dinámicos (Timezones):** La evaluación de rachas y envíos de recordatorios (cron jobs) funcionan respetando 100% las horas locales del Creador del Desafío. Los crons se ejecutan cada 1 hora (`0 * * * *`) analizando en qué zona horaria del desafío es actualmente la medianoche (para reseteo) o las 20:00 hs (para recordatorios), asegurando que haya justicia global.
* **Progressive Web App (PWA):** Manifiesto, service workers (`firebase-messaging-sw.js`), iconos 192/512 y viewport configurados para poder anclar la web como "Aplicación" en iOS y Android.
* **Autenticación Robusta:** Fallback a autenticación por redirección configurada con espera simultánea de estados (`getRedirectResult` + `onAuthStateChanged`) diseñado específicamente para evitar bloqueos de popup en Safari/iOS.