// Инициализация Telegram WebApp SDK
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.ready();
}

// Конфигурация сервера API (Замените на URL вашего Node.js бэкенда)
const API_BASE_URL = 'https://hip-buttons-cheer.loca.lt
';

// Состояние приложения
let state = {
    user: tg?.initDataUnsafe?.user || { id: 0, first_name: 'Гость', username: '' },
    isAdmin: false,
    favorites: JSON.parse(localStorage.getItem('yksi_favorites') || '[]'),
    tracks: [],
    news: []
};

document.addEventListener('DOMContentLoaded', async () => {
    initUser();
    await checkAdminStatus();
    await loadData();
    renderAll();
});

// Инициализация профиля
function initUser() {
    if (state.user.first_name) {
        document.getElementById('user-name').innerText = `${state.user.first_name} ${state.user.last_name || ''}`;
        document.getElementById('user-username').innerText = state.user.username ? `@${state.user.username}` : '';
        if (state.user.photo_url) {
            document.getElementById('user-avatar').src = state.user.photo_url;
        }
    }
}

// Проверка админ-доступа на сервере
async function checkAdminStatus() {
    if (!tg?.initData) return;
    try {
        const res = await fetch(`${API_BASE_URL}/admin/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: tg.initData })
        });
        const data = await res.json();
        if (data.isAdmin) {
            state.isAdmin = true;
            document.getElementById('admin-banner').classList.remove('hidden');
        }
    } catch (e) {
        console.warn('Серверная база недоступна для проверки прав.');
    }
}

// Загрузка данных
async function loadData() {
    try {
        const [tracksRes, newsRes] = await Promise.all([
            fetch(`${API_BASE_URL}/tracks`),
            fetch(`${API_BASE_URL}/news`)
        ]);
        if (tracksRes.ok) state.tracks = await tracksRes.json();
        if (newsRes.ok) state.news = await newsRes.json();
    } catch (e) {
        showServerNotice();
    }
}

function showServerNotice() {
    console.log('Подключите Node.js сервер для полноценной работы БД.');
}

// Навигация
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-accentRed');
        btn.classList.add('text-gray-400');
    });
    document.getElementById(`nav-${tabName}`).classList.add('text-accentRed');
    document.getElementById(`nav-${tabName}`).classList.remove('text-gray-400');
}

// Рендеринг
function renderAll() {
    renderHome();
    renderMusic();
    renderNews();
    renderFavorites();
}

function renderHome() {
    const latestTrack = state.tracks[0];
    const latestReleaseBlock = document.getElementById('latest-release-content');

    if (latestTrack) {
        latestReleaseBlock.innerHTML = `
            <div class="flex gap-3 items-center">
                <img src="${latestTrack.cover}" class="w-16 h-16 rounded-xl object-cover">
                <div class="flex-1 min-w-0">
                    <h3 class="font-bold text-white text-sm truncate">${latestTrack.title}</h3>
                    <p class="text-xs text-gray-400">${latestTrack.release_date}</p>
                    <div class="flex gap-2 mt-2">
                        <a href="${latestTrack.link}" target="_blank" class="px-3 py-1 bg-accentRed text-white text-[11px] rounded-lg font-medium">
                            ${latestTrack.is_upcoming ? 'Предсохранить' : 'Слушать'}
                        </a>
                        <button onclick="toggleFavorite(${latestTrack.id})" class="px-2 py-1 bg-gray-800 text-gray-300 text-[11px] rounded-lg">
                            ${isFav(latestTrack.id) ? '★ В избранном' : '☆ Сохранить'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    const newsFeed = document.getElementById('home-news-feed');
    if (state.news.length > 0) {
        newsFeed.innerHTML = state.news.slice(0, 2).map(item => `
            <div class="glass-card rounded-xl p-3 text-xs space-y-1">
                <p class="text-gray-300 line-clamp-2">${item.text}</p>
                <span class="text-[10px] text-gray-500">${item.date}</span>
            </div>
        `).join('');
    }
}

function renderMusic() {
    const musicList = document.getElementById('music-list');
    if (state.tracks.length === 0) return;

    musicList.innerHTML = state.tracks.map(track => `
        <div class="glass-card rounded-xl p-3 flex flex-col gap-3">
            <div class="flex gap-3 items-center">
                <img src="${track.cover}" class="w-14 h-14 rounded-lg object-cover">
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold text-sm text-white truncate">${track.title}</h4>
                    <p class="text-xs text-gray-400">${track.release_date}</p>
                </div>
                <button onclick="shareTrack('${track.title}', '${track.link}')" class="text-gray-400 hover:text-white">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                </button>
            </div>
            ${track.audio ? `<audio controls src="${track.audio}" class="w-full h-8 mt-1"></audio>` : ''}
            <div class="flex justify-between items-center border-t border-gray-800/60 pt-2 text-xs">
                <a href="${track.link}" target="_blank" class="text-accentRed font-semibold">
                    ${track.is_upcoming ? 'Пресейв' : 'Площадки'} &rarr;
                </a>
                <button onclick="toggleFavorite(${track.id})" class="text-gray-400">
                    ${isFav(track.id) ? '❤️ В избранном' : '🤍 В избранное'}
                </button>
            </div>
        </div>
    `).join('');
}

function renderNews() {
    const newsList = document.getElementById('news-list');
    if (state.news.length === 0) return;

    newsList.innerHTML = state.news.map(item => `
        <div class="glass-card rounded-xl p-4 space-y-3">
            <p class="text-xs text-gray-200 leading-relaxed">${item.text}</p>
            ${item.image ? `<img src="${item.image}" class="rounded-lg w-full max-h-48 object-cover">` : ''}
            <div class="flex justify-between items-center text-[11px] text-gray-500 pt-1">
                <span>${item.date}</span>
                <button onclick="shareNews('${item.id}')" class="text-accentRed">Поделиться в TG</button>
            </div>
        </div>
    `).join('');
}

function renderFavorites() {
    const favList = document.getElementById('favorites-list');
    const favTracks = state.tracks.filter(t => state.favorites.includes(t.id));

    if (favTracks.length === 0) {
        favList.innerHTML = '<p class="text-xs text-gray-500">Список избранного пуст.</p>';
        return;
    }

    favList.innerHTML = favTracks.map(track => `
        <div class="glass-card rounded-xl p-3 flex justify-between items-center">
            <div class="flex gap-3 items-center">
                <img src="${track.cover}" class="w-10 h-10 rounded-lg">
                <div>
                    <h5 class="text-xs font-bold text-white">${track.title}</h5>
                    <a href="${track.link}" target="_blank" class="text-[10px] text-accentRed">Слушать</a>
                </div>
            </div>
            <button onclick="toggleFavorite(${track.id})" class="text-xs text-gray-500">&times;</button>
        </div>
    `).join('');
}

// Работа с Избранным
function isFav(id) { return state.favorites.includes(id); }

function toggleFavorite(id) {
    if (isFav(id)) {
        state.favorites = state.favorites.filter(favId => favId !== id);
    } else {
        state.favorites.push(id);
    }
    localStorage.setItem('yksi_favorites', JSON.stringify(state.favorites));
    renderAll();
}

// Поделиться
function shareTrack(title, link) {
    if (tg?.openTelegramLink) {
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Слушай новый трек ЯрКуСиК / YKSI — ' + title)}`);
    } else {
        window.open(link, '_blank');
    }
}

// Админ-панель модалка
function openAdminModal() { document.getElementById('admin-modal').classList.remove('hidden'); }
function closeAdminModal() { document.getElementById('admin-modal').classList.add('hidden'); }

// Обработчики форм (Отправка на backend)
async function handleCreateTrack(e) {
    e.preventDefault();
    const payload = {
        initData: tg.initData,
        title: document.getElementById('track-title').value,
        cover: document.getElementById('track-cover').value,
        audio: document.getElementById('track-audio').value,
        link: document.getElementById('track-link').value,
        release_date: document.getElementById('track-date').value,
        is_upcoming: document.getElementById('track-is-upcoming').checked
    };
    await sendAdminRequest(`${API_BASE_URL}/admin/tracks`, payload);
}

async function handleCreateNews(e) {
    e.preventDefault();
    const payload = {
        initData: tg.initData,
        text: document.getElementById('news-text').value,
        image: document.getElementById('news-image').value
    };
    await sendAdminRequest(`${API_BASE_URL}/admin/news`, payload);
}

async function sendAdminRequest(url, payload) {
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            alert('Успешно сохранено!');
            closeAdminModal();
            await loadData();
            renderAll();
        } else {
            alert('Ошибка сервера или отказано в доступе.');
        }
    } catch (e) {
        alert('Сервер недоступен. Подключите бэкенд.');
    }
}
