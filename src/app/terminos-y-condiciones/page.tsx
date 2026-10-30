import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WhatsAppButton from '@/components/layout/WhatsAppButton';
import styles from '@/components/legal/LegalPage.module.css';

export const metadata: Metadata = {
  title: 'Términos y Condiciones',
  description:
    'Términos y Condiciones de uso del sitio dralandaburo.com, tienda online y portal de pacientes.',
  alternates: {
    canonical: 'https://dralandaburo.com/terminos-y-condiciones',
  },
};

export default function TerminosYCondicionesPage() {
  return (
    <>
      <Header />
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <h1 className={styles.title}>Términos y Condiciones</h1>
            <p className={styles.updatedAt}>Última actualización: 30 de octubre de 2026</p>
          </div>
        </section>

        <section className={styles.articleSection}>
          <article className={styles.article}>
            <section className={styles.section}>
              <h2 className={styles.h2}>Alcance</h2>
              <p className={styles.paragraph}>
                Estos términos regulan el uso del sitio dralandaburo.com, operado por Paula Natalia Margarita Landaburo, CUIT 27-30485775-2, con domicilio en Leandro N. Alem 45, Gualeguaychú, Provincia de Entre Ríos. Al usar el sitio, aceptás estos términos.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.h2}>El contenido del sitio no es asesoramiento médico</h2>
              <p className={styles.paragraph}>
                La información sobre tratamientos publicada en este sitio es de carácter general e informativo. No constituye un diagnóstico, una indicación médica ni reemplaza una consulta profesional.
              </p>
              <p className={styles.paragraph}>
                Ningún tratamiento se indica sin una consulta previa presencial. Los resultados varían según cada persona y no pueden garantizarse.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.h2}>Turnos</h2>
              <p className={styles.paragraph}>
                Agendar una consulta a través del sitio es una solicitud de turno, que se confirma desde el consultorio por los canales de contacto que dejaste.
              </p>
              <p className={styles.paragraph}>
                Si no podés asistir, te pedimos avisar con la mayor anticipación posible para liberar el horario.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.h2}>Compras en la tienda</h2>
              <p className={styles.paragraph}>
                Los precios están expresados en pesos argentinos e incluyen IVA salvo que se indique lo contrario.
              </p>
              <p className={styles.paragraph}>
                Los precios y el stock pueden modificarse sin aviso previo. El precio aplicable es el vigente al momento de confirmar la compra.
              </p>
              <p className={styles.paragraph}>
                La compra queda perfeccionada cuando el pago es acreditado y recibís la confirmación.
              </p>
              <p className={styles.paragraph}>
                Si un producto quedara sin stock después de confirmada la compra, te contactamos para ofrecerte el reintegro o un reemplazo.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.h2}>Pagos</h2>
              <p className={styles.paragraph}>
                Los pagos se procesan a través de Mercado Pago. No almacenamos datos de tarjetas. Las condiciones de financiación, cuotas y recargos son las que Mercado Pago informa al momento del pago.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.h2}>Derecho de arrepentimiento</h2>
              <p className={styles.paragraph}>
                Conforme al artículo 34 de la Ley 24.240 de Defensa del Consumidor, en las compras a distancia tenés derecho a arrepentirte de la compra dentro de los 10 días corridos desde la recepción del producto, sin expresar causa y sin costo alguno.
              </p>
              <p className={styles.paragraph}>
                Para ejercerlo, escribinos a{' '}
                <a href="mailto:dra.landaburo@gmail.com" className={styles.inlineLink}>
                  dra.landaburo@gmail.com
                </a>
                . El producto debe devolverse sin uso y en su envase original. El reintegro se realiza por el mismo medio de pago.
              </p>
              <p className={styles.paragraph}>
                El derecho de arrepentimiento no aplica a servicios ya prestados, como una consulta o un tratamiento ya realizado.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.h2}>Gift cards</h2>
              <p className={styles.paragraph}>
                Las gift cards tienen la vigencia indicada al momento de la compra, no son canjeables por dinero en efectivo y pueden usarse para los servicios y productos que se detallen en cada caso.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.h2}>Portal de pacientes</h2>
              <p className={styles.paragraph}>
                El acceso al portal es personal e intransferible. Sos responsable de mantener la confidencialidad de tu contraseña y de la actividad realizada desde tu cuenta.
              </p>
              <p className={styles.paragraph}>
                Si detectás un acceso no autorizado, avisanos a{' '}
                <a href="mailto:dra.landaburo@gmail.com" className={styles.inlineLink}>
                  dra.landaburo@gmail.com
                </a>
                .
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.h2}>Propiedad intelectual</h2>
              <p className={styles.paragraph}>
                Los textos, imágenes, logos y demás contenidos del sitio son propiedad de Paula Natalia Margarita Landaburo o se utilizan con autorización. No pueden reproducirse sin consentimiento previo por escrito.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.h2}>Disponibilidad</h2>
              <p className={styles.paragraph}>
                Procuramos que el sitio esté disponible de forma continua, pero puede haber interrupciones por mantenimiento o causas ajenas a nuestro control.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.h2}>Datos personales</h2>
              <p className={styles.paragraph}>
                El tratamiento de datos personales se rige por nuestra{' '}
                <Link href="/politica-de-privacidad" className={styles.inlineLink}>
                  Política de Privacidad
                </Link>
                .
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.h2}>Ley aplicable y reclamos</h2>
              <p className={styles.paragraph}>
                Estos términos se rigen por las leyes de la República Argentina.
              </p>
              <p className={styles.paragraph}>
                Si sos consumidor, podés iniciar tu reclamo ante los tribunales con competencia en tu propio domicilio, conforme a las normas de defensa del consumidor. También podés acudir al Servicio de Conciliación Previa en las Relaciones de Consumo (COPREC) y a la Ventanilla Única Federal de Defensa del Consumidor.
              </p>
            </section>
          </article>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
