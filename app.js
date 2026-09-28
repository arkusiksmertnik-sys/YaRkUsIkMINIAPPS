const SUPABASE_URL = 'https://ktdzlkfoqunuwanpmxnt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0ZHpsa2ZvcXVudXdhbnBteG50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDgzNTIsImV4cCI6MjEwNjE4NDM1Mn0.KPVqb5R9h1u4OCIkY27T4GBsoNeps4yen3o4gpBBmhw';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// СТРОГО ID АДМИНА YARKUSIK (ТОЛЬКО ЕМУ ГАЛОЧКА И АДМИНКА)
const ADMIN_TELEGRAM_ID = 7261979362;

const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
}

function getUser() {
    return tg?.initDataUnsafe?.user || { id: 999999, first_name: 'Пользователь' };
}

function isArtistAdmin() {
    const user = getUser();
    return Number(user.id) === Number(ADMIN_TELEGRAM_ID);
}

// Конвертация файлов с устройства в Base64 для сохранения прямо в БД
function convertFileToBase64(fileInput, hiddenInputId) {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = function () {
        document.getElementById(hiddenInputId).value = reader.result;
    };
    reader.readAsDataURL(file);
}

// Переключение Вкладок
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

function openAdminModal() { 
    document.getElementById('admin-modal').style.display = 'flex'; 
    populateBoostSelect();
}
function closeAdminModal() { document.getElementById('admin-modal').style.display = 'none'; }

function switchAdminTab(type) {
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-form').forEach(f => f.classList.remove('active'));

    if (type === 'add-track') {
        document.querySelectorAll('.admin-tab-btn')[0].classList.add('active');
        document.getElementById('form-track').classList.add('active');
    } else if (type === 'add-news') {
        document.querySelectorAll('.admin-tab-btn')[1].classList.add('active');
        document.getElementById('form-news').classList.add('active');
    } else {
        document.querySelectorAll('.admin-tab-btn')[2].classList.add('active');
        document.getElementById('form-likes').classList.add('active');
    }
}

let allTracks = [];
let allNews = [];

// Локальное хранение пресейвов юзера
function getSavedPresaves() {
    return JSON.parse(localStorage.getItem('user_presaves') || '[]');
}

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
        container.innerHTML = `<div class="loading-spinner">В этом разделе пока нет треков</div>`;
        return;
    }

    const savedPresaves = getSavedPresaves();

    container.innerHTML = tracks.map(t => {
        const isPreSave = t.is_upcoming;
        const isSaved = savedPresaves.includes(t.id);
        const likesCount = t.likes || 0;

        return `
        <div class="track-card">
            <div class="track-top">
                <img class="track-cover" src="${t.cover || 'https://via.placeholder.com/150/1c0508/ff2a55?text=Y'}" alt="${t.title}" />
                <div class="track-details">
                    <div class="track-title">${t.title} ${isPreSave ? '🔥' : ''}</div>
                    <div class="author-tag">
                        <span>Автор: <strong>YaRkUsIk</strong></span>
                        <span class="blue-badge">✓</span>
                    </div>
                    ${t.release_date ? `<div class="track-date">Дата: ${t.release_date}</div>` : ''}
                </div>
            </div>

            ${t.audio ? `
                <div class="custom-audio-player">
                    <button class="play-pause-btn" onclick="toggleAudio('audio-${t.id}', this)">▶</button>
                    <audio id="audio-${t.id}" src="${t.audio}" onended="this.previousElementSibling.innerText='▶'"></audio>
                    <div style="font-size:12px; color:rgba(255,255,255,0.6);">Прослушать сниппет/трек</div>
                </div>
            ` : ''}

            <div class="track-actions">
                <button class="like-btn" onclick="likeTrack(${t.id}, ${likesCount})">
                    ❤️ <span>${likesCount}</span>
                </button>

                ${isPreSave ? `
                    <button class="presave-btn ${isSaved ? 'saved' : ''}" onclick="togglePresave(${t.id})">
                        ${isSaved ? '✅ Pre-Saved' : '🔥 Pre-Save'}
                    </button>
                ` : ''}

                ${t.link ? `<a class="listen-link" href="${t.link}" target="_blank">Слушать ➔</a>` : ''}
                <button class="share-btn" onclick="shareTrack('${t.title}', '${t.link}')">🔗</button>
                ${isArtistAdmin() ? `<button class="delete-btn" onclick="deleteTrack(${t.id})">🗑</button>` : ''}
            </div>
        </div>
        `;
    }).join('');
}

function toggleAudio(audioId, btn) {
    const audio = document.getElementById(audioId);
    if (audio.paused) {
        document.querySelectorAll('audio').forEach(a => a.pause());
        document.querySelectorAll('.play-pause-btn').forEach(b => b.innerText = '▶');
        audio.play();
        btn.innerText = '❚❚';
    } else {
        audio.pause();
        btn.innerText = '▶';
    }
}

async function likeTrack(id, currentLikes) {
    const newLikes = currentLikes + 1;
    await db.from('tracks').update({ likes: newLikes }).eq('id', id);
    loadTracks();
}

function togglePresave(id) {
    let presaves = getSavedPresaves();
    if (presaves.includes(id)) {
        presaves = presaves.filter(pId => pId !== id);
    } else {
        presaves.push(id);
    }
    localStorage.setItem('user_presaves', JSON.stringify(presaves));
    document.getElementById('user-presaves-count').innerText = presaves.length;
    loadTracks();
}

async function loadNews() {
    const container = document.getElementById('news-list');
    const { data: news, error } = await db.from('news').select('*').order('id', { ascending: false });
    if (error || !news) return;

    allNews = news;

    if (news.length > 0) {
        // Показываем последний пост на главной
        const latest = news[0];
        document.getElementById('latest-news-banner').style.display = 'block';
        document.getElementById('latest-news-content').innerHTML = `
            <p style="font-size:14px; margin-bottom:8px;">${latest.text}</p>
            <div style="font-size:11px; color:rgba(255,255,255,0.4);">Дата: ${latest.date || ''}</div>
        `;
    }

    if (news.length === 0) {
        container.innerHTML = `<div class="loading-spinner">Новостей пока нет</div>`;
        return;
    }

    container.innerHTML = news.map(n => `
        <div class="news-card">
            ${n.image ? `<img class="news-img" src="${n.image}" style="width:100%; border-radius:14px;" />` : ''}
            <div class="news-text" style="font-size:14px; line-height:1.4;">${n.text}</div>
            <div class="news-footer" style="display:flex; justify-content:space-between; margin-top:10px; font-size:12px;">
                <div class="author-tag">
                    <span>Автор: <strong>YaRkUsIk</strong></span>
                    <span class="blue-badge">✓</span>
                </div>
                <span style="color:rgba(255,255,255,0.4);">${n.date || ''}</span>
            </div>
            ${isArtistAdmin() ? `<div style="margin-top:10px;"><button class="delete-btn" onclick="deleteNews(${n.id})">🗑 Удалить</button></div>` : ''}
        </div>
    `).join('');
}

function populateBoostSelect() {
    const select = document.getElementById('boost-track-select');
    select.innerHTML = allTracks.map(t => `<option value="${t.id}">${t.title} (Сейчас: ${t.likes || 0} ❤️)</option>`).join('');
}

async function applyLikesBoost() {
    const trackId = document.getElementById('boost-track-select').value;
    const newLikes = parseInt(document.getElementById('boost-likes-count').value);

    if (!trackId || isNaN(newLikes)) return alert('Укажите корректные данные');

    await db.from('tracks').update({ likes: newLikes }).eq('id', trackId);
    alert('Лайки успешно обновлены!');
    closeAdminModal();
    loadTracks();
}

function handleSearch() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const filtered = allTracks.filter(t => t.title.toLowerCase().includes(query));
    renderTracks(filtered.filter(t => !t.is_upcoming), 'tracks-list');
    renderTracks(filtered.filter(t => t.is_upcoming), 'upcoming-list');
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
    if (!isArtistAdmin()) return;

    const trackData = {
        title: document.getElementById('track-title').value,
        cover: document.getElementById('track-cover-data').value,
        audio: document.getElementById('track-audio-data').value,
        link: document.getElementById('track-link').value,
        release_date: document.getElementById('track-date').value,
        likes: parseInt(document.getElementById('track-initial-likes').value) || 0,
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
    if (!isArtistAdmin()) return;

    const newsData = {
        text: document.getElementById('news-text').value,
        image: document.getElementById('news-image-data').value,
        date: new Date().toLocaleDateString('ru-RU')
    };

    const { error } = await db.from('news').insert([newsData]);
    if (!error) {
        closeAdminModal();
        loadNews();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const user = getUser();
    const isOwner = isArtistAdmin();

    // Персонализация профиля пользователя
    document.getElementById('user-name').innerText = user.first_name || 'Гость';
    document.getElementById('profile-hero-name').innerText = user.first_name || 'Гость';
    
    if (user.photo_url) {
        document.getElementById('user-avatar').src = user.photo_url;
        document.getElementById('profile-hero-avatar').src = user.photo_url;
    }

    // Синяя галочка и доступ к админке — ТОЛЬКО ДЛЯ YARKUSIK
    if (isOwner) {
        document.getElementById('verified-badge').style.display = 'inline-flex';
        document.getElementById('hero-badge').style.display = 'inline-flex';
        document.getElementById('role-badge').innerText = 'Official Artist';
        document.getElementById('profile-hero-status').innerText = 'Verified Creator';
        document.getElementById('admin-badge').style.display = 'block';
    } else {
        document.getElementById('verified-badge').style.display = 'none';
        document.getElementById('hero-badge').style.display = 'none';
        document.getElementById('role-badge').innerText = 'Слушатель';
        document.getElementById('profile-hero-status').innerText = 'Ценитель музыки';
        document.getElementById('admin-badge').style.display = 'none';
    }

    document.getElementById('user-presaves-count').innerText = getSavedPresaves().length;

    loadTracks();
    loadNews();
});
