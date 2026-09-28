const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors());
app.use(express.json());

// Токен бота и твои права админа
const BOT_TOKEN = "8725200601:AAHKWptj_5YpKg-Y7II4xfsfESrxVm1I0eI"; 
const ADMIN_TELEGRAM_ID = 7261979362 ; // <--- Вставь сюда свои цифры (без кавычек)

// Автоматически создаём локальную базу данных SQLite
const db = new sqlite3.Database('./database.sqlite');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT, cover TEXT, audio TEXT, link TEXT, release_date TEXT, is_upcoming INTEGER
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT, image TEXT, date TEXT
    )`);
});

// Проверка подлинности данных от Telegram
function verifyTelegramData(initData) {
    if (!initData) return false;
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');

    const paramsStr = Array.from(urlParams.entries())
        .map(([key, value]) => `${key}=${value}`)
        .sort()
        .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(paramsStr).digest('hex');

    if (calculatedHash !== hash) return false;
    return JSON.parse(urlParams.get('user') || '{}');
}

// Проверка, что запрос шлёт именно админ
function adminAuth(req, res, next) {
    const user = verifyTelegramData(req.body.initData);
    if (user && user.id === ADMIN_TELEGRAM_ID) {
        req.adminUser = user;
        next();
    } else {
        res.status(403).json({ error: 'Доступ запрещён. Вы не администратор.' });
    }
}

// Запросы данных для всех пользователей
app.get('/api/tracks', (req, res) => {
    db.all("SELECT * FROM tracks ORDER BY id DESC", [], (err, rows) => res.json(rows || []));
});

app.get('/api/news', (req, res) => {
    db.all("SELECT * FROM news ORDER BY id DESC", [], (err, rows) => res.json(rows || []));
});

app.post('/api/admin/check', (req, res) => {
    const user = verifyTelegramData(req.body.initData);
    res.json({ isAdmin: user && user.id === ADMIN_TELEGRAM_ID });
});

// Добавление трека (Только для админа)
app.post('/api/admin/tracks', adminAuth, (req, res) => {
    const { title, cover, audio, link, release_date, is_upcoming } = req.body;
    db.run(
        `INSERT INTO tracks (title, cover, audio, link, release_date, is_upcoming) VALUES (?, ?, ?, ?, ?, ?)`,
        [title, cover, audio, link, release_date, is_upcoming ? 1 : 0],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// Публикация новости (Только для админа)
app.post('/api/admin/news', adminAuth, (req, res) => {
    const { text, image } = req.body;
    const date = new Date().toLocaleDateString('ru-RU');
    db.run(
        `INSERT INTO news (text, image, date) VALUES (?, ?, ?)`,
        [text, image, date],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

app.listen(3000, () => console.log('🚀 Сервер базы данных запущен на порту 3000!'));
