# 01 · Visión General, Propósito y Alcance del Sistema

**Proyecto:** `dralandaburo.com`  
**Titular y Dirección Médica:** Dra. Paula Landaburo (M.P. 11.439)  
**Ubicación:** Leandro N. Alem 45, Gualeguaychú, Entre Ríos, Argentina  
**Fecha de Verificación:** 14 de Octubre de 2026  
**Estado:** ✅ 100% Verificado contra la realidad del negocio y la arquitectura implementada.

---

## 1. Propósito y Misión del Sistema

`dralandaburo.com` es el ecosistema digital integral del consultorio de medicina estética de precisión y dermatología de la Dra. Paula Landaburo. El sistema cumple una doble función estratégica:

1. **Plataforma Externa para Pacientes:** Comunica la propuesta de valor médica, brinda información transparente sobre 120 tratamientos y consentimientos informados (Ley 26.529), ofrece el catálogo oficial de la línea de skincare Sulderm y canaliza consultas y admisiones digitales.
2. **Centro de Mando Operativo y Financiero (Dashboard):** Actúa como el sistema de gestión interna (ERP/Backoffice) del consultorio físico, administrando el libro mayor de cobros, el inventario físico con trazabilidad inmutable, la reconciliación de caja diaria, la asignación de tareas operativas y las métricas de rentabilidad.

---

## 2. Audiencias y Usuarios Objetivo

El sistema fue diseñado considerando las necesidades específicas de cinco audiencias:

1. **Pacientes de Medicina Estética:** Buscan tratamientos seguros, éticos y con base científica (Toxina Botulínica, Ácido Hialurónico, Láser Nordlys, Bioestimulación), valorando la claridad sobre tiempos de recuperación y cuidados post-procedimiento.
2. **Compradoras de Skincare Domiciliario:** Pacientes y clientes minoristas que adquieren productos de reventa y apoyo domiciliario de la línea Sulderm recomendados por la profesional.
3. **Personal de Recepción y Administración:** Encargadas de la atención en mostrador, admisión digital de pacientes en sala de espera, cobros diarios y control de stock físico.
4. **Equipo de Cosmiatría y Gabinete (Mercedes 'Mechi'):** Profesional especializada que consulta turnos, ejecuta limpiezas y peelings químicos, y descuenta los insumos consumidos en cabina.
5. **Dirección Médica y General (Dra. Paula Landaburo y Agustín Landaburo):** Monitorean la evolución financiera del consultorio, el rendimiento de campañas publicitarias en Meta Ads y la auditoría operativa.

---

## 3. Capacidades que el Sistema Resuelve Hoy

* ✅ **Catálogo Clínico Oficial:** Exposición estructurada de 120 tratamientos con desglose de duración, categoría clínica, honorarios sugeridos y respuestas a dudas frecuentes.
* ✅ **Repositorio Legal de Consentimientos Médicos:** Información clara y accesible sobre los derechos del paciente (Ley 26.529) y protocolos por procedimiento (Botox, Ácido Hialurónico, Bioestimuladores, PRP y Peelings).
* ✅ **Gestión Integral de Stock e Inventario:** Catálogo de 39 productos Sulderm (37 activos, 2 descontinuados), con libro contable de 111 movimientos auditados, alertas de stock mínimo y herramienta de arqueo físico.
* ✅ **Caja Diaria y Registro de Cobros:** Control unificado de 775 cobros vigentes por medio de pago (efectivo, transferencias, Mercado Pago), con soporte para superación contable sin borrado destructivo.
* ✅ **Métricas Ejecutivas de Rentabilidad:** Función RPC en base de datos (`obtener_metricas_ejecutivas`) con control de acceso estricto para calcular facturación en ARS y USD, desglose por canal y liquidación de honorarios.
* ✅ **Admisión Digital en Sala de Espera (Kiosco iPad):** Interfaz táctil a pantalla completa en `/kiosco` para el auto-registro de nuevos pacientes y captura de canales de atribución publicitaria.
* ✅ **Ingesta Asíncrona con Tolerancia a Fallas:** Sincronización de registros clínicos y contables desde n8n con enrutamiento de excepciones a una cola de revisión manual (`ingest_review`).
* ✅ **Defensa Anti-Spam y Protección de Datos:** Formulario de contacto desacoplado a cliente anónimo con rate limiting en base de datos y tablas de respaldo selladas con RLS.

---

## 4. Qué Deliberadamente NO Hace el Sistema (Límites de Alcance)

Para mantener la estabilidad técnica, la simplicidad operativa y el cumplimiento legal, el sistema delimita estrictamente sus fronteras:

* ❌ **NO es un Sistema de Historia Clínica Electrónica Hospitalaria:** No gestiona internación médica, camas, prescripción digital de psicofármacos controlados con firma digital nacional, ni protocolos de interoperabilidad hospitalaria HL7/FHIR.
* ❌ **NO es una Turnera Desatendida Automatizada:** Aunque modela citas internamente, la agenda de turnos se canaliza deliberadamente por WhatsApp oficial. Esto responde a una decisión médica de consultorio: la medicina estética requiere evaluar tiempos clínicos personalizados y evitar huecos improductivos en la agenda de la especialista.
* ❌ **NO Almacena Datos de Tarjetas de Crédito:** El sistema no procesa ni almacena números de tarjeta, códigos de seguridad (CVV) ni fechas de vencimiento, delegando el cumplimiento de la normativa PCI-DSS al 100% en la pasarela segura de Mercado Pago.
* ❌ **NO Permite Sobreventa Online por Defecto:** La bandera `store_config.allow_oversell_online` está configurada en `false` para impedir que un usuario web adquiera productos que no tienen existencia física inmediata en el mostrador de Gualeguaychú.
* ❌ **NO Realiza Borrados Destructivos Silenciosos:** Ninguna entidad clínica o de catálogo puede suprimirse sin dejar constancia inmutable en `deletion_audit` o `payments.superseded_by`.
