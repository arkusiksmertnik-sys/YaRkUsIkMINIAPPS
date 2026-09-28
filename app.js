const SUPABASE_URL = 'https://ktdzlkfoqunuwanpmxnt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0ZHpsa2ZvcXVudXdhbnBteG50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDgzNTIsImV4cCI6MjEwNjE4NDM1Mn0.KPVqb5R9h1u4OCIkY27T4GBsoNeps4yen3o4gpBBmhw';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const ADMIN_TELEGRAM_ID = 7261979362;

const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
}

function isAdmin() {
    const user = tg?.initDataUnsafe?.user;
    return user && Number(user.id) === Number(ADMIN_TELEGRAM_ID);
}

// Переключение Вкладок через Dock Панель
function switchTab(tabName) {
    const buttons = document.querySelectorAll('.dock-btn');
    const tabs = document.querySelectorAll('.tab-content');

    buttons.forEach(btn => btn.classList.remove('active'));
    tabs.forEach(tab => tab.classList.remove('active'));

    if (tabName === 'tracks') {
        buttons[0].classList.add('active');
        document.getElementById('tab-tracks').classList.add('active');
    } else if (tabName === 'news') {
        buttons[1].classList.add('active');
        document.getElementById('tab-news').classList.add('active');
    } else if (tabName === 'upcoming') {
        buttons[2].classList.add('active');
        document.getElementById('tab-upcoming').classList.add('active');
    } else if (tabName === 'info') {
        buttons[3].classList.add('active');
        document.getElementById('tab-info').classList.add('active');
    }
}

function openAdminModal() { document.getElementById('admin-modal').style.display = 'flex'; }
function closeAdminModal() { document.getElementById('admin-modal').style.display = 'none'; }

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

let allTracks = [];
let allNews = [];

async function loadTracks() {
    const { data: tracks, error } = await db.from('tracks').select('*').order('id', { ascending: false });
    if (error || !tracks) return;

    allTracks = tracks;
    document.getElementById('total-tracks-count').innerText = tracks.length;

    renderTracks(allTracks.filter(t => !t.is_upcoming), 'tracks-list');
    renderTracks(allTracks.filter(t => t.is_upcoming), 'upcoming-list');
}

function renderTracks(tracks, containerId) {
    const container = document.getElementById(containerId);
    if (tracks.length === 0) {
        container.innerHTML = `<div class="loading-spinner">В этом разделе пока ничего нет</div>`;
        return;
    }

    container.innerHTML = tracks.map(t => `
        <div class="track-card">
            <div class="track-top">
                <img class="track-cover" src="${t.cover || 'https://via.placeholder.com/150'}" alt="${t.title}" />
                <div class="track-details">
                    <div class="track-title">${t.title} ${t.is_upcoming ? '🔥' : ''}</div>
                    <div class="author-tag">
                        <span>Автор: <strong>YaRkUsIk</strong></span>
                        <span class="blue-badge">✓</span>
                    </div>
                    ${t.release_date ? `<div class="track-date">Релиз: ${t.release_date}</div>` : ''}
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
    if (error || !news) return;

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
            ${isAdmin() ? `<div style="margin-top:10px;"><button class="delete-btn" onclick="deleteNews(${n.id})">🗑 Удалить</button></div>` : ''}
        </div>
    `).join('');
}

function handleSearch() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const filteredTracks = allTracks.filter(t => t.title.toLowerCase().includes(query));
    renderTracks(filteredTracks.filter(t => !t.is_upcoming), 'tracks-list');
    renderTracks(filteredTracks.filter(t => t.is_upcoming), 'upcoming-list');
}

function shareTrack(title, link) {
    if (navigator.share) {
        navigator.share({ title: `YaRkUsIk — ${title}`, url: link || window.location.href });
    } else {
        navigator.clipboard.writeText(link || window.location.href);
        alert('Ссылка скопирована!');
    }
}

async function deleteTrack(id) {
    if (!confirm('Удалить трек?')) return;
    await db.from('tracks').delete().eq('id', id);
    loadTracks();
}

async function deleteNews(id) {
    if (!confirm('Удалить новость?')) return;
    await db.from('news').delete().eq('id', id);
    loadNews();
}

async function handleTrackSubmit(e) {
    e.preventDefault();
    if (!isAdmin()) return;

    const trackData = {
        title: document.getElementById('track-title').value,
        cover: document.getElementById('track-cover').value,
        audio: document.getElementById('track-audio').value,
        link: document.getElementById('track-link').value,
        release_date: document.getElementById('track-date').value,
        is_upcoming: document.getElementById('track-upcoming').checked
    };

    const { error } = await db.from('tracks').insert([trackData]);
    if (!error) {
        closeAdminModal();
        loadTracks();
    }
}

async function handleNewsSubmit(e) {
    e.preventDefault();
    if (!isAdmin()) return;

    const newsData = {
        text: document.getElementById('news-text').value,
        image: document.getElementById('news-image').value,
        date: new Date().toLocaleDateString('ru-RU')
    };

    const { error } = await db.from('news').insert([newsData]);
    if (!error) {
        closeAdminModal();
        loadNews();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (tg?.initDataUnsafe?.user) {
        const user = tg.initDataUnsafe.user;
        document.getElementById('user-name').innerText = user.first_name || 'YaRkUsIk';
        if (user.photo_url) document.getElementById('user-avatar').src = user.photo_url;
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
