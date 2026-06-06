# Auto-Clicker & Liker Pro (Chrome Extension)

Aplikasi auto-clicker dan auto-liker pintar yang didesain untuk TikTok Web serta mendukung klik koordinat kustom secara universal di situs web mana pun.

Dengan arsitektur **Floating Panel Melayang**, panel kontrol tidak akan pernah tertutup secara otomatis saat robot aktif mengeklik atau menggulir layar.

## Fitur Utama

- **Panel Melayang di Halaman (Floating Panel)**: Panel kontrol disuntikkan langsung ke dalam halaman web menggunakan teknologi *Shadow DOM* yang terisolasi. Panel ini dapat **diseret (dragged)** ke bagian layar mana saja dan dapat **diminimalkan (minimized)** agar tidak menghalangi konten.
- **Visual & Animasi Premium**:
  - **Pulsing Radar Target**: Titik target kustom yang Anda pilih akan menampilkan cincin merah berpendar yang membesar secara berkelanjutan (efek radar) sebagai indikator lokasi aktif.
  - **Click Ripple Effect**: Setiap kali klik otomatis dieksekusi, cincin riak cyan melingkar akan muncul di titik koordinat tersebut selama 0.4 detik (efek umpan balik tap).
- **Mode TikTok DOM Cerdas (Khusus TikTok)**: Mencari tombol Like di halaman TikTok secara otomatis. Jika struktur halaman berubah, ekstensi memiliki *fallback* untuk melakukan klik-ganda (*double-click*) pada video agar Like tetap berhasil, dipadukan dengan Auto-Scroll.
- **Mode Universal (Klik Koordinat Kustom)**: Untuk situs web selain TikTok (atau jika Anda ingin target spesifik di TikTok), Anda bisa menentukan titik koordinat klik kustom di layar secara visual.
- **Jeda Waktu Manusiawi (Human-like Jitter)**: Menyediakan jeda acak dinamis (±1.5 detik) agar aman dari sistem deteksi bot.

---

## Panduan Instalasi (Google Chrome)

1. Buka browser **Google Chrome**.
2. Ketik dan buka alamat berikut di tab browser Anda:
   ```txt
   chrome://extensions/
   ```
3. Aktifkan **Developer mode** (Mode Pengembang) melalui tombol saklar di pojok kanan atas halaman.
4. Klik tombol **Load unpacked** (Muat ekstensi tidak dikemas) di pojok kiri atas.
5. Cari dan pilih folder proyek ini:
   ```txt
   /Users/robykartis/Documents/ROBY/GITHUB/MITUNI/Auto-clik
   ```
6. Ekstensi **Auto-Clicker & Liker Pro** kini siap digunakan. *Tips: Klik ikon puzzle di Chrome dan pilih ikon Pin di sebelah ekstensi agar ikon selalu muncul di toolbar browser.*

---

## Cara Penggunaan

### A. Penggunaan di TikTok (Mode Cerdas)
1. Buka situs [tiktok.com](https://www.tiktok.com/) dan masuk ke akun TikTok Anda.
2. Klik ikon ekstensi **Auto-Clicker & Liker Pro** di toolbar Chrome Anda untuk membuka panel kontrol.
3. Sesuaikan konfigurasi dasar: **Auto Scroll**, **Jeda Manusiawi**, dan **Jeda Waktu**.
4. Klik tombol cyan **MULAI AUTO-CLICK**. Sistem secara otomatis akan menyukai video dan melakukan scroll ke video selanjutnya.

### B. Penggunaan di Semua Situs Web (Mode Klik Kustom)
1. Buka situs mana pun di browser Anda.
2. Klik ikon ekstensi **Auto-Clicker & Liker Pro** di toolbar Chrome untuk memunculkan panel kontrol melayang.
3. Aktifkan opsi **Lokasi Klik Kustom**, lalu klik tombol **Pilih Lokasi**.
4. Arahkan kursor ke titik yang ingin Anda klik secara otomatis, lalu klik mouse Anda untuk mengunci koordinat. Indikator radar merah berpendar akan muncul pada titik tersebut.
5. Klik tombol cyan **MULAI AUTO-CLICK**. Ekstensi akan terus mengeklik titik tersebut dengan jeda waktu yang ditentukan.
6. Anda dapat menyalakan opsi **Auto Scroll** jika ingin halaman secara otomatis bergulir ke bawah setelah setiap klik kustom dieksekusi.

---

## Kontrol Panel
- **Minimize**: Klik ikon minus di kanan atas panel untuk menciutkan ukuran panel kontrol. Klik ikon plus untuk membukanya kembali.
- **Close (X)**: Klik ikon silang di pojok kanan atas untuk menyembunyikan panel. Klik ikon ekstensi di toolbar Chrome Anda untuk memunculkannya kembali.
- **Reset**: Klik ikon putar balik di sebelah tulisan "Total Klik/Like" untuk mengatur ulang penghitung klik menjadi nol.
