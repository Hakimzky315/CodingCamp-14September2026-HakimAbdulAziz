# CodingCamp-14September2026-HakimAbdulAziz
CodingCamp-14September2026-HakimAbdulAziz
# 💰 Expense & Budget Visualizer

Aplikasi pencatat dan pemantau keuangan pribadi berbasis web yang interaktif, responsif, dan ringan. Dibuat menggunakan **HTML, CSS, dan JavaScript murni (Vanilla JS)** serta memanfaatkan `localStorage` untuk menyimpan data transaksi secara lokal di browser.

![Project Status](https://img.shields.io/badge/Status-Completed-success)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## ✨ Fitur Utama

- **Pelacakan Pemasukan & Pengeluaran**: Catat setiap transaksi lengkap dengan kategori dan nominal.
- **Kategori Dinamis**: Pilihan kategori pada form input menyesuaikan secara otomatis berdasarkan tipe transaksi yang dipilih (Pemasukan atau Pengeluaran).
- **Grafik Interaktif (Chart.js)**: Visualisasi sebaran transaksi menggunakan grafik *Doughnut Chart* yang dinamis dengan palet warna unik untuk setiap kategori.
- **Manajemen Anggaran (Budget)**: Fitur untuk menetapkan batas anggaran harian/bulanan beserta pemantauan saldonya.
- **Penyimpanan Lokal (localStorage)**: Data transaksi tetap tersimpan dengan aman di browser meskipun halaman di-refresh.
- **Desain Responsif & Dark Mode**: Tampilan rapi di layar HP maupun laptop menggunakan CSS Grid & Flexbox, serta mendukung mode gelap/terang.

---

## 🛠️ Teknologi yang Digunakan

- **HTML5**: Struktur halaman web yang semantik dan aksesibel.
- **CSS3**: Layouting responsif (Grid & Flexbox), variabel CSS, dan *Custom Styling*.
- **JavaScript (ES6+)**: Logika aplikasi, manipulasi DOM, pemrosesan data, dan integrasi `localStorage`.
- **Chart.js**: *Library* JavaScript untuk menampilkan grafik visualisasi data yang interaktif.

---

## 📂 Struktur Folder Project

```text
├── css/
│   └── style.css       # File gaya utama (responsive layout, theme)
├── js/
│   └── script.js      # Logika kalkulasi, event handler, dan Chart.js
├── index.html          # Halaman utama aplikasi
└── README.md           # Dokumentasi project
