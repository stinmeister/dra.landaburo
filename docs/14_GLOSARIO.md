# 14 · Glosario Integral de Términos

**Proyecto:** `dralandaburo.com`  
**Ámbitos:** Vocabulario Médico/Clínico, Operativo/Comercial y Técnico/Arquitectural  
**Fecha de Verificación:** 14 de Octubre de 2026  
**Estado:** ✅ 100% Verificado contra el lenguaje del consultorio y las convenciones del código fuente.

---

## 1. Términos Médicos y Clínicos

* **Ácido Hialurónico (AH):** Polisacárido biocompatible y reabsorbible utilizado en medicina estética para restituir volúmenes faciales, perfilar labios e hidratar tejidos profundos. Posee antídoto enzimático (Hialuronidasa).
* **Bioestimuladores de Colágeno:** Sustancias inyectables biocompatibles (ej. Hidroxiapatita de Calcio / Radiesse, Ácido Poli-L-Láctico / Sculptra) que inducen una neocolagénesis progresiva en la dermis profunda para mejorar la firmeza y elasticidad cutánea.
* **Consentimiento Informado (Ley 26.529):** Documento médico-legal obligatorio en la República Argentina mediante el cual el paciente declara haber recibido información suficiente y veraz sobre el procedimiento estético, riesgos potenciales, beneficios y cuidados post-tratamiento, otorgando su conformidad libre y voluntaria.
* **Cosmiatría:** Disciplina orientada al cuidado estético y terapéutico de la piel sana o con alteraciones menores, complementando los actos médicos mediante limpiezas profundas, dermaplaning, aparatología no ablativa y peelings químicos superficiales.
* **Gabinete:** Espacio físico dentro del consultorio acondicionado para la atención cosmiátrica y tratamientos dérmicos no invasivos a cargo de Mercedes.
* **Hilos Tensores (PDO):** Suturas reabsorbibles de polidioxanona que se insertan en el plano subdérmico para producir un efecto de tracción y bioestimulación mecánica y biológica de colágeno.
* **Láser Nordlys:** Plataforma tecnológica médico-estética multitecnología (Luz Pulsada Intensa SWT® y láser Nd:YAG 1064nm) para el tratamiento de lesiones vasculares, manchas solares, fotorrejuvenecimiento y depilación médica.
* **Matrícula Provincial (M.P. 11.439):** Registro habilitante otorgado por el Colegio de Médicos de Entre Ríos a la Dra. Paula Landaburo para el ejercicio legal de la medicina en la provincia.
* **Mesoterapia:** Técnica de microinyecciones intradérmicas múltiples de principios activos (vitaminas, minerales, péptidos o ácido hialurónico no reticulado) directamente en el área facial, capilar o corporal a tratar.
* **Peeling Químico:** Aplicación tópica de soluciones ácidas (mandélico, glicólico, salicílico o tricloroacético) para provocar una exfoliación y renovación celular controlada de las capas epidérmicas.
* **Toxina Botulínica Tipo A:** Neurotoxina purificada que bloquea temporalmente la liberación de acetilcolina en la placa neuromuscular, relajando selectivamente los músculos hiperquinéticos faciales (entrecejo, frente, patas de gallo, maseteros) para suavizar líneas de expresión.

---

## 2. Términos Operativos y de Negocio

* **Arqueo de Caja:** Verificación física y recuento minucioso de todo el efectivo presente en el cajón de recepción al término de la jornada, comparándolo contra los registros del sistema.
* **Atribución Publicitaria:** Fuente por la cual el paciente conoció el consultorio (ej. Instagram Orgánico, Anuncio de Meta Ads, Recomendación de paciente, Google o Cartel en la calle), capturada en el Kiosco iPad (`kiosk_admissions.attribution_channel`).
* **Cierre Diario:** Procedimiento administrativo formal ejecutado en `/dashboard/cierre-diario` para consolidar los cobros del día clasificados por medio de pago y archivar el balance de la fecha.
* **Honorarios Médicos:** Retribución económica percibida por la realización de actos clínicos y procedimientos estéticos médicos, diferenciada contablemente del margen de reventa de productos.
* **Insumos de Gabinete:** Productos cosméticos o material descartable extraído del depósito para ser utilizado en cabina durante un tratamiento, registrado bajo el tipo `uso_gabinete` en `stock_movements`.
* **Kiosco de Recepción:** Modo de pantalla completa optimizado para tablets iPad ubicadas en la sala de espera de Alem 45, orientado a que los pacientes nuevos completen su ficha de ingreso de forma autónoma.
* **Liquidación de Honorarios:** Proceso de cálculo mensual mediante el cual se determina el porcentaje o comisión correspondiente a los profesionales colaboradores sobre los tratamientos realizados.
* **Paciente:** Denominación obligatoria y exclusiva para las personas que asisten al consultorio o adquieren tratamientos y productos. El término "cliente" está prohibido en toda la documentación y copy del sistema.
* **Recuento Físico:** Inventario ciego o guiado realizado periódicamente en `/dashboard/productos/recuento` para confrontar el stock teórico del sistema contra las existencias físicas en vitrinas y depósitos.
* **Segmentación RFM:** Modelo analítico que clasifica a los pacientes según su Recencia (cuándo fue su última visita), Frecuencia (cuántas veces vino) y Valor Monetario (cuánto invirtió en el consultorio), reflejado en `patients.rfm_segment`.
* **Sulderm:** Línea oficial de productos dermatológicos y skincare de apoyo domiciliario comercializada en el consultorio y en la tienda web.

---

## 3. Términos Técnicos y de Software

* **App Router:** Modelo de enrutamiento basado en carpetas y componentes del servidor introducido en Next.js 13+ y consolidado en Next.js 16, estructurado bajo el directorio `src/app/`.
* **Deduplicación de Eventos:** Mecanismo mediante el cual Meta Graph API descarta eventos de conversión redundantes enviados simultáneamente por el navegador (Pixel) y el servidor (CAPI) cuando comparten el mismo `event_id`.
* **Idempotencia:** Propiedad de un endpoint o servicio que garantiza que el resultado de procesar una petición N veces sea idéntico al de procesarla una sola vez, previniendo dobles cobros o duplicación de stock (implementado en `mp_webhook_events` mediante clave única).
* **Inmutabilidad (Append-Only Log):** Patrón de persistencia donde los registros históricos jamás se editan ni se eliminan, registrando cada cambio como un nuevo asiento contable. Garantizado en `deletion_audit` mediante triggers que disparan `RAISE EXCEPTION`.
* **Kill-Switch:** Interruptor lógico en base de datos (`store_config.checkout_enabled`) que permite suspender instantáneamente una función crítica (como la venta online) sin necesidad de modificar código ni reiniciar el servidor.
* **Next.js Standalone:** Modo de compilación (`output: 'standalone'`) que empaqueta exclusivamente el runtime mínimo de Node.js necesario para correr el servidor de producción en entornos aislados o VPS.
* **PM2:** Gestor de procesos en producción para aplicaciones Node.js que administra el reinicio automático en caso de fallo y permite recargas en caliente con cero tiempo de inactividad (`pm2 reload 0`).
* **PostgREST:** Componente de Supabase que expone automáticamente la base de datos PostgreSQL como una API RESTful, transformando consultas HTTP en sentencias SQL gobernadas por RLS.
* **React Server Components (RSC):** Componentes de React que se ejecutan y renderizan exclusivamente en el servidor Node.js, reduciendo a cero el código JavaScript enviado al navegador y permitiendo el acceso directo a bases de datos y secretos.
* **Row Level Security (RLS):** Mecanismo de seguridad a nivel motor en PostgreSQL que evalúa políticas granulares de acceso sobre cada fila devuelta por una consulta, en función del rol y la identidad del usuario (`auth.uid()`).
* **Schema Cache:** Almacén en memoria donde PostgREST indexa las tablas y columnas disponibles. Requiere el comando `NOTIFY pgrst, 'reload schema';` tras ejecutar sentencias DDL en PostgreSQL.
* **Server Actions:** Funciones asincrónicas declaradas con `'use server'` que se ejecutan en el servidor en respuesta a interacciones de usuario en el cliente, gestionando mutaciones de datos con revalidación automática de rutas (`revalidatePath`).
* **Superación Contable (`superseded_by`):** Patrón que marca un cobro en la tabla `payments` como sustituido o anulado mediante un puntero hacia la nueva fila que lo corrige, preservando la auditoría contable sin borrar datos.
