// ===== ตั้งค่าตรงนี้ =====
// วาง URL ของ Google Apps Script Web App ที่ deploy แล้ว (ขั้นตอน 3.2 ในคู่มือ)
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwXXtLycQHnP56FXLvYCO5jXBFzH03w5CTLpaDlfcLrAkhy_i5AbRXMHEDfiYjhnxLZZw/exec";
// วาง URL แบบ CSV ของ Google Sheet ที่ publish แล้ว (ขั้นตอน 3.3 ในคู่มือ) สำหรับหน้าแอดมิน
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTqHxy0PW0fKOMUXshkuUNxM91khftg76ZqV9kYVVhdnCY8Wi3JhxFklu5SvzfCia5ZeVt1tZTDENkb/pub?output=csv";
// ==========================

async function loadBooks() {
  const res = await fetch("books.json");
  return res.json();
}

const GENRE_LABELS = {
  fiction: "นิยาย",
  selfdev: "พัฒนาตัวเอง",
  business: "ธุรกิจ",
  poetry: "บทกวี"
};

function bookCardHTML(book) {
  const coverInner = `<div class="fallback-spine" style="background:${book.spineColor}">${book.title}</div>`;
  return `
    <div class="book-card">
      <div class="book-cover">${coverInner}</div>
      <div class="book-info">
        <span class="book-genre">${book.genreLabel}</span>
        <h3 class="book-title">${book.title}</h3>
        <p class="book-author">${book.author}</p>
        <p class="book-price">${book.price.toLocaleString()} บาท</p>
      </div>
      <a class="btn" href="order.html?id=${book.id}">สั่งซื้อ</a>
    </div>`;
}

async function initProductPage() {
  const listEl = document.getElementById("product-list");
  const filterEl = document.getElementById("filter-bar");
  if (!listEl) return;

  const books = await loadBooks();
  const params = new URLSearchParams(location.search);
  let activeGenre = params.get("genre") || "all";

  const genres = ["all", ...Array.from(new Set(books.map(b => b.genre)))];

  function renderFilters() {
    filterEl.innerHTML = genres.map(g => {
      const label = g === "all" ? "ทั้งหมด" : GENRE_LABELS[g] || g;
      const active = g === activeGenre ? "active" : "";
      return `<button class="filter-btn ${active}" data-genre="${g}">${label}</button>`;
    }).join("");

    filterEl.querySelectorAll(".filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        activeGenre = btn.dataset.genre;
        renderFilters();
        renderList();
      });
    });
  }

  function renderList() {
    const filtered = activeGenre === "all" ? books : books.filter(b => b.genre === activeGenre);
    listEl.innerHTML = filtered.map(bookCardHTML).join("") || "<p>ไม่พบหนังสือในหมวดนี้</p>";
  }

  renderFilters();
  renderList();
}

async function initSeriesGrid() {
  const grid = document.getElementById("series-grid");
  if (!grid) return;
  const books = await loadBooks();
  grid.innerHTML = books.map((b, i) => `
    <a class="genre-card" href="order.html?id=${b.id}">
      <span class="tag-dot" style="background:${b.spineColor}"></span>
      <h3>Book ${i + 1}</h3>
      <p>${b.title.replace("Harry Potter and the ", "")}</p>
    </a>`).join("");
}

async function initOrderPage() {
  const form = document.getElementById("orderForm");
  if (!form) return;

  const itemsEl = document.getElementById("items");
  const totalEl = document.getElementById("total");
  const msgEl = document.getElementById("formMsg");

  const params = new URLSearchParams(location.search);
  const bookId = params.get("id");
  if (bookId) {
    const books = await loadBooks();
    const book = books.find(b => b.id === bookId);
    if (book) {
      itemsEl.value = `${book.title} (${book.author})`;
      totalEl.value = book.price;
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msgEl.textContent = "";
    msgEl.className = "form-msg";

    const payload = {
      timestamp: new Date().toLocaleString("th-TH"),
      customerName: document.getElementById("customerName").value.trim(),
      contact: document.getElementById("contact").value.trim(),
      items: itemsEl.value.trim(),
      total: totalEl.value,
      note: document.getElementById("note").value.trim()
    };

    if (!payload.customerName || !payload.contact || !payload.items) {
      msgEl.textContent = "กรอกข้อมูลให้ครบก่อนนะครับ";
      msgEl.className = "form-msg error";
      return;
    }

    if (APPS_SCRIPT_URL.startsWith("PASTE_")) {
      msgEl.textContent = "ยังไม่ได้ตั้งค่า APPS_SCRIPT_URL ใน script.js";
      msgEl.className = "form-msg error";
      return;
    }

    try {
      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload)
      });
      window.location.href = "thankyou.html";
    } catch (err) {
      msgEl.textContent = "ส่งข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง";
      msgEl.className = "form-msg error";
    }
  });
}

function parseCSV(text) {
  const rows = text.trim().split("\n").map(r => r.split(","));
  const header = rows.shift();
  return rows.map(r => {
    const obj = {};
    header.forEach((h, i) => { obj[h.trim()] = (r[i] || "").trim(); });
    return obj;
  });
}

async function initAdminPage() {
  const tbody = document.querySelector("#ordersTable tbody");
  if (!tbody) return;

  if (SHEET_CSV_URL.startsWith("PASTE_")) {
    tbody.innerHTML = `<tr><td colspan="6">ยังไม่ได้ตั้งค่า SHEET_CSV_URL ใน script.js</td></tr>`;
    return;
  }

  try {
    const res = await fetch(SHEET_CSV_URL);
    const text = await res.text();
    const orders = parseCSV(text);
    tbody.innerHTML = orders.map(o => `
      <tr>
        <td>${o.timestamp || ""}</td>
        <td>${o.customerName || ""}</td>
        <td>${o.contact || ""}</td>
        <td>${o.items || ""}</td>
        <td>${o.total || ""}</td>
        <td>${o.note || ""}</td>
      </tr>`).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
  }
}

initProductPage();
initSeriesGrid();
initOrderPage();
initAdminPage();
