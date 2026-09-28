const SUPABASE_URL = 'https://ktdzlkfoqunuwanpmxnt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0ZHpsa2ZvcXVudXdhbnBteG50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDgzNTIsImV4cCI6MjEwNjE4NDM1Mn0.KPVqb5R9h1u4OCIkY27T4GBsoNeps4yen3o4gpBBmhw';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const ADMIN_TELEGRAM_ID = 7261979362;

const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
}

function getUser() {
    return tg?.initDataUnsafe?.user || { id: 999888777, first_name: 'Слушатель' };
}

const USER = getUser();
const USER_ID = USER.id;
const USER_NAME = USER.first_name || 'Слушатель';

function isAdmin() {
    return Number(USER_ID) === Number(ADMIN_TELEGRAM_ID);
}

const TASKS = [
    { id: 'sub_channel', title: 'Подписка на официальный канал YaRkUsIk', reward: 500, link: 'https://t.me/yarkusik' },
    { id: 'sub_chat', title: 'Вступить в официальный чат', reward: 300, link: 'https://t.me/yarkusik' }
];

let userBalance = 0;
let allTracks = [];
let allNews = [];

document.addEventListener('DOMContentLoaded', async () => {
    initUserProfile();
    loadTracks();
    loadNews();
    loadTasks();
});

function formatNum(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return (num || 0).toString();
}

function switchTab(tabName) {
    const buttons = document.querySelectorAll('.dock-btn');
    const tabs = document.querySelectorAll('.tab-content');

    buttons.forEach(btn => btn.classList.remove('active'));
    tabs.forEach(tab => tab.classList.remove('active'));

    const tabMap = { 'tracks': 0, 'news': 1, 'earn': 2, 'shop': 3, 'tap': 4, 'info': 5, 'upcoming': 0 };
    if (tabMap[tabName] !== undefined && buttons[tabMap[tabName]]) {
        buttons[tabMap[tabName]].classList.add('active');
    }

    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) targetTab.classList.add('active');
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

async function initUserProfile() {
    document.getElementById('user-name').innerText = USER_NAME;
    document.getElementById('profile-hero-name').innerText = USER_NAME;

    if (USER.photo_url) {
        document.getElementById('user-avatar').src = USER.photo_url;
        document.getElementById('profile-hero-avatar').src = USER.photo_url;
    }

    if (isAdmin()) {
        document.getElementById('verified-badge').style.display = 'inline-flex';
        document.getElementById('hero-badge').style.display = 'inline-flex';
        document.getElementById('role-badge').innerText = 'Official Artist';
        document.getElementById('profile-hero-status').innerText = 'Verified Creator';
        document.getElementById('admin-badge').style.display = 'block';
    }

    let { data: profile } = await db.from('profiles').select('*').eq('telegram_id', USER_ID).single();
    if (!profile) {
        const { data: newProf } = await db.from('profiles').insert([{
            telegram_id: USER_ID,
            first_name: USER_NAME,
            username: USER.username || '',
            ux_gold_balance: 100
        }]).select().single();
        profile = newProf;
    }

    userBalance = profile?.ux_gold_balance || 0;
    updateBalanceUI();
}

function updateBalanceUI() {
    document.getElementById('header-balance').innerText = formatNum(userBalance);
    document.getElementById('prof-balance').innerText = formatNum(userBalance);
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
    if (!container) return;

    if (tracks.length === 0) {
        container.innerHTML = `<div class="loading-spinner">В этом разделе пока ничего нет</div>`;
        return;
    }

    container.innerHTML = tracks.map(t => `
        <div class="track-card">
            <div class="track-top">
                <img class="track-cover" src="${t.cover || 'https://via.placeholder.com/150/1c0508/ff2a55?text=Y'}" alt="${t.title}" />
                <div class="track-details">
                    <div class="track-title">${t.title} ${t.is_upcoming ? '🔥' : ''}</div>
                    <div class="author-tag">
                        <span>Автор: <strong>YaRkUsIk</strong></span>
                        <span class="blue-badge">✓</span>
                    </div>
                    ${t.release_date ? `<div class="track-date">Дата: ${t.release_date}</div>` : ''}
                </div>
            </div>

            <div class="track-actions">
                ${t.is_upcoming 
                    ? `<button class="presave-btn" onclick="handlePresave(${t.id}, this)">🔥 Pre-Save</button>`
                    : (t.audio ? `<button class="presave-btn" onclick="playAudio('${t.audio}', '${t.title}', '${t.cover}')">▶️ Слушать</button>` : '')
                }
                <button class="like-btn" onclick="toggleLike('track', ${t.id}, 'like-track-${t.id}')">
                    ❤️ <span id="like-track-${t.id}">${formatNum(t.likes || 0)}</span>
                </button>
                ${t.link ? `<a class="listen-link" href="${t.link}" target="_blank">🔗</a>` : ''}
                ${isAdmin() ? `<button class="delete-btn" onclick="deleteTrack(${t.id})">🗑</button>` : ''}
            </div>
        </div>
    `).join('');
}

async function loadNews() {
    const container = document.getElementById('news-list');
    const { data: news, error } = await db.from('news').select('*').order('id', { ascending: false });
    if (error || !news) return;

    allNews = news;

    if (news.length > 0) {
        const latest = news[0];
        document.getElementById('latest-news-banner').style.display = 'block';
        document.getElementById('latest-news-content').innerHTML = `
            <p style="font-size:13px; margin-bottom:6px;">${latest.text}</p>
            <div style="font-size:10px; color:rgba(255,255,255,0.4);">${latest.date || ''}</div>
        `;
    }

    if (news.length === 0) {
        container.innerHTML = `<div class="loading-spinner">Новостей пока нет</div>`;
        return;
    }

    container.innerHTML = news.map(n => `
        <div class="news-card">
            ${n.image ? `<img class="news-img" src="${n.image}" style="width:100%; border-radius:14px;" />` : ''}
            <div class="news-text" style="font-size:13px; line-height:1.4;">${n.text}</div>
            <div class="news-footer" style="display:flex; justify-content:space-between; margin-top:8px; font-size:11px;">
                <div class="author-tag">
                    <span>Автор: <strong>YaRkUsIk</strong></span>
                    <span class="blue-badge">✓</span>
                </div>
                <span>${n.date || ''}</span>
            </div>
            ${isAdmin() ? `<div style="margin-top:8px;"><button class="delete-btn" onclick="deleteNews(${n.id})">🗑 Удалить</button></div>` : ''}
        </div>
    `).join('');
}

async function toggleLike(type, id, elementId) {
    const { data: existing } = await db.from('likes').select('id').eq('telegram_id', USER_ID).eq('target_type', type).eq('target_id', id).single();

    if (existing) {
        await db.from('likes').delete().eq('id', existing.id);
    } else {
        await db.from('likes').insert([{ telegram_id: USER_ID, target_type: type, target_id: id }]);
    }

    const { count } = await db.from('likes').select('*', { count: 'exact' }).eq('target_type', type).eq('target_id', id);
    const targetElem = document.getElementById(elementId);
    if (targetElem) targetElem.innerText = formatNum(count || 0);
}

async function handlePresave(trackId, btn) {
    const { data: done } = await db.from('presaves_v2').select('id').eq('telegram_id', USER_ID).eq('track_id', trackId).single();

    if (done) {
        tg?.showAlert('Вы уже оформили пресейв!');
        return;
    }

    await db.from('presaves_v2').insert([{ telegram_id: USER_ID, track_id: trackId }]);
    btn.innerText = '✅ Pre-Saved';
    btn.disabled = true;
    tg?.showAlert('Успешно! Трек сохранен.');
}

async function loadTasks() {
    const container = document.getElementById('tasks-list');
    if (!container) return;
    container.innerHTML = '';

    for (let task of TASKS) {
        const { data: completed } = await db.from('completed_tasks').select('id').eq('telegram_id', USER_ID).eq('task_id', task.id).single();

        const el = document.createElement('div');
        el.className = 'glass-card task-card';
        el.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>${task.title}</strong><br>
                    <small style="color: #ffb800; font-weight:bold;">+${task.reward} UX Gold</small>
                </div>
                <button class="presave-btn" ${completed ? 'disabled style="opacity:0.5"' : ''} onclick="executeTask('${task.id}', ${task.reward}, '${task.link}', this)">
                    ${completed ? '✅ Выполнено' : 'Выполнить'}
                </button>
            </div>
        `;
        container.appendChild(el);
    }
}

async function executeTask(taskId, reward, link, btn) {
    tg?.openTelegramLink(link);

    setTimeout(async () => {
        await db.from('completed_tasks').insert([{ telegram_id: USER_ID, task_id: taskId }]);
        userBalance += reward;
        await db.from('profiles').update({ ux_gold_balance: userBalance }).eq('telegram_id', USER_ID);
        
        updateBalanceUI();
        btn.innerText = '✅ Выполнено';
        btn.disabled = true;
        tg?.showAlert(`🎉 Начислено +${reward} UX Gold!`);
    }, 2500);
}

function convertFromGold() {
    const gold = parseFloat(document.getElementById('calc-gold').value) || 0;
    document.getElementById('calc-rub').value = (gold / 100).toFixed(2);
}

function convertFromRub() {
    const rub = parseFloat(document.getElementById('calc-rub').value) || 0;
    document.getElementById('calc-gold').value = Math.round(rub * 100);
}

const audio = document.getElementById('audio-element');

function playAudio(url, title, cover) {
    if (!url || !audio) return;
    audio.src = url;
    audio.play();

    document.getElementById('player-title').innerText = title;
    document.getElementById('player-cover').src = cover || 'https://via.placeholder.com/50/1c0508/ff2a55?text=Y';
    document.getElementById('player-bar').classList.remove('hidden');
    document.getElementById('player-play-btn').innerText = '⏸';
}

function togglePlayPause() {
    if (!audio) return;
    if (audio.paused) {
        audio.play();
        document.getElementById('player-play-btn').innerText = '⏸';
    } else {
        audio.pause();
        document.getElementById('player-play-btn').innerText = '▶️';
    }
}

if (audio) {
    audio.ontimeupdate = () => {
        if (audio.duration) {
            const pct = (audio.currentTime / audio.duration) * 100;
            const progress = document.getElementById('player-progress');
            if (progress) progress.style.width = pct + '%';
        }
    };
}

function seekAudio(e) {
    if (!audio || !audio.duration) return;
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    audio.currentTime = (clickX / rect.width) * audio.duration;
}

function convertFileToBase64(fileInput, hiddenInputId) {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = function () {
        document.getElementById(hiddenInputId).value = reader.result;
    };
    reader.readAsDataURL(file);
}

function populateBoostSelect() {
    const select = document.getElementById('boost-track-select');
    if (select) {
        select.innerHTML = allTracks.map(t => `<option value="${t.id}">${t.title} (${t.likes || 0} ❤️)</option>`).join('');
    }
}

async function applyLikesBoost() {
    const trackId = document.getElementById('boost-track-select').value;
    const newLikes = parseInt(document.getElementById('boost-likes-count').value);

    if (!trackId || isNaN(newLikes)) return alert('Укажите число');

    await db.from('tracks').update({ likes: newLikes }).eq('id', trackId);
    alert('Лайки обновлены!');
    closeAdminModal();
    loadTracks();
}

function handleSearch() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const filtered = allTracks.filter(t => t.title.toLowerCase().includes(query));
    renderTracks(filtered.filter(t => !t.is_upcoming), 'tracks-list');
    renderTracks(filtered.filter(t => t.is_upcoming), 'upcoming-list');
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
    if (!isAdmin()) return;

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
