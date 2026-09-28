const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Замените на токен вашего бота в файле .env (BOT_TOKEN=...)
const BOT_TOKEN = process.env.BOT_TOKEN || "ВАШ_ТОКЕН_БОТА"; 
const ADMIN_TELEGRAM_ID = Number(process.env.ADMIN_ID || "123456789"); // Ваш Telegram ID

const db = new sqlite3.Database('./database.sqlite');

// Инициализация БД
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

// Безопасная валидация initData от Telegram
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

    const user = JSON.parse(urlParams.get('user') || '{}');
    return user;
}

// Middleware проверки прав Админа
function adminAuth(req, res, next) {
    const user = verifyTelegramData(req.body.initData);
    if (user && user.id === ADMIN_TELEGRAM_ID) {
        req.adminUser = user;
        next();
    } else {
        res.status(403).json({ error: 'Доступ запрещен. Вы не администратор.' });
    }
}

// Pubic API
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

// Protected Admin API
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

app.listen(3000, () => console.log('Сервер запущен на порту 3000'));
