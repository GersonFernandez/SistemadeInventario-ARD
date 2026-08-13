# PORTADA

## ARMADA DE REPUBLICA DOMINICANA
## TALLER DE ELECTRONICA

## MONOGRAFICO
## SISTEMA DE GESTION DE INVENTARIO Y ORDENES DE TRABAJO

**Autor:** [Completar nombre del sustentante]  
**Matricula:** [Completar matricula]  
**Carrera:** [Completar carrera]  
**Asignatura:** [Completar asignatura]  
**Asesor:** [Completar nombre del asesor]  
**Lugar y fecha:** Santo Domingo, Republica Dominicana - 2026

---

# INDICE GENERAL

1. CAPITULO I. REQUERIMIENTOS DE LA APLICACION  
1.1 Introduccion  
1.2 Objetivo del capitulo  
1.3 Objetivo general del sistema  
1.4 Alcance del sistema  
1.5 Actores del sistema  
1.6 Requerimientos funcionales  
1.7 Requerimientos no funcionales  
1.8 Reglas de negocio  
1.9 Criterios de aceptacion  
1.10 Restricciones tecnicas  
1.11 Conclusion del capitulo

2. CAPITULO II. ANALISIS Y DISENO DE LA SOLUCION  
2.1 Arquitectura general del sistema  
2.2 Diseno del frontend  
2.3 Diseno del backend  
2.4 Diseno de la base de datos  
2.5 Diseno de seguridad  
2.6 Diseno de reportes institucionales  
2.7 Diagramas funcionales  
2.8 Conclusion del capitulo

3. CAPITULO III. IMPLEMENTACION DEL SISTEMA  
3.1 Tecnologias empleadas  
3.2 Estructura de implementacion  
3.3 Implementacion de autenticacion y permisos  
3.4 Implementacion de inventario y catalogos  
3.5 Implementacion de recepciones y despachos  
3.6 Implementacion de ordenes de servicio  
3.7 Implementacion de auditoria  
3.8 Implementacion de reportes y documentos  
3.9 Implementacion del despliegue  
3.10 Conclusion del capitulo

4. CAPITULO IV. PRUEBAS Y RESULTADOS  
4.1 Estrategia de pruebas  
4.2 Casos de prueba principales  
4.3 Resultados obtenidos  
4.4 Incidencias y acciones de mejora  
4.5 Evaluacion de cumplimiento  
4.6 Conclusion del capitulo

5. CAPITULO V. CONCLUSIONES Y RECOMENDACIONES  
5.1 Conclusiones generales  
5.2 Aportes del proyecto  
5.3 Recomendaciones  
5.4 Trabajos futuros  
5.5 Cierre final

6. REFERENCIAS BIBLIOGRAFICAS

7. ANEXOS

---

# CAPITULO I
## REQUERIMIENTOS DE LA APLICACION
### Sistema de Gestion de Inventario y Ordenes de Trabajo
### Taller de Electronica, Armada de Republica Dominicana (ARD)

### 1.0 Presentacion del capitulo
En este capitulo se establecen los requerimientos que sustentan el desarrollo del sistema de gestion de inventario y ordenes de trabajo del Taller de Electronica de la Armada de Republica Dominicana. La definicion de estos requerimientos permite delimitar el comportamiento esperado de la aplicacion, sus condiciones de calidad y las restricciones tecnicas para su implementacion y operacion.

### 1.1 Introduccion
El presente capitulo define los requerimientos funcionales y no funcionales de la aplicacion web desarrollada para el Taller de Electronica de la Armada de Republica Dominicana (ARD). El sistema automatiza procesos de inventario, recepcion y despacho de materiales, control de herramientas, ordenes de servicio, auditoria y reportes institucionales.

### 1.2 Objetivo del capitulo
Precisar, de forma estructurada, los requerimientos funcionales, no funcionales, reglas de negocio, criterios de aceptacion y restricciones tecnicas que orientan la construccion y validacion del sistema.

### 1.3 Objetivo general del sistema
Implementar un sistema centralizado, seguro y trazable para gestionar inventario tecnico y operaciones del taller, reduciendo errores manuales y mejorando el control operativo y documental.

### 1.4 Alcance del sistema
La aplicacion cubre:
- Gestion de usuarios, roles y permisos.
- Catalogo y administracion de productos, repuestos y herramientas.
- Control de entradas (recepciones) y salidas (despachos).
- Gestion de ordenes de servicio (reparacion, instalacion y mantenimiento).
- Control de stock critico.
- Generacion de reportes PDF y Excel con encabezado institucional.
- Registro de auditoria de acciones sensibles.

La aplicacion no cubre:
- Integracion directa con sistemas ERP externos.
- Procesos de compras, licitaciones o contabilidad institucional.

### 1.5 Actores del sistema
- Administrador: gestiona la configuracion global, usuarios y permisos.
- Encargado de Inventario (Almacenista): gestiona productos, recepciones, despachos, ubicaciones y reportes.
- Tecnico (Especialista Naval): consulta operaciones permitidas, participa en ordenes de servicio y consume insumos segun permisos.

### 1.6 Requerimientos funcionales

#### 1.6.1 RF-01. Autenticacion y control de acceso
- Inicio de sesion con credenciales.
- Sesion autenticada con JWT.
- Restriccion de funcionalidades por permisos y rol.

#### 1.6.2 RF-02. Gestion de usuarios y permisos
- Crear, editar y desactivar usuarios.
- Asignar rol funcional.
- Configurar matriz de permisos por rol.

#### 1.6.3 RF-03. Gestion de catalogos
- Administrar marcas, modelos, categorias, estados y unidades de medida.
- Busqueda, filtrado, edicion, activacion y desactivacion de registros.

#### 1.6.4 RF-04. Gestion de productos e inventario
- Crear y editar productos.
- Manejar stock de consumibles y herramientas con serial.
- Visualizar stock disponible, stock minimo y estado critico.
- Filtrar inventario por ubicacion, categoria, tipo, estado y criticidad.

#### 1.6.5 RF-05. Recepcion de mercancia
- Registrar recepciones por lotes.
- Capturar datos de quien entrega (nombre, apellido, cedula, rango o cargo).
- Asociar ubicacion de almacenamiento.
- Adjuntar fotos, documentos y comprobante firmado.
- Descargar comprobante de recepcion.

#### 1.6.6 RF-06. Historial de recepcion
- Consultar historial con filtros por tipo, rango de fecha y busqueda.
- Visualizar quien entrega y quien recibe.
- Descargar historial en PDF y Excel.

#### 1.6.7 RF-07. Despachos
- Registrar despachos de materiales y herramientas.
- Asociar solicitante y orden de trabajo cuando aplique.
- Generar comprobantes de despacho.

#### 1.6.8 RF-08. Ordenes de servicio
- Crear ordenes por tipo (reparacion, instalacion y mantenimiento).
- Asignar tecnico.
- Cambiar estado de la orden segun flujo operativo.
- Registrar diagnostico, trabajo realizado y cierre.
- Descargar comprobante de cierre.

#### 1.6.9 RF-09. Reportes
- Exportar reportes en PDF y Excel.
- Incluir encabezado institucional y logo en documentos descargables.
- Soportar reportes de inventario, stock critico, herramientas, recepciones, despachos y ordenes de servicio.

#### 1.6.10 RF-10. Auditoria
- Registrar eventos criticos (usuario, fecha y hora, accion y origen).
- Consultar bitacora para trazabilidad y transparencia.

### 1.7 Requerimientos no funcionales

#### 1.7.1 RNF-01. Seguridad
- Control de acceso por permisos.
- Sesiones con expiracion.
- Validaciones de entrada de datos.
- Trazabilidad de acciones sensibles.

#### 1.7.2 RNF-02. Disponibilidad
- Despliegue en contenedores Docker.
- Servicios desacoplados (frontend, backend y base de datos).

#### 1.7.3 RNF-03. Rendimiento
- Paginacion en listados.
- Filtros y busqueda optimizados para operaciones diarias.

#### 1.7.4 RNF-04. Usabilidad
- Interfaz web responsive.
- Navegacion por modulos operativos.
- Formularios con validacion y mensajes de error claros.

#### 1.7.5 RNF-05. Mantenibilidad
- Arquitectura modular (frontend y backend separados).
- API versionada (/api/v1/).
- Codigo organizado por dominio funcional.

#### 1.7.6 RNF-06. Portabilidad
- Ejecucion local o en servidor Linux mediante Docker Compose.

### 1.8 Reglas de negocio
- RN-01: Todo movimiento sensible debe quedar auditado.
- RN-02: Un producto puede estar activo o inactivo sin perder historial.
- RN-03: El stock critico se determina por stock disponible menor o igual al stock minimo.
- RN-04: Las recepciones deben registrar identidad del entregante.
- RN-05: Los reportes descargables deben incluir encabezado institucional.

### 1.9 Criterios de aceptacion
- CA-01: Los usuarios acceden solo a funciones autorizadas segun rol y permisos.
- CA-02: El inventario permite filtrar por criticidad sin errores del servidor.
- CA-03: La recepcion permite cargar y descargar comprobantes firmados.
- CA-04: Los catalogos permiten buscar, filtrar, limpiar, editar y desactivar o activar registros.
- CA-05: Los reportes PDF y Excel se descargan con encabezado institucional y logo.
- CA-06: El flujo de ordenes de servicio permite cierre y generacion de comprobante.

### 1.10 Restricciones tecnicas
- Backend: Django y Django REST Framework.
- Frontend: React, Vite y Tailwind.
- Base de datos: PostgreSQL (produccion).
- Contenerizacion: Docker y Docker Compose.
- Autenticacion: JWT.

### 1.11 Conclusion del capitulo
Los requerimientos definidos establecen la base funcional y tecnica del sistema para el Taller de Electronica de la ARD. Su cumplimiento garantiza control de inventario, trazabilidad documental, seguridad por roles y generacion de evidencias institucionales para soporte tecnico y administrativo.

Como continuidad de este marco de requerimientos, en el Capitulo II se desarrolla el analisis y diseno de la solucion, describiendo la arquitectura del sistema, la estructura modular de sus componentes y la relacion entre los procesos operativos y la implementacion tecnica propuesta.

# CAPITULO II
## ANALISIS Y DISENO DE LA SOLUCION

### 2.0 Presentacion del capitulo
Este capitulo describe la arquitectura logica y tecnica del sistema, asi como el diseno funcional de los modulos principales. Su objetivo es mostrar como los requerimientos definidos en el capitulo anterior se traducen en componentes de software integrados y escalables.

### 2.1 Arquitectura general del sistema
La solucion adopta una arquitectura cliente-servidor de tres capas:
- Capa de presentacion: interfaz web desarrollada en React.
- Capa de servicios: API REST desarrollada en Django REST Framework.
- Capa de datos: motor PostgreSQL para persistencia transaccional.

Esta separacion permite mantener desacoplamiento entre interfaz, logica de negocio y almacenamiento.

### 2.2 Diseno del frontend
El frontend esta organizado en paginas, componentes reutilizables, servicios HTTP y manejo de estado por contexto. Las vistas principales corresponden a:
- Inicio de sesion.
- Inventario y stock critico.
- Catalogos maestros.
- Recepciones y despachos.
- Ordenes de servicio.
- Auditoria y reportes.

### 2.3 Diseno del backend
El backend se estructura por aplicaciones de dominio:
- accounts: autenticacion, usuarios, roles y permisos.
- inventory: productos, recepciones, movimientos y reportes.
- workorders: ordenes de servicio y ciclo operativo.
- audit: trazabilidad de acciones sensibles.
- utils: utilidades comunes, incluyendo generacion de documentos.

### 2.4 Diseno de la base de datos
El modelo de datos considera entidades maestras y transaccionales:
- Maestras: categorias, marcas, modelos, ubicaciones, estados y unidades.
- Transaccionales: items, entradas, salidas, ordenes, asignaciones y auditoria.

Las relaciones se implementan mediante claves foraneas y restricciones para preservar integridad referencial.

### 2.5 Diseno de seguridad
Se implementan controles de seguridad en varios niveles:
- Autenticacion con JWT.
- Autorizacion por rol y permisos granulares.
- Validacion de entrada en backend y frontend.
- Registro de auditoria para operaciones criticas.

### 2.6 Diseno de reportes institucionales
Los reportes se generan en PDF y Excel a traves de una utilidad centralizada, con encabezado institucional y logo oficial. Los reportes contemplan inventario general, inventario critico, recepciones, despachos y ordenes de servicio.

### 2.7 Diagramas funcionales (descripcion)
Para sustentar el diseno se consideran los siguientes diagramas de apoyo documental:
- Diagrama de casos de uso por actor.
- Diagrama de flujo del proceso de recepcion.
- Diagrama de flujo del proceso de despacho.
- Diagrama de estados de ordenes de servicio.

### 2.8 Conclusion del capitulo
El analisis y diseno propuestos aseguran una implementacion modular, mantenible y alineada con los requerimientos operativos del Taller de Electronica de la ARD. En el Capitulo III se presenta el proceso de desarrollo e implementacion del sistema.

# CAPITULO III
## IMPLEMENTACION DEL SISTEMA

### 3.0 Presentacion del capitulo
En este capitulo se expone la implementacion tecnica del sistema, detallando tecnologias utilizadas, estructura del codigo, configuracion del entorno y despliegue en contenedores.

### 3.1 Tecnologias empleadas
- Frontend: React, Vite, Tailwind CSS y Axios.
- Backend: Python, Django y Django REST Framework.
- Base de datos: PostgreSQL.
- Contenerizacion: Docker y Docker Compose.

### 3.2 Estructura de implementacion
La implementacion sigue una organizacion por responsabilidades:
- Frontend: paginas por modulo, componentes compartidos, servicios API.
- Backend: aplicaciones por dominio, serializers, vistas y permisos.
- Reportes: utilidades comunes para exportacion de documentos.

### 3.3 Implementacion de autenticacion y permisos
Se implemento inicio de sesion basado en token JWT, junto con politicas de acceso por rol. Cada endpoint sensible valida permisos antes de ejecutar acciones de modificacion o consulta restringida.

### 3.4 Implementacion de inventario y catalogos
Se desarrollaron operaciones CRUD para catalogos y productos, con soporte de busqueda y filtros. Ademas, se incluyo gestion de estado activo/inactivo para conservar historial sin eliminar evidencia operativa.

### 3.5 Implementacion de recepciones y despachos
El modulo de recepciones registra identidad del entregante, evidencias y comprobantes. El modulo de despachos controla salida de materiales y relacion con solicitudes u ordenes de trabajo.

### 3.6 Implementacion de ordenes de servicio
Se incorporo el flujo de ciclo de vida de la orden: creacion, asignacion, ejecucion, cierre y generacion de comprobante final.

### 3.7 Implementacion de auditoria
Las acciones criticas quedan registradas con usuario, marca temporal y accion ejecutada, permitiendo trazabilidad para fines de control institucional.

### 3.8 Implementacion de reportes y documentos
Se habilito la descarga en PDF y Excel con formato institucional comun, asegurando consistencia visual y validez documental.

### 3.9 Implementacion del despliegue
El sistema se prepara para ejecucion local y productiva mediante Docker Compose. La separacion de servicios permite escalar o ajustar recursos por componente.

### 3.10 Conclusion del capitulo
La implementacion materializa los requerimientos definidos mediante una solucion web robusta y modular, lista para su validacion funcional y operativa. En el Capitulo IV se presentan pruebas y resultados.

# CAPITULO IV
## PRUEBAS Y RESULTADOS

### 4.0 Presentacion del capitulo
Este capitulo documenta el proceso de verificacion del sistema, indicando pruebas aplicadas, criterios evaluados y resultados obtenidos en funcion de los requerimientos del proyecto.

### 4.1 Estrategia de pruebas
Se aplico una estrategia combinada:
- Pruebas funcionales por modulo.
- Pruebas de integracion API-frontend.
- Pruebas de regresion sobre funciones corregidas.
- Pruebas de exportacion de reportes.

### 4.2 Casos de prueba principales
- Acceso segun perfil y permisos.
- Creacion, edicion y desactivacion de registros de catalogo.
- Filtros y busquedas en inventario y recepciones.
- Descarga de comprobantes firmados.
- Generacion de reportes PDF y Excel con encabezado.
- Flujo de ordenes de servicio hasta cierre.

### 4.3 Resultados obtenidos
Los resultados muestran cumplimiento general de los requerimientos funcionales y no funcionales definidos para la fase actual del sistema. Se verifico:
- Correcta aplicacion de permisos por rol.
- Estabilidad de filtros criticos de inventario.
- Integridad del historial en recepciones y productos.
- Generacion consistente de documentos descargables.

### 4.4 Incidencias y acciones de mejora
Durante las validaciones se identificaron incidencias relacionadas con filtros, trazabilidad visual y formato documental, las cuales fueron atendidas mediante ajustes en backend, frontend y utilidades de reporte.

### 4.5 Evaluacion de cumplimiento
Con base en los criterios de aceptacion, el sistema alcanza un nivel satisfactorio de cumplimiento para su uso en el contexto del Taller de Electronica, con oportunidad de mejora incremental en futuras iteraciones.

### 4.6 Conclusion del capitulo
Las pruebas ejecutadas confirman la viabilidad tecnica y funcional de la aplicacion. En el Capitulo V se presentan las conclusiones generales y recomendaciones de continuidad.

# CAPITULO V
## CONCLUSIONES Y RECOMENDACIONES

### 5.0 Presentacion del capitulo
Este capitulo sintetiza los aportes del proyecto, el nivel de cumplimiento alcanzado y las recomendaciones para mantener y evolucionar la solucion.

### 5.1 Conclusiones generales
- Se desarrollo una aplicacion alineada con las necesidades operativas del Taller de Electronica de la ARD.
- El sistema mejora el control de inventario, la trazabilidad documental y la transparencia operativa.
- La arquitectura adoptada permite mantenimiento y escalabilidad por modulos.
- La generacion de reportes institucionales fortalece la formalidad y respaldo de los procesos.

### 5.2 Aportes del proyecto
- Digitalizacion de procesos antes ejecutados de forma manual.
- Reduccion de errores de registro y consolidacion de evidencias.
- Mejora de tiempos de consulta mediante filtros y busquedas.
- Base tecnica para futuras integraciones institucionales.

### 5.3 Recomendaciones
- Implementar tablero de indicadores operativos en tiempo real.
- Integrar firma digital avanzada para documentos criticos.
- Incorporar respaldo automatizado y monitoreo de disponibilidad.
- Planificar integraciones graduales con plataformas institucionales.

### 5.4 Trabajos futuros
Como linea de continuidad academica y tecnica se recomienda:
- Incorporar notificaciones inteligentes por eventos criticos.
- Extender el sistema a otras dependencias tecnicas de la institucion.
- Implementar analitica historica para planeacion de abastecimiento.

### 5.5 Cierre final
El proyecto demuestra que una solucion web modular, segura y trazable puede elevar la eficiencia administrativa y tecnica de un entorno militar especializado, aportando valor operativo y documental sostenible.

# REFERENCIAS BIBLIOGRAFICAS

1. Django Software Foundation. Django Documentation. Disponible en: https://docs.djangoproject.com/
2. Django REST Framework. DRF Official Documentation. Disponible en: https://www.django-rest-framework.org/
3. React Team. React Documentation. Disponible en: https://react.dev/
4. Vite Team. Vite Documentation. Disponible en: https://vite.dev/
5. Tailwind Labs. Tailwind CSS Documentation. Disponible en: https://tailwindcss.com/docs
6. Docker Inc. Docker Documentation. Disponible en: https://docs.docker.com/
7. PostgreSQL Global Development Group. PostgreSQL Documentation. Disponible en: https://www.postgresql.org/docs/

# ANEXOS

## Anexo A. Capturas de pantalla del sistema
- Inicio de sesion.
- Panel principal de inventario.
- Modulo de recepciones y comprobantes.
- Modulo de ordenes de servicio.

## Anexo B. Evidencias de reportes generados
- Reporte de inventario en PDF.
- Reporte de stock critico en PDF.
- Reportes equivalentes en Excel.

## Anexo C. Evidencias tecnicas de despliegue
- Archivo docker-compose de produccion.
- Variables de entorno de produccion (sin credenciales sensibles).
- Verificacion de servicios en ejecucion.

## Anexo D. Matriz de pruebas resumida
- Caso de prueba.
- Resultado esperado.
- Resultado obtenido.
- Estado (Aprobado/No aprobado).
