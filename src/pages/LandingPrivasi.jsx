import LandingNav from '../components/LandingNav.jsx'
import WhatsAppWidget from '../components/WhatsAppWidget.jsx'
import LandingFooter from '../components/LandingFooter.jsx'
import { useLandingDarkMode } from '../lib/useLandingDarkMode.js'
import '../landing.css'

export default function LandingPrivasi() {
  const [isDark, toggleDark] = useLandingDarkMode()

  return (
    <div className={`lp ${isDark ? 'dark' : ''}`}>
      <LandingNav isDark={isDark} onToggleDark={toggleDark} />

      <header className="lp-page-header lp-wrap">
        <h1 className="lp-head">Kebijakan Privasi</h1>
        <p>Terakhir diperbarui: 15 September 2026</p>
      </header>

      <section className="lp-section-tight">
        <div className="lp-wrap-narrow lp-legal-text">
          <p>
            Kebijakan Privasi ini menjelaskan bagaimana <strong>PT. Sistem Bisnis Cerdas</strong>
            {' '}("Kami") mengumpulkan, menggunakan, dan melindungi data Anda saat menggunakan
            <strong> My Worksheet</strong> ("Layanan").
          </p>

          <h2>1. Data yang Kami Kumpulkan</h2>
          <p>
            <strong>Data akun</strong>: nama, alamat email, dan kata sandi (terenkripsi) saat
            Anda mendaftar.<br />
            <strong>Data perusahaan &amp; transaksi</strong>: informasi perusahaan, akun (COA),
            transaksi keuangan, kontak, aset, dan data lain yang Anda masukkan ke dalam Layanan.<br />
            <strong>Data penggunaan</strong>: informasi teknis seperti jenis perangkat, browser,
            dan interaksi Anda dengan Layanan, dikumpulkan secara otomatis untuk keperluan
            perbaikan dan keamanan.
          </p>

          <h2>2. Cara Kami Menggunakan Data</h2>
          <p>
            Data yang Kami kumpulkan digunakan untuk: menyediakan dan mengoperasikan Layanan,
            memproses transaksi dan menyusun laporan yang Anda minta, memberikan dukungan
            pelanggan, meningkatkan dan mengembangkan Layanan, serta menjaga keamanan sistem dan
            mencegah penyalahgunaan.
          </p>

          <h2>3. Penyimpanan &amp; Keamanan Data</h2>
          <p>
            Data Anda disimpan pada infrastruktur cloud pihak ketiga (Supabase) dengan
            perlindungan akses berlapis di level basis data (Row Level Security), sehingga setiap
            perusahaan hanya dapat mengakses datanya sendiri. Kami menerapkan langkah-langkah
            keamanan yang wajar untuk melindungi data dari akses tidak sah, namun tidak ada
            sistem yang 100% aman. Anda tetap bertanggung jawab menjaga kerahasiaan kredensial
            akun Anda.
          </p>

          <h2>4. Berbagi Data dengan Pihak Ketiga</h2>
          <p>
            Kami tidak menjual data Anda kepada pihak ketiga. Data dapat dibagikan hanya kepada:
            penyedia infrastruktur yang membantu Kami mengoperasikan Layanan (seperti penyedia
            hosting dan basis data), atau pihak berwenang jika diwajibkan oleh hukum yang
            berlaku.
          </p>

          <h2>5. Hak Anda atas Data</h2>
          <p>
            Anda berhak mengakses, memperbaiki, atau menghapus data Anda kapan saja melalui
            Layanan (termasuk fitur "Hapus Semua Data" pada tiap perusahaan). Anda juga dapat
            meminta ekspor data Anda dengan menghubungi Kami.
          </p>

          <h2>6. Cookie &amp; Teknologi Serupa</h2>
          <p>
            Layanan menggunakan penyimpanan lokal browser (local storage) untuk keperluan
            fungsional seperti menyimpan preferensi bahasa dan sesi login, bukan untuk
            keperluan iklan atau pelacakan pihak ketiga.
          </p>

          <h2>7. Penyimpanan Data Anak</h2>
          <p>
            Layanan ini ditujukan untuk penggunaan bisnis oleh individu dewasa dan bukan
            ditujukan untuk anak-anak. Kami tidak dengan sengaja mengumpulkan data dari anak di
            bawah umur.
          </p>

          <h2>8. Perubahan Kebijakan Ini</h2>
          <p>
            Kami dapat memperbarui Kebijakan Privasi ini dari waktu ke waktu. Perubahan material
            akan diinformasikan melalui Layanan.
          </p>

          <h2>9. Kontak</h2>
          <p>
            Pertanyaan mengenai Kebijakan Privasi ini dapat disampaikan melalui{' '}
            <a href="https://wa.me/6285692050908" target="_blank" rel="noopener noreferrer">WhatsApp</a>.
          </p>
        </div>
      </section>

      <LandingFooter />
      <WhatsAppWidget />
    </div>
  )
}
