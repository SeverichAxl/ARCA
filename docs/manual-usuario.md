# Manual de usuario — ARCA Ltda.

> **Borrador interno v0.1 — 16/11/2026.** Las marcas `[CAPTURA PENDIENTE]` deben reemplazarse por capturas de la versión estable, conectada al API y con datos ficticios antes de entregar el manual final.

## 1. Propósito y alcance

Este manual describe el acceso y los flujos que están disponibles en la interfaz web de ARCA. Las opciones visibles dependen del rol y de los permisos de la cuenta. Si no aparece una opción, solicita al administrador que confirme el rol asignado; no intentes acceder con la cuenta de otra persona.

**Importante:** para las capturas y pruebas de la demo, usa el frontend conectado al API, sin dominios mock activos. No uses datos personales o salariales reales en las capturas.

## 2. Iniciar y cerrar sesión

1. Abre la dirección del frontend entregada por el equipo.
2. En la pantalla **Acceso**, ingresa tu usuario y contraseña y pulsa **Iniciar sesión**.
3. Usa únicamente los módulos que aparecen en la navegación lateral. En móvil, abre el menú de navegación.
4. Para salir, pulsa **Salir** en el encabezado.

Si no puedes iniciar sesión, verifica que el usuario esté activo y que el API esté disponible. No compartas tu contraseña ni tokens de sesión.

**[CAPTURA PENDIENTE: pantalla de acceso, sin credenciales visibles.]**

## 3. Funciones por rol

### 3.1 Administrador General

El Administrador General administra cuentas y roles.

1. Abre **Usuarios y roles** y pulsa **Nuevo usuario**.
2. Ingresa usuario, correo opcional, contraseña inicial y rol; pulsa **Crear usuario**.
3. Para asociar una cuenta con un expediente, busca al usuario en la tabla y usa **Vincular funcionario**.
4. Pega el UUID del funcionario, que se obtiene de la dirección de su expediente en **Personal**, y guarda el vínculo.
5. Si cambiaste el vínculo, cierra sesión y vuelve a entrar con esa cuenta para que se actualice la sesión.

La contraseña inicial debe tener al menos 8 caracteres, una mayúscula, un número y un símbolo. El Administrador General no debe usar cuentas de funcionarios para hacer operaciones en su nombre.

**[CAPTURA PENDIENTE: directorio de usuarios y diálogo de creación, con datos ficticios.]**
**[CAPTURA PENDIENTE: diálogo de vinculación con UUID ficticio.]**

### 3.2 Gestión Humana (RRHH_OPERATIVO)

#### Crear y revisar un funcionario

1. Abre **Personal → Nuevo funcionario**.
2. Completa los datos personales y laborales, selecciona el área y cargo y adjunta la firma gráfica PNG o JPEG requerida (máximo 5 MiB).
3. Guarda el expediente. El alta queda inicialmente **En prueba**.
4. Abre la ficha del funcionario para revisar los datos y la trayectoria.
5. Cuando corresponda según el proceso laboral, pulsa **Ratificar**, completa los datos que solicita el diálogo y confirma.

La ratificación no elimina la antigüedad mínima exigida para vacaciones. No cambies la fecha de ingreso de una persona real para habilitar una solicitud.

**[CAPTURA PENDIENTE: alta de funcionario con datos ficticios.]**
**[CAPTURA PENDIENTE: ficha y diálogo de ratificación.]**

#### Aprobar una solicitud de vacaciones

1. Abre **Vacaciones → Aprobaciones**.
2. Revisa la bandeja de RRHH y abre la solicitud pendiente.
3. Aprueba o rechaza según el procedimiento de la organización. Si rechazas, registra el motivo cuando la pantalla lo solicite.

El saldo se calcula automáticamente; la interfaz no permite asignar días manualmente. Para ser elegible, el expediente debe estar ratificado y cumplir la antigüedad mínima.

**[CAPTURA PENDIENTE: bandeja de RRHH con solicitud ficticia.]**

#### Administrar plantillas de contrato

1. Abre **Plantillas de contrato**.
2. Crea o selecciona una plantilla y edítala según los permisos disponibles.
3. Guarda los cambios y revisa el resultado antes de usarla.

La pantalla **Contratos** indica que la generación de contratos con datos de funcionarios aún no está conectada en esta versión. No presentes esa generación como un flujo disponible.

**[CAPTURA PENDIENTE: listado de plantillas y editor, si están disponibles en el build final.]**

### 3.3 Jefe de Área (JEFE_AREA)

1. Abre **Vacaciones → Aprobaciones → Jefatura**.
2. Revisa las solicitudes pendientes de su ámbito y las fechas solicitadas.
3. Aprueba o rechaza la solicitud según el proceso establecido.

La cuenta del jefe debe estar correctamente vinculada a su expediente y asignada al área correspondiente. El Jefe de Área también puede consultar su propio saldo y presentar solicitudes personales desde **Mi saldo y solicitudes**.

**[CAPTURA PENDIENTE: bandeja de Jefatura con solicitud ficticia.]**

### 3.4 Funcionario (FUNCIONARIO)

#### Consultar saldo y solicitar vacaciones

1. Abre **Vacaciones → Mi saldo y solicitudes** para revisar el saldo y el estado de tus solicitudes.
2. Pulsa **Solicitar vacaciones**, selecciona las fechas y completa los campos que presente el formulario.
3. Envía la solicitud y consulta su estado en la lista.
4. La solicitud pasa por aprobación de Jefatura y luego de RRHH; revisa el estado antes de considerar aprobadas las fechas.

El sistema valida los días hábiles, feriados, traslapes y saldo disponible. Si no cumples la antigüedad mínima o tu expediente no está ratificado, no podrás solicitar vacaciones ordinarias.

#### Consultar boletas propias

Abre **Mis boletas** para consultar las boletas asociadas a tu cuenta. Descarga únicamente tus propios documentos.

**[CAPTURA PENDIENTE: saldo, formulario de solicitud y estado de una solicitud ficticia.]**
**[CAPTURA PENDIENTE: lista de boletas propias con importes/datos de prueba.]**

### 3.5 Encargado de Nómina (ENCARGADO_NOMINA)

El rol cuenta con permisos relacionados con cálculo, cierre y emisión de boletas. En el build actual revisado no se encontró una página de interfaz de planillas; no documentes un flujo de cálculo o cierre hasta que el frontend de planillas esté integrado y validado.

Usa **Boletas autorizadas** para consultar o emitir documentos conforme a los permisos asignados. Una planilla cerrada debe tratarse como de solo lectura.

**[CAPTURA PENDIENTE: interfaz final de planillas/boletas autorizadas, después de validar el arrastre HU-21, HU-22 y HU-24.]**

### 3.6 Gerencia / Directorio (GERENCIA)

1. Abre **Dashboard** para consultar los indicadores habilitados para tu cuenta.
2. Abre **Vacaciones** para revisar las solicitudes o resolver excepciones cuando corresponda.
3. Usa los demás módulos únicamente para las consultas permitidas por tus permisos.

**[CAPTURA PENDIENTE: Dashboard y resolución de excepción con datos ficticios, si está habilitada.]**

### 3.7 Auditor (AUDITOR)

1. Abre **Auditoría** para revisar los registros disponibles.
2. Usa **Boletas autorizadas** solo para consulta si tu cuenta tiene ese permiso.
3. No edites ni intentes modificar registros desde una cuenta de auditoría.

**[CAPTURA PENDIENTE: registro de auditoría con datos de prueba y sin información sensible.]**

## 4. Navegación y permisos

La navegación muestra los módulos que corresponden al rol y a sus permisos. Entre las opciones disponibles en la aplicación pueden estar **Dashboard**, **Personal**, **Organigrama**, **Áreas y cargos**, **Vacaciones**, **Plantillas de contrato**, **Mis boletas**, **Boletas autorizadas**, **Usuarios y roles** y **Auditoría**. No todos los roles ven todas las opciones.

Un error de acceso o una opción ausente debe reportarse al equipo indicando el rol, la pantalla, la acción intentada y el mensaje mostrado. No se debe cambiar el rol propio para eludir una restricción.

## 5. Límites conocidos para esta versión

- Los días de vacaciones se generan y actualizan automáticamente; no existe asignación manual desde el frontend.
- La elegibilidad ordinaria de vacaciones requiere ratificación y antigüedad mínima.
- La generación de contratos con datos del funcionario aparece como no conectada en la pantalla actual de Contratos.
- El frontend de planillas está pendiente de integración; validar su disponibilidad antes de agregar instrucciones de cálculo, cierre o descarga de hash.
- Algunas secciones de la ficha indican que aún no tienen endpoint disponible, por lo que no deben presentarse como operativas.

## 6. Lista de capturas pendientes

- Acceso y navegación principal.
- Usuarios y roles: creación y vínculo de funcionario.
- Personal: alta, ficha y ratificación.
- Vacaciones: saldo y solicitud propia; bandeja de Jefatura; bandeja de RRHH.
- Plantillas de contrato y pantalla de Contratos.
- Mis boletas y Boletas autorizadas, si están disponibles en la versión final.
- Dashboard, Auditoría y planillas, según disponibilidad comprobada por rol.

Antes de entregar, reemplaza cada marcador por una captura del build final, confirma el rol usado y oculta nombres reales, CI, sueldos, contraseñas y tokens.
