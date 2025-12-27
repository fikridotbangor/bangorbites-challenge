# 🍔 Bangor Bites Challenge

Game berbasis web yang menggunakan kamera (webcam) untuk mendeteksi mulut pemain sebagai kontrol utama dalam memakan objek dan mendapatkan skor.

## 🚀 Cara Menjalankan

1. **Buka file `index.html` di browser modern** (Chrome, Edge, atau Safari)
2. **Klik "Allow Camera"** untuk memberikan izin akses kamera
3. **Klik "Start Game"** untuk memulai permainan
4. **Buka mulutmu** untuk memakan objek yang muncul di layar!

## 🎮 Cara Bermain

- Objek makanan akan muncul secara acak di layar
- Buka mulutmu saat objek berada di dekat mulutmu
- Jika posisi mulut bertabrakan dengan objek → objek dimakan dan skor bertambah
- Game berakhir setelah waktu habis (60 detik)
- Coba capai skor tertinggi!

## 🛠️ Teknologi

- **HTML5** - Struktur game
- **CSS3** - Styling dan animasi
- **JavaScript** - Logika game
- **MediaPipe FaceMesh** - Deteksi wajah dan mulut
- **WebRTC** - Akses webcam
- **Canvas API** - Rendering game

## 📁 Struktur File

```
javascript-game/
├── index.html          # Halaman utama game
├── style.css           # Styling game
├── main.js             # Orchestrasi utama game
├── camera.js           # Manajemen webcam
├── faceDetection.js    # Deteksi wajah dan mulut (MediaPipe)
├── gameLogic.js        # Logika game, objek, collision, scoring
├── assets/
│   └── food/           # Asset gambar makanan
└── README.md           # Dokumentasi
```

## 🎯 Fitur

- ✅ Deteksi mulut real-time menggunakan MediaPipe FaceMesh
- ✅ Objek makanan muncul secara acak
- ✅ Sistem skor dan high score (disimpan di localStorage)
- ✅ Timer 60 detik
- ✅ UI yang colorful dan responsive
- ✅ Pause/Resume functionality
- ✅ Responsif untuk desktop dan mobile

## 📝 Catatan

- Game memerlukan akses kamera untuk berfungsi
- Pastikan browser mendukung WebRTC dan MediaPipe
- Untuk hasil terbaik, gunakan di lingkungan yang cukup terang
- High score disimpan di localStorage browser

## 🔮 Pengembangan Lanjutan

Fitur yang bisa ditambahkan:
- Sound effects saat memakan objek
- Background music
- Power-ups dan combo system
- Level difficulty yang meningkat
- Objek bergerak dengan pola lebih kompleks
- Multiplayer mode

---

Selamat bermain! 🎉

