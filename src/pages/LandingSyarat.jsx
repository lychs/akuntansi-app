import LandingNav from '../components/LandingNav.jsx'
import WhatsAppWidget from '../components/WhatsAppWidget.jsx'
import LandingFooter from '../components/LandingFooter.jsx'
import { useLandingDarkMode } from '../lib/useLandingDarkMode.js'
import '../landing.css'

export default function LandingSyarat() {
  const [isDark, toggleDark] = useLandingDarkMode()

  return (
    <div className={`lp ${isDark ? 'dark' : ''}`}>
      <LandingNav isDark={isDark} onToggleDark={toggleDark} />

      <header className="lp-page-header lp-wrap">
        <h1 className="lp-head">Syarat &amp; Ketentuan</h1>
        <p>Terakhir diperbarui: 15 September 2026</p>
      </header>

      <section className="lp-section-tight">
        <div className="lp-wrap-narrow lp-legal-text">
          <p>
            Syarat &amp; Ketentuan ini mengatur penggunaan layanan <strong>My Worksheet</strong>
            ("Layanan"), yang disediakan oleh <strong>PT. Sistem Bisnis Cerdas</strong> ("Kami").
            Dengan mendaftar, mengakses, atau menggunakan Layanan, Anda ("Pengguna") setuju untuk
            terikat oleh syarat dan ketentuan berikut.
          </p>

          <h2>1. Definisi</h2>
          <p>
            "Layanan" berarti aplikasi dan situs web My Worksheet beserta seluruh fitur di
            dalamnya. "Akun" berarti akun yang dibuat Pengguna untuk mengakses Layanan.
            "Data Pengguna" berarti seluruh data transaksi, keuangan, dan informasi bisnis lain
            yang dimasukkan Pengguna ke dalam Layanan.
          </p>

          <h2>2. Penerimaan Syarat</h2>
          <p>
            Dengan membuat Akun, Anda menyatakan bahwa Anda berwenang untuk mengikat entitas
            bisnis yang Anda wakili (jika ada) pada Syarat &amp; Ketentuan ini, dan bahwa Anda
            telah membaca serta memahami seluruh isi dokumen ini.
          </p>

          <h2>3. Akun Pengguna</h2>
          <p>
            Anda bertanggung jawab menjaga kerahasiaan kredensial login Anda dan atas seluruh
            aktivitas yang terjadi di bawah Akun Anda. Segera beri tahu Kami jika Anda menduga
            ada penggunaan Akun yang tidak sah.
          </p>

          <h2>4. Penggunaan Layanan</h2>
          <p>
            Layanan disediakan untuk membantu pencatatan dan pengelolaan keuangan bisnis Anda.
            Anda setuju untuk tidak menggunakan Layanan untuk tujuan yang melanggar hukum, tidak
            mencoba mengakses sistem secara tidak sah, dan tidak mengganggu operasional Layanan
            bagi pengguna lain.
          </p>

          <h2>5. Kewajiban Pengguna</h2>
          <p>
            Anda bertanggung jawab penuh atas keakuratan Data Pengguna yang dimasukkan ke dalam
            Layanan. My Worksheet adalah alat bantu pencatatan. Kami tidak bertanggung jawab
            atas keputusan bisnis, kewajiban pajak, atau audit yang timbul dari data yang
            dimasukkan secara keliru oleh Pengguna.
          </p>

          <h2>6. Data &amp; Kerahasiaan</h2>
          <p>
            Data Pengguna tetap menjadi milik Pengguna. Kami mengakses Data Pengguna hanya
            sejauh diperlukan untuk mengoperasikan dan memelihara Layanan, sebagaimana dijelaskan
            lebih lanjut pada <a href="/kebijakan-privasi">Kebijakan Privasi</a> Kami.
          </p>

          <h2>7. Ketersediaan Layanan</h2>
          <p>
            Kami berupaya menjaga Layanan tetap tersedia, namun tidak menjamin operasional tanpa
            gangguan 100%. Kami dapat melakukan pemeliharaan terjadwal maupun tidak terjadwal
            yang dapat memengaruhi ketersediaan Layanan untuk sementara waktu.
          </p>

          <h2>8. Paket &amp; Pembayaran</h2>
          <p>
            Layanan tersedia dalam beberapa paket (Free, Pro, Business) sebagaimana dijelaskan
            di halaman <a href="/harga">Harga</a>. Rincian biaya untuk paket berbayar akan
            diinformasikan secara terpisah saat Anda menghubungi Kami untuk berlangganan.
          </p>

          <h2>9. Pembatasan Tanggung Jawab</h2>
          <p>
            Sejauh diizinkan oleh hukum yang berlaku, Kami tidak bertanggung jawab atas kerugian
            tidak langsung, insidental, atau konsekuensial yang timbul dari penggunaan atau
            ketidakmampuan menggunakan Layanan, termasuk namun tidak terbatas pada kehilangan
            data, keuntungan, atau peluang bisnis.
          </p>

          <h2>10. Perubahan Layanan &amp; Syarat Ini</h2>
          <p>
            Kami dapat mengubah, menambah, atau menghentikan sebagian fitur Layanan dari waktu
            ke waktu. Kami juga dapat memperbarui Syarat &amp; Ketentuan ini; perubahan material
            akan diinformasikan melalui Layanan atau saluran komunikasi lain yang Kami miliki.
          </p>

          <h2>11. Pengakhiran</h2>
          <p>
            Anda dapat berhenti menggunakan Layanan kapan saja. Kami berhak menangguhkan atau
            mengakhiri Akun yang terbukti melanggar Syarat &amp; Ketentuan ini.
          </p>

          <h2>12. Hukum yang Berlaku</h2>
          <p>
            Syarat &amp; Ketentuan ini diatur dan ditafsirkan berdasarkan hukum Republik
            Indonesia.
          </p>

          <h2>13. Kontak</h2>
          <p>
            Pertanyaan mengenai Syarat &amp; Ketentuan ini dapat disampaikan melalui{' '}
            <a href="https://wa.me/6285692050908" target="_blank" rel="noopener noreferrer">WhatsApp</a>.
          </p>
        </div>
      </section>

      <LandingFooter />
      <WhatsAppWidget />
    </div>
  )
}
