-- =============================================================================
-- Dra. Landaburo — Supabase Schema
-- Referencia: esquema_base_de_datos_supabase.md
-- Ejecutar en: Supabase SQL Editor (Panel → SQL Editor → New query)
-- Orden de ejecución: este archivo completo, de arriba hacia abajo.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLA profiles (extiende auth.users — RBAC)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id            uuid        NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text        NOT NULL UNIQUE,
  full_name     text        NOT NULL,
  phone         text,
  role          text        NOT NULL DEFAULT 'paciente'
                            CHECK (role IN ('admin', 'medico', 'operativo', 'paciente')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role  ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Trigger: actualiza updated_at automáticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger: crea un profile cuando se registra un usuario nuevo en auth.users
-- El campo full_name se lee de raw_user_meta_data (seteado en signUp options.data)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'paciente'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own_or_admin ON public.profiles
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY profiles_update_own_or_admin ON public.profiles
  FOR UPDATE USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- 2. TABLA patients (ficha clínica)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patients (
  id            uuid        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name     text        NOT NULL,
  dni           text        UNIQUE,
  phone         text        NOT NULL,
  email         text,
  rfm_segment   text        DEFAULT 'Nuevo'
                            CHECK (rfm_segment IN ('Activos', 'En Riesgo', 'No Perder', 'Nuevo', 'Inactivo')),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patients_phone ON public.patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_rfm   ON public.patients(rfm_segment);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY patients_staff_all ON public.patients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'medico', 'operativo')
    )
  );

CREATE POLICY patients_patient_read_own ON public.patients
  FOR SELECT USING (auth.uid() = profile_id);

-- ---------------------------------------------------------------------------
-- 3. TABLA treatments (catálogo de 102 tratamientos)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.treatments (
  id                 uuid        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               text        NOT NULL UNIQUE,
  title              text        NOT NULL,
  category           text        NOT NULL
                                 CHECK (category IN ('Facial', 'Corporal', 'Capilar', 'Dermatologia Clinica', 'Cosmetologia')),
  description        text        NOT NULL,
  price_ars          numeric(12,2),
  price_usd          numeric(12,2),
  duration_minutes   integer     NOT NULL DEFAULT 30,
  professional_role  text        NOT NULL DEFAULT 'medico'
                                 CHECK (professional_role IN ('medico', 'cosmetologa')),
  commission_rate    numeric(5,2) NOT NULL DEFAULT 0.00,
  is_active          boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_treatments_slug     ON public.treatments(slug);
CREATE INDEX IF NOT EXISTS idx_treatments_category ON public.treatments(category);

ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;

CREATE POLICY treatments_read_public ON public.treatments
  FOR SELECT USING (true);

CREATE POLICY treatments_write_admin ON public.treatments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- 4. TABLA products (catálogo de dermocosmética)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id               uuid        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text        NOT NULL,
  slug             text        NOT NULL UNIQUE,
  category         text        NOT NULL,
  price_ars        numeric(12,2) NOT NULL,
  stock_quantity   integer     NOT NULL DEFAULT 0,
  min_stock_alert  integer     NOT NULL DEFAULT 5,
  sku              text        UNIQUE,
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_read_public ON public.products
  FOR SELECT USING (true);

CREATE POLICY products_write_admin ON public.products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- 5. TABLA product_batches (lotes y vencimientos)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_batches (
  id              uuid    NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid    NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_number    text    NOT NULL,
  expiration_date date    NOT NULL,
  quantity        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_batches_expiry ON public.product_batches(expiration_date);

ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY batches_admin_only ON public.product_batches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- 6. TABLA orders (compras e-commerce)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id                       uuid        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number             text        NOT NULL UNIQUE,
  patient_id               uuid        REFERENCES public.patients(id) ON DELETE SET NULL,
  total_ars                numeric(12,2) NOT NULL,
  payment_status           text        NOT NULL DEFAULT 'pending'
                                       CHECK (payment_status IN ('pending', 'approved', 'rejected', 'refunded')),
  payment_method           text        NOT NULL
                                       CHECK (payment_method IN ('mercadopago', 'transferencia', 'efectivo')),
  mercadopago_payment_id   text,
  shipping_status          text        NOT NULL DEFAULT 'pending',
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(payment_status);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_read_own ON public.orders
  FOR SELECT USING (
    patient_id IN (SELECT id FROM public.patients WHERE profile_id = auth.uid())
  );

CREATE POLICY orders_admin_all ON public.orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- 7. TABLA order_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
  id             uuid        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id     uuid        NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity       integer     NOT NULL DEFAULT 1,
  unit_price_ars numeric(12,2) NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Visibility inherited from orders via join; admin full access
CREATE POLICY order_items_admin ON public.order_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY order_items_patient_read ON public.order_items
  FOR SELECT USING (
    order_id IN (
      SELECT o.id FROM public.orders o
      JOIN public.patients pa ON pa.id = o.patient_id
      WHERE pa.profile_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 8. TABLA gift_cards
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gift_cards (
  id                       uuid        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  code                     text        NOT NULL UNIQUE,
  purchaser_patient_id     uuid        REFERENCES public.patients(id) ON DELETE SET NULL,
  amount_ars               numeric(12,2) NOT NULL,
  remaining_balance_ars    numeric(12,2) NOT NULL,
  status                   text        NOT NULL DEFAULT 'active'
                                       CHECK (status IN ('active', 'redeemed', 'expired')),
  expiration_date          timestamptz NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY gift_cards_admin_all ON public.gift_cards
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY gift_cards_read_purchaser ON public.gift_cards
  FOR SELECT USING (
    purchaser_patient_id IN (SELECT id FROM public.patients WHERE profile_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 9. TABLA appointments (turnos médicos)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointments (
  id                       uuid        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id               uuid        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  treatment_id             uuid        NOT NULL REFERENCES public.treatments(id) ON DELETE RESTRICT,
  professional_profile_id  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  appointment_date         timestamptz NOT NULL,
  status                   text        NOT NULL DEFAULT 'scheduled'
                                       CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(appointment_date);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY appointments_staff ON public.appointments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'medico', 'operativo')
    )
  );

CREATE POLICY appointments_patient_read ON public.appointments
  FOR SELECT USING (
    patient_id IN (SELECT id FROM public.patients WHERE profile_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 10. TABLA payments (registro financiero y comisiones)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id                       uuid        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id           uuid        REFERENCES public.appointments(id) ON DELETE SET NULL,
  order_id                 uuid        REFERENCES public.orders(id) ON DELETE SET NULL,
  patient_id               uuid        NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  amount_ars               numeric(12,2) NOT NULL,
  amount_usd               numeric(12,2),
  currency                 text        NOT NULL DEFAULT 'ARS'
                                       CHECK (currency IN ('ARS', 'USD')),
  payment_method           text        NOT NULL
                                       CHECK (payment_method IN ('efectivo', 'transferencia', 'mercadopago')),
  professional_profile_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  commission_amount_ars    numeric(12,2) NOT NULL DEFAULT 0.00,
  payment_date             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_date         ON public.payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_professional ON public.payments(professional_profile_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_admin_all ON public.payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY payments_medico_own ON public.payments
  FOR SELECT USING (professional_profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 11. TABLA employee_tasks (tareas operativas del personal)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_tasks (
  id                   uuid        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_profile_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title                text        NOT NULL,
  description          text,
  due_date             date        NOT NULL DEFAULT CURRENT_DATE,
  is_completed         boolean     NOT NULL DEFAULT false,
  completed_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_tasks_due ON public.employee_tasks(due_date, is_completed);

ALTER TABLE public.employee_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY employee_tasks_own ON public.employee_tasks
  FOR ALL USING (assigned_profile_id = auth.uid());

CREATE POLICY employee_tasks_admin ON public.employee_tasks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- 12. TABLA cookie_consents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cookie_consents (
  id                   uuid    NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash              text    NOT NULL,
  analytics_accepted   boolean NOT NULL DEFAULT false,
  marketing_accepted   boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cookie_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY cookie_consents_insert_public ON public.cookie_consents
  FOR INSERT WITH CHECK (true);

CREATE POLICY cookie_consents_select_admin ON public.cookie_consents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
