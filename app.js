// Конфигурация Supabase с твоими ключами
const SUPABASE_URL = 'https://ktdzlkfoqunuwanpmxnt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0ZHpsa2ZvcXVudXdhbnBteG50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDgzNTIsImV4cCI6MjEwNjE4NDM1Mn0.KPVqb5R9h1u4OCIkY27T4GBsoNeps4yen3o4gpBBmhw';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Твой Telegram ID — с галочкой и правами администратора
const ADMIN_TELEGRAM_ID = 7261979362;

const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
}

// Проверка админа
function isAdmin() {
    const user = tg?.initDataUnsafe?.user;
    return user && Number(user.id) === Number(ADMIN_TELEGRAM_ID);
}

// Переключение Вкладок
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    if (tabName === 'tracks') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('tab-tracks').classList.add('active');
    } else if (tabName === 'news') {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('tab-news').classList.add('active');
    } else if (tabName === 'stats') {
        document.querySelectorAll('.tab-btn')[2].classList.add('active');
        document.getElementById('tab-stats').classList.add('active');
    }
}

// Окна Админки
function openAdminModal() {
    document.getElementById('admin-modal').style.display = 'flex';
}

function closeAdminModal() {
    document.getElementById('admin-modal').style.display = 'none';
}

function switchAdminTab(type) {
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-form').forEach(f => f.classList.remove('active'));

    if (type === 'add-track') {
        document.querySelectorAll('.admin-tab-btn')[0].classList.add('active');
        document.getElementById('form-track').classList.add('active');
    } else {
        document.querySelectorAll('.admin-tab-btn')[1].classList.add('active');
        document.getElementById('form-news').classList.add('active');
    }
}

// Поделиться треком
function shareTrack(title, link) {
    if (navigator.share) {
        navigator.share({
            title: `YaRkUsIk — ${title}`,
            text: `Слушай новый трек от YaRkUsIk: ${title}`,
            url: link || window.location.href
        });
    } else {
        navigator.clipboard.writeText(link || window.location.href);
        alert('Ссылка скопирована!');
    }
}

// Данные треков и новостей
let allTracks = [];
let allNews = [];

async function loadTracks() {
    const container = document.getElementById('tracks-list');
    const { data: tracks, error } = await db.from('tracks').select('*').order('id', { ascending: false });

    if (error || !tracks) {
        container.innerHTML = `<div class="loading-spinner">Ошибка загрузки треков</div>`;
        return;
    }

    allTracks = tracks;
    document.getElementById('total-tracks-count').innerText = tracks.length;
    renderTracks(allTracks);
}

function renderTracks(tracks) {
    const container = document.getElementById('tracks-list');
    if (tracks.length === 0) {
        container.innerHTML = `<div class="loading-spinner">Треков не найдено</div>`;
        return;
    }

    container.innerHTML = tracks.map(t => `
        <div class="track-card">
            <div class="track-top">
                <img class="track-cover" src="${t.cover || 'https://via.placeholder.com/150'}" alt="${t.title}" />
                <div class="track-details">
                    <div class="track-title">${t.title} ${t.is_upcoming ? '🔥 [Сниппет]' : ''}</div>
                    <div class="author-tag">
                        <span>Автор: <strong>YaRkUsIk</strong></span>
                        <span class="blue-badge">✓</span>
                    </div>
                    ${t.release_date ? `<div class="track-date">Дата: ${t.release_date}</div>` : ''}
                </div>
            </div>

            ${t.audio ? `<audio controls src="${t.audio}"></audio>` : ''}

            <div class="track-actions">
                ${t.link ? `<a class="listen-link" href="${t.link}" target="_blank">Слушать ➔</a>` : ''}
                <button class="share-btn" onclick="shareTrack('${t.title}', '${t.link}')">🔗 Поделиться</button>
                ${isAdmin() ? `<button class="delete-btn" onclick="deleteTrack(${t.id})">🗑 Удалить</button>` : ''}
            </div>
        </div>
    `).join('');
}

async function loadNews() {
    const container = document.getElementById('news-list');
    const { data: news, error } = await db.from('news').select('*').order('id', { ascending: false });

    if (error || !news) {
        container.innerHTML = `<div class="loading-spinner">Ошибка загрузки новостей</div>`;
        return;
    }

    allNews = news;
    document.getElementById('total-news-count').innerText = news.length;

    if (news.length === 0) {
        container.innerHTML = `<div class="loading-spinner">Новостей пока нет</div>`;
        return;
    }

    container.innerHTML = news.map(n => `
        <div class="news-card">
            ${n.image ? `<img class="news-img" src="${n.image}" alt="News" />` : ''}
            <div class="news-text">${n.text}</div>
            <div class="news-footer">
                <div class="author-tag">
                    <span>Автор: <strong>YaRkUsIk</strong></span>
                    <span class="blue-badge">✓</span>
                </div>
                <span>${n.date || ''}</span>
            </div>
            ${isAdmin() ? `<div style="margin-top:10px;"><button class="delete-btn" onclick="deleteNews(${n.id})">🗑 Удалить публикацию</button></div>` : ''}
        </div>
    `).join('');
}

// Поиск в реальном времени
function handleSearch() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const filteredTracks = allTracks.filter(t => t.title.toLowerCase().includes(query));
    renderTracks(filteredTracks);
}

// Удаление записей (Админ)
async function deleteTrack(id) {
    if (!confirm('Удалить этот трек?')) return;
    await db.from('tracks').delete().eq('id', id);
    loadTracks();
}

async function deleteNews(id) {
    if (!confirm('Удалить эту новость?')) return;
    await db.from('news').delete().eq('id', id);
    loadNews();
}

// Создание трека
async function handleTrackSubmit(e) {
    e.preventDefault();
    if (!isAdmin()) return alert('Нет прав!');

    const trackData = {
        title: document.getElementById('track-title').value,
        cover: document.getElementById('track-cover').value,
        audio: document.getElementById('track-audio').value,
        link: document.getElementById('track-link').value,
        release_date: document.getElementById('track-date').value,
        is_upcoming: document.getElementById('track-upcoming').checked
    };

    const { error } = await db.from('tracks').insert([trackData]);
    if (error) {
        alert('Ошибка добавления: ' + error.message);
    } else {
        alert('Трек опубликован от имени YaRkUsIk ☑️!');
        closeAdminModal();
        loadTracks();
    }
}

// Создание новости
async function handleNewsSubmit(e) {
    e.preventDefault();
    if (!isAdmin()) return alert('Нет прав!');

    const newsData = {
        text: document.getElementById('news-text').value,
        image: document.getElementById('news-image').value,
        date: new Date().toLocaleDateString('ru-RU')
    };

    const { error } = await db.from('news').insert([newsData]);
    if (error) {
        alert('Ошибка добавления: ' + error.message);
    } else {
        alert('Новость опубликована от имени YaRkUsIk ☑️!');
        closeAdminModal();
        loadNews();
    }
}

// Старт приложения
document.addEventListener('DOMContentLoaded', () => {
    if (tg?.initDataUnsafe?.user) {
        const user = tg.initDataUnsafe.user;
        const userNameElem = document.getElementById('user-name');
        userNameElem.innerText = user.first_name || 'YaRkUsIk';
        
        if (user.photo_url) {
            document.getElementById('user-avatar').src = user.photo_url;
        }

        // Если это твоя учетная запись (Telegram ID: 7261979362)
        if (Number(user.id) === Number(ADMIN_TELEGRAM_ID)) {
            document.getElementById('role-badge').innerText = 'Verified Admin';
        }
    }

    if (isAdmin()) {
        document.getElementById('admin-badge').style.display = 'block';
    }

    loadTracks();
    loadNews();
});
