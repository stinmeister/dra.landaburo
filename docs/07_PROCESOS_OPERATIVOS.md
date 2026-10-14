# 07 · Procesos Operativos de Consultorio

**Proyecto:** `dralandaburo.com`  
**Ubicación Física:** Leandro N. Alem 45, Gualeguaychú, Entre Ríos  
**Fecha de Verificación:** 14 de Octubre de 2026  
**Procesos Modelados:** Apertura, Recepción, Cobro, Cierre Diario, Inventario y Despacho  
**Estado:** ✅ 100% Verificado contra la rutina operativa y herramientas del sistema.

---

## 1. Proceso de Apertura de Consultorio y Comienzo del Día

Cada mañana (09:00 / 10:00 hs), el personal operativo y médico prepara las instalaciones y los sistemas para la jornada de atención.

```mermaid
flowchart TD
    Inicio([09:00 hs - Llegada al Consultorio]) --> EncenderEquipos["Encendido de PCs, Luces y Climatización"]
    EncenderEquipos --> IniciarSesion["Inicio de Sesión en /dashboard<br/>(Personal Operativo / Recepción)"]
    IniciarSesion --> AbrirKiosco["Configurar iPad de Recepción en /kiosco<br/>(Pantalla completa sin barra de navegación)"]
    AbrirKiosco --> ConsultarTareas["Acceder a /dashboard/operativo<br/>(Revisar tareas pendientes y recordatorios)"]
    ConsultarTareas --> ChequearWhatsApp["Sincronizar turnos del día desde WhatsApp oficial"]
    ChequearWhatsApp --> AperturaCaja["Verificar fondo fijo de caja inicial en mostrador"]
    AperturaCaja --> Listo([Consultorio Operativo para Atención])
```

---

## 2. Proceso de Recepción y Atención de Pacientes

Circuito desde que el paciente cruza la puerta hasta que ingresa al gabinete o consultorio médico.

```mermaid
flowchart TD
    Ingreso([Paciente ingresa a Alem 45]) --> ConsultaEsPrimeraVez{¿Es su primera visita?}

    ConsultaEsPrimeraVez -- Sí --> EntregarKiosco["Se le entrega el iPad con /kiosco"]
    EntregarKiosco --> CompletaKiosco["Paciente completa datos, atribución e intereses"]
    CompletaKiosco --> AutoRegistro["Kiosco ejecuta POST /api/kiosco/admision<br/>(Se guarda en kiosk_admissions)"]
    AutoRegistro --> Espera["Paciente aguarda en sala de espera"]

    ConsultaEsPrimeraVez -- No --> BuscarFicha["Recepción busca al paciente en padrón (patients)"]
    BuscarFicha --> Espera

    Espera --> LlamadoProfesional{¿Quién lo atiende?}

    LlamadoProfesional -- Dra. Paula Landaburo --> ConsultaMedica["Ingreso a Consultorio Médico<br/>(Botox, Rellenos, Láser, Bioestimulación)"]
    LlamadoProfesional -- Mercedes (Mechi) --> ConsultaGabinete["Ingreso a Gabinete de Cosmiatría<br/>(Limpieza profunda, Peeling, Total Glow)"]

    ConsultaMedica --> FirmaConsentimiento["Firma de Consentimiento Médico Informado<br/>(Ley 26.529 / CI-01 a CI-04)"]
    ConsultaGabinete --> FirmaConsentimientoCosm["Consentimiento Cosmiátrico (CI-05)"]

    FirmaConsentimiento --> Procedimiento["Realización del Procedimiento Clínico"]
    FirmaConsentimientoCosm --> Procedimiento
    Procedimiento --> FinAtencion([Paciente pasa al mostrador de cobro])
```

---

## 3. Proceso de Cobro y Facturación en Mostrador

Liquidación económica del procedimiento médico o venta de productos de skincare.

```mermaid
flowchart TD
    InicioCobro([Paciente se presenta en mostrador]) --> CotizarServicio["Recepción consulta honorarios en /dashboard/tratamientos"]
    CotizarServicio --> PreguntarMedioPago{¿Medio de pago elegido?}

    PreguntarMedioPago -- Efectivo --> CobroEfectivo["Recepción recibe efectivo y cuenta billetes"]
    PreguntarMedioPago -- Transferencia --> CobroTransferencia["Paciente transfiere a CBU/Alias del consultorio<br/>(Recepción valida comprobante en app bancaria)"]
    PreguntarMedioPago -- Mercado Pago / QR --> CobroMP["Paciente escanea QR o pasa tarjeta por terminal Point"]

    CobroEfectivo --> RegistrarPago["Registrar cobro en el sistema (/dashboard/operativo)<br/>(Inserta fila en payments con monto, medio y paciente)"]
    CobroTransferencia --> RegistrarPago
    CobroMP --> RegistrarPago

    RegistrarPago --> EmiteRecibo["Entrega de comprobante / recibo al paciente"]
    EmiteRecibo --> FinCobro([Cobro completado y registrado])
```

---

## 4. Proceso de Cierre Diario de Caja (End of Day)

Al concluir las actividades de la tarde (17:00 / 19:00 hs), el personal operativo realiza el balance de caja para garantizar que no existan desfasajes entre el dinero físico y el sistema.

```mermaid
flowchart TD
    FinJornada([Hora de Cierre del Consultorio]) --> AccesoCierre["Acceso a /dashboard/cierre-diario"]
    AccesoCierre --> RecuentoEfectivo["Conteo físico de todo el efectivo en cajón"]
    RecuentoEfectivo --> ConsultaTotalSistema["Sistema calcula total ARS de payments del día<br/>WHERE payment_method = 'efectivo' AND superseded_by IS NULL"]
    ConsultaTotalSistema --> CompararCaja{¿Efectivo físico coincide con el sistema?}

    CompararCaja -- Sí (Coincide exacto) --> ValidarDigitales["Validar total de transferencias y cobros MP"]
    CompararCaja -- No (Diferencia detectada) --> InvestigarDiferencia["Revisar recibos manuales o cobros no asentados"]
    InvestigarDicarDiferencia --> AjustarOJustificar["Asentar cobro faltante o registrar nota explicativa"]
    AjustarOJustificar --> ValidarDigitales

    ValidarDigitales --> ConfirmarCierre["Cerrar sesión de caja y generar reporte"]
    ConfirmarCierre --> ResguardoDinero["Guardado seguro del efectivo en caja fuerte"]
    ResguardoDinero --> CierreCompletado([Jornada cerrada exitosamente])
```

---

## 5. Proceso de Gestión y Arqueo Físico de Inventario

Garantiza la correspondencia 1:1 entre los 39 productos registrados en el sistema y las existencias físicas en vitrinas y depósitos.

```mermaid
flowchart TD
    subgraph IngresoMercaderia ["1. Ingreso de Nuevo Lote Sulderm"]
        LlegaPaquete["Llega encomienda de laboratorio a Alem 45"] --> CotejarRemito["Verificar unidades contra remito físico"]
        CotejarRemito --> RegistrarIngreso["Ir a /dashboard/productos/movimientos<br/>(Registrar 'ingreso_stock' con delta positivo)"]
        RegistrarIngreso --> ActualizaStock["El sistema actualiza stock_quantity automáticamente"]
    end

    subgraph ConsumoGabinete ["2. Uso de Insumos en Gabinete"]
        MechiAbreCrema["Mercedes utiliza producto en tratamiento"] --> RegistrarGabinete["Registrar 'uso_gabinete' en movimientos"]
        RegistrarGabinete --> DescuentaStock["Se descuenta stock físico sin generar cobro de venta"]
    end

    subgraph ArqueoMensual ["3. Arqueo Mensual de Inventario"]
        DiaArqueo["Jornada de Recuento Físico"] --> AbrirRecuento["Acceder a /dashboard/productos/recuento"]
        AbrirRecuento --> ConteoFisico["Conteo manual estante por estante"]
        ConteoFisico --> IngresoCantidades["Ingresar counted_qty por cada producto"]
        IngresoCantidades --> SistemaCalculaDiff["Sistema compara counted_qty vs stock_quantity actual"]
        SistemaCalculaDiff --> GenerarAjustes["Genera movimientos 'recuento_fisico' inmutables<br/>para igualar el stock real"]
    end
```

---

## 6. Proceso de Despacho de Pedidos Web (Modo Tienda Online)

Cuando el checkout online se encuentra activo (`store_config.checkout_enabled = true`), este es el protocolo de cumplimiento para los pedidos que ingresan por la web.

```mermaid
flowchart TD
    AlertaPedido([Ingreso de pedido web en orders]) --> NotifOperativo["Aparece en /dashboard/operativo (Inbox Pedidos Pendientes)"]
    NotifOperativo --> TomaPedido["Personal operativo toma el pedido para empaque"]
    TomaPedido --> BuscaStock["Retira productos de vitrina/depósito"]
    BuscaStock --> Empaqueta["Prepara bolsa con packaging oficial y folletos"]
    Empaqueta --> MarcaPreparado["Marca pedido como 'preparado' en el dashboard<br/>(Se estampa prepared_at y prepared_by)"]
    MarcaPreparado --> EnvioMail["Sistema envía correo a paciente: 'Tu pedido está listo'"]

    EnvioMail --> TipoEntrega{¿Método de entrega?}

    TipoEntrega -- Retiro en Consultorio --> PacienteRetira["Paciente retira en Alem 45 presentando nombre/DNI"]
    TipoEntrega -- Envío a Domicilio --> DespachoCorreo["Se entrega al cadete / servicio de encomienda"]

    PacienteRetira --> MarcaEntregado["Marca como 'entregado' en el dashboard<br/>(Se estampa delivered_at y delivered_by)"]
    DespachoCorreo --> MarcaEntregado
    MarcaEntregado --> PedidoCerrado([Pedido Finalizado con Éxito])
```
