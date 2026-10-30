import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WhatsAppButton from '@/components/layout/WhatsAppButton';
import styles from '@/components/legal/LegalPage.module.css';

export const metadata: Metadata = {
  title: 'Política de Privacidad',
  description:
    'Política de Privacidad y protección de datos personales de dralandaburo.com conforme a la Ley Nº 25.326.',
  alternates: {
    canonical: 'https://dralandaburo.com/politica-de-privacidad',
  },
};

export default function PoliticaDePrivacidadPage() {
  return (
    <>
      <Header />
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <h1 className={styles.title}>Política de Privacidad</h1>
            <p className={styles.updatedAt}>Última actualización: 30 de octubre de 2026</p>
          </div>
        </section>

        <section className={styles.articleSection}>
          <article className={styles.article}>
            <section className={styles.section}>
              <h2 className={styles.h2}>Quién es responsable de tus datos</h2>
              <p className={styles.paragraph}>
                El responsable de la base de datos es Paula Natalia Margarita Landaburo, CUIT 27-30485775-2, con domicilio en Leandro N. Alem 45, Gualeguaychú, Provincia de Entre Ríos.
              </p>
              <p className={styles.paragraph}>
                Para cualquier consulta sobre tus datos personales podés escribir a{' '}
                <a href="mailto:dra.landaburo@gmail.com" className={styles.inlineLink}>
                  dra.landaburo@gmail.com
                </a>
                .
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.h2}>Qué datos recolectamos</h2>
              <p className={styles.paragraph}>Según cómo uses el sitio, podemos recolectar:</p>

              <h3 className={styles.h3}>Si agendás una consulta o te registrás en el portal de pacientes</h3>
              <ul className={styles.list}>
                <li>Nombre y apellido</li>
                <li>Teléfono</li>
                <li>Correo electrónico</li>
                <li>DNI</li>
                <li>Fecha de nacimiento</li>
              </ul>

              <h3 className={styles.h3}>Si comprás en la tienda</h3>
              <ul className={styles.list}>
                <li>Los datos de contacto y facturación necesarios para procesar el pedido</li>
                <li>El detalle de lo que compraste</li>
              </ul>

              <h3 className={styles.h3}>Si navegás el sitio</h3>
              <ul className={styles.list}>
                <li>Datos técnicos de la visita (tipo de dispositivo, navegador, páginas vistas) con fines estadísticos</li>
              </ul>
            </section>

            <section className={styles.section}>
              <h2 className={styles.h2}>Qué datos NO guardamos</h2>
              <p className={styles.paragraph}>
                No almacenamos en este sitio historia clínica, diagnósticos, observaciones clínicas ni motivos de consulta.
              </p>
              <p className={styles.paragraph}>
                Del tratamiento, el sistema registra únicamente la fecha y el tratamiento realizado, a los fines administrativos y de facturación. La información clínica se maneja exclusivamente en la historia clínica del consultorio, fuera de este sitio.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.h2}>Para qué los usamos</h2>
              <ul className={styles.list}>
                <li>Gestionar turnos y la relación de atención</li>
                <li>Procesar compras y emitir comprobantes</li>
                <li>Enviarte comunicaciones sobre tus turnos, pedidos o tratamientos</li>
                <li>Enviarte novedades y promociones, solo si lo aceptaste, y siempre con opción de baja</li>
                <li>Cumplir obligaciones legales, contables e impositivas</li>
              </ul>
            </section>

            <section className={styles.section}>
              <h2 className={styles.h2}>Con quién los compartimos</h2>
              <p className={styles.paragraph}>
                No vendemos ni cedemos tus datos personales. Los compartimos únicamente con proveedores que nos prestan servicios necesarios para que el sitio funcione:
              </p>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Proveedor</th>
                      <th>Para qué</th>
                      <th>Qué recibe</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Mercado Pago</td>
                      <td>Procesar pagos</td>
                      <td>Los datos necesarios para la transacción</td>
                    </tr>
                    <tr>
                      <td>Supabase</td>
                      <td>Base de datos y autenticación</td>
                      <td>Los datos de tu cuenta y tus pedidos</td>
                    </tr>
                    <tr>
                      <td>Amazon Web Services</td>
                      <td>Alojamiento del sitio</td>
                      <td>Datos técnicos de la visita</td>
                    </tr>
                    <tr>
                      <td>Resend</td>
                      <td>Envío de correos</td>
                      <td>Tu correo electrónico</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className={styles.paragraph}>
                Cada uno de ellos trata los datos únicamente para prestarnos ese servicio.
              </p>
              <p className={styles.paragraph}>
                Los datos de pago no pasan por nuestros servidores. Los procesa directamente Mercado Pago; nosotros no vemos ni almacenamos números de tarjeta.
              </p>
              <p className={styles.paragraph}>
                Algunos de estos proveedores alojan información fuera de la Argentina. Al usar el sitio prestás conformidad con esa transferencia internacional, que se realiza con proveedores que aplican estándares adecuados de seguridad.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.h2}>Cuánto tiempo los conservamos</h2>
              <p className={styles.paragraph}>
                Conservamos tus datos mientras exista la relación de atención o comercial, y después por el plazo que exijan las normas contables, impositivas y sanitarias aplicables. Vencidos esos plazos, los eliminamos o anonimizamos.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.h2}>Tus derechos</h2>
              <p className={styles.paragraph}>
                Como titular de los datos tenés derecho a acceder, rectificar, actualizar y suprimir tus datos personales.
              </p>
              <p className={styles.paragraph}>
                Para ejercerlos, escribinos a{' '}
                <a href="mailto:dra.landaburo@gmail.com" className={styles.inlineLink}>
                  dra.landaburo@gmail.com
                </a>{' '}
                indicando tu nombre y DNI. Respondemos dentro de los plazos legales.
              </p>
              <p className={styles.paragraph}>
                El titular de los datos personales tiene la facultad de ejercer el derecho de acceso al mismo en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto, conforme lo establecido en el artículo 14, inciso 3 de la Ley Nº 25.326.
              </p>
              <p className={styles.paragraph}>
                La Agencia de Acceso a la Información Pública, en su carácter de órgano de control de la Ley Nº 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.h2}>Cookies</h2>
              <p className={styles.paragraph}>
                Usamos cookies propias para mantener tu sesión iniciada y recordar el contenido de tu carrito. También podemos usar cookies de medición para entender cómo se usa el sitio.
              </p>
              <p className={styles.paragraph}>
                Podés bloquear o eliminar las cookies desde la configuración de tu navegador. Si bloqueás las cookies propias, el inicio de sesión y el carrito pueden dejar de funcionar.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.h2}>Seguridad</h2>
              <p className={styles.paragraph}>
                Aplicamos medidas técnicas y organizativas para proteger tus datos: conexión cifrada (HTTPS), control de acceso por roles y contraseñas almacenadas de forma cifrada.
              </p>
              <p className={styles.paragraph}>
                Ningún sistema es completamente infalible, pero trabajamos para mantener un nivel de protección acorde a la sensibilidad de la información.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.h2}>Menores de edad</h2>
              <p className={styles.paragraph}>
                El sitio no está dirigido a menores de 18 años y no recolectamos deliberadamente sus datos. Las consultas de menores se gestionan con el consentimiento de su madre, padre o tutor.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.h2}>Cambios</h2>
              <p className={styles.paragraph}>
                Si modificamos esta política, actualizamos la fecha del encabezado. Si el cambio es significativo, lo avisamos por los canales habituales.
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
