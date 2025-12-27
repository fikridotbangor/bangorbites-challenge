# 🎮 Game Brief — *Mouth Hunter*

## 📌 Deskripsi Singkat

**Mouth Hunter** adalah game berbasis web yang menggunakan kamera (webcam) sebagai input utama. Pemain membuka mulut untuk “memakan” objek yang muncul di layar. Game ini memanfaatkan teknologi *face detection* untuk mendeteksi pergerakan mulut secara real-time.

Game ini bersifat kasual, interaktif, dan cocok untuk:

* eksperimen teknologi AI + web
* event activation
* konten interaktif
* portofolio developer

---

## 🎯 Tujuan Game

Membuat pengalaman bermain yang unik dan menyenangkan dengan interaksi alami (gesture wajah), tanpa keyboard atau mouse.

---

## 🧠 Konsep Utama

* Kamera aktif mendeteksi wajah pemain
* Sistem membaca posisi & status mulut (terbuka / tertutup)
* Objek muncul di layar
* Saat mulut terbuka dan mengenai objek → objek dimakan
* Skor bertambah

---

## 🎥 Mekanisme Kamera

* Menggunakan webcam bawaan device
* Deteksi wajah menggunakan **Face Mesh**
* Mengambil landmark mulut
* Menghitung jarak bibir untuk menentukan status “open / close”
* Kamera hanya digunakan secara real-time (tanpa penyimpanan data)

---

## 🎮 Alur Gameplay

### 1. Start Screen

* Judul game
* Tombol:

  * **Start Game**
  * **Allow Camera**
* Petunjuk singkat:

  > “Buka mulutmu untuk memakan objek!”

---

### 2. Gameplay

* Kamera aktif
* Objek makanan muncul secara acak
* Pemain membuka mulut
* Jika posisi mulut bertabrakan dengan objek → berhasil dimakan
* Skor bertambah

---

### 3. End Game

* Game selesai ketika:

  * waktu habis, atau
  * target skor tercapai
* Menampilkan:

  * skor akhir
  * skor tertinggi
  * tombol replay

---

## 🍔 Objek dalam Game

Contoh objek:

* 🍔 Burger
* 🍕 Pizza
* 🍩 Donut
* 🍟 Kentang
* 🧁 Cupcake

Karakteristik objek:

* muncul secara acak
* memiliki ukuran tertentu
* dapat diganti dengan gambar atau emoji
* bisa muncul satu atau beberapa sekaligus

---

## 🧠 Aturan Deteksi “Makan”

Makan dianggap valid jika:

1. Mulut dalam kondisi **terbuka**
2. Jarak bibir atas dan bawah melewati ambang batas tertentu
3. Posisi objek berada di dalam radius mulut
4. Tidak sedang dalam cooldown

---

## 📊 Sistem Skor

* +1 poin untuk setiap objek yang berhasil dimakan
* (opsional) bonus combo
* skor disimpan selama sesi permainan

---

## 🛠️ Teknologi yang Digunakan

### Frontend

* HTML5
* CSS
* JavaScript

### Kamera & AI

* MediaPipe FaceMesh
* WebRTC (`getUserMedia`)
* Canvas API

### Rendering

* HTML Canvas
* (Opsional) WebGL / Three.js

---

## 🧱 Struktur Folder (Contoh)

```txt
/project
 ├── index.html
 ├── style.css
 ├── main.js
 ├── camera.js
 ├── faceDetection.js
 ├── gameLogic.js
 ├── assets/
 │   ├── food/
```

---

## 🎨 UI / UX Style

* Fun
* Playful
* Colorful
* Responsive
* Ramah mobile & desktop
* Fokus pada visual interaktif

---

## 🔊 Audio (Opsional)

* Sound effect saat objek dimakan
* Background music ringan
* Feedback suara untuk skor

---

## 🧪 Target Platform

* Google Chrome
* Microsoft Edge
* Safari (dengan izin kamera)
* Desktop & mobile browser

---

## 🚀 Pengembangan Lanjutan (Future Scope)

### Level 2 – Gameplay

* Objek bergerak
* Level meningkat
* Timer
* Difficulty scaling

### Level 3 – Interaksi

* Deteksi arah kepala
* Gesture wajah tambahan
* Power-up

### Level 4 – Advanced

* Multiplayer (WebSocket)
* Leaderboard online
* Login user
* Penyimpanan skor
* Mode AR-like
* 3D objek (Three.js)

---

## 🎯 Use Case

* Game kasual berbasis web
* Aktivasi event & booth
* Campaign interaktif
* Demo AI & Computer Vision
* Portfolio developer
* Eksperimen creative coding

---

## 📌 Ringkasan Singkat

> Game berbasis web yang memanfaatkan kamera untuk mendeteksi mulut pemain sebagai kontrol utama dalam memakan objek dan mendapatkan skor.
