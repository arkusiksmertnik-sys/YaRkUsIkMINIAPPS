// ==========================================
// 1. КОНФИГУРАЦИЯ СУПАБЕЙЗ И КЛЮЧИ
// ==========================================
const SUPABASE_URL = 'https://ktdzlkfoqunuwanpmxnt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0ZHpsa2ZvcXVudXdhbnBteG50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDgzNTIsImV4cCI6MjEwNjE4NDM1Mn0.KPVqb5R9h1u4OCIkY27T4GBsoNeps4yen3o4gpBBmhw';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Единственный администраторский Telegram ID (YaRkUsIk)
const ADMIN_TELEGRAM_ID = 7261979362;

// ==========================================
// 2. ИНИЦИАЛИЗАЦИЯ TELEGRAM WEBAPP
// ==========================================
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  // Настраиваем системную кнопку Назад в Telegram
  if (tg.BackButton) {
    tg.BackButton.onClick(() => goBack());
  }
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

// Задания для раздела "Заработать"
const TASKS = [
  { id: 'sub_channel', title: 'Подписка на официальный канал YaRkUsIk', reward: 500, link: 'https://t.me/yarkusik' },
  { id: 'sub_chat', title: 'Вступить в официальный чат', reward: 300, link: 'https://t.me/yarkusik' }
];

let userBalance = 0;
let dbUserId = null; // UUID пользователя в базе
let allTracks = [];
let allNews = [];
let currentTab = 'tracks';
let historyStack = [];

// ==========================================
// 3. СТАРТ ПРИЛОЖЕНИЯ И НАВИГАЦИЯ
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  await initUserProfile();
  loadTracks();
  loadNews();
  loadTasks();
  loadGifts();
  loadGiveaways();
  loadUsersList();
});

function formatNum(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return (num || 0).toString();
}

// Умное переключение вкладок с историей для кнопки "Назад"
function switchTab(tabName, pushHistory = true) {
  if (pushHistory && currentTab !== tabName) {
    historyStack.push(currentTab);
  }
  currentTab = tabName;

  document.querySelectorAll('.dock-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));

  // Маппинг док-панели
  const dockMap = { 'tracks': 0, 'news': 1, 'earn': 2, 'clicker': 3, 'gifts': 4, 'giveaways': 5, 'chats': 6, 'participants': 7, 'info': 8, 'shop': 3 };
  const btnIndex = dockMap[tabName];
  const dockButtons = document.querySelectorAll('.dock-btn');
  if (btnIndex !== undefined && dockButtons[btnIndex]) {
    dockButtons[btnIndex].classList.add('active');
  }

  const target = document.getElementById(`tab-${tabName}`);
  if (target) target.classList.add('active');

  // Управление кнопкой назад (на главном экране 'tracks' она не нужна)
  const backBtn = document.getElementById('back-btn');
  if (backBtn) {
    if (tabName === 'tracks' || historyStack.length === 0) {
      backBtn.style.display = 'none';
      if (tg?.BackButton) tg.BackButton.hide();
    } else {
      backBtn.style.display = 'block';
      if (tg?.BackButton) tg.BackButton.show();
    }
  }
}

function goBack() {
  if (historyStack.length > 0) {
    const prevTab = historyStack.pop();
    switchTab(prevTab, false);
  } else {
    switchTab('tracks', false);
  }
}

// ==========================================
// 4. ПРОФИЛЬ И АВТОРИЗАЦИЯ В БАЗЕ
// ==========================================
async function initUserProfile() {
  const userNameEl = document.getElementById('user-name');
  const profNameEl = document.getElementById('profile-hero-name');
  if (userNameEl) userNameEl.innerText = USER_NAME;
  if (profNameEl) profNameEl.innerText = USER_NAME;

  if (USER.photo_url) {
    const avatar = document.getElementById('user-avatar');
    const heroAvatar = document.getElementById('profile-hero-avatar');
    if (avatar) avatar.src = USER.photo_url;
    if (heroAvatar) heroAvatar.src = USER.photo_url;
  }

  if (isAdmin()) {
    const badges = document.querySelectorAll('#verified-badge, #hero-badge');
    badges.forEach(b => b.style.display = 'inline-flex');
    const roleEl = document.getElementById('role-badge');
    if (roleEl) roleEl.innerText = 'Official Artist';
    const adminBtn = document.getElementById('admin-badge');
    if (adminBtn) adminBtn.style.display = 'block';
  }

  // Получаем или создаем профиль в Supabase
  let { data: profile } = await db.from('profiles').select('*').eq('telegram_id', USER_ID).single();

  if (!profile) {
    const { data: newProf } = await db.from('profiles').insert([{
      telegram_id: USER_ID,
      first_name: USER_NAME,
      username: USER.username || '',
      ux_gold_balance: 100 // Бонус за старт
    }]).select().single();
    profile = newProf;
  }

  dbUserId = profile?.id;
  userBalance = profile?.ux_gold_balance || 0;
  updateBalanceUI();
}

function updateBalanceUI() {
  const hb = document.getElementById('header-balance');
  const pb = document.getElementById('prof-balance');
  if (hb) hb.innerText = Number(userBalance).toFixed(4);
  if (pb) pb.innerText = Number(userBalance).toFixed(4);
}

// ==========================================
// 5. ТРЕКИ И НОВОСТИ
// ==========================================
async function loadTracks() {
  const { data: tracks, error } = await db.from('tracks').select('*').order('id', { ascending: false });
  if (error || !tracks) return;

  allTracks = tracks;
  const tracksCountEl = document.getElementById('total-tracks-count');
  if (tracksCountEl) tracksCountEl.innerText = tracks.length;

  renderTracks(allTracks.filter(t => !t.is_upcoming), 'tracks-list');
  renderTracks(allTracks.filter(t => t.is_upcoming), 'upcoming-list');
}

function renderTracks(tracks, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (tracks.length === 0) {
    container.innerHTML = `<div class="loading-spinner">Здесь пока пусто</div>`;
    return;
  }

  container.innerHTML = tracks.map(t => `
    <div class="glass-card track-card">
      <div style="display:flex; gap:12px; align-items:center;">
        <img src="${t.cover || 'https://via.placeholder.com/60/1c0508/ff2a55?text=Y'}" style="width:60px; height:60px; border-radius:12px; object-fit:cover;" alt="cover">
        <div style="flex:1;">
          <strong>${t.title}</strong>
          <div style="font-size:12px; color:rgba(255,255,255,0.7); display:flex; align-items:center; gap:4px; margin-top:2px;">
            <span>YaRkUsIk</span>
            <span style="background:#007aff; color:#fff; border-radius:50%; width:12px; height:12px; display:inline-flex; align-items:center; justify-content:center; font-size:7px;">✓</span>
          </div>
        </div>
      </div>
      <div style="display:flex; gap:8px; margin-top:10px; align-items:center;">
        ${t.is_upcoming 
          ? `<button class="presave-btn" onclick="handlePresave(${t.id}, this)">🔔 Пресейв</button>`
          : (t.audio ? `<button class="presave-btn" onclick="playAudio('${t.audio}', '${t.title}', '${t.cover}')">▶️ Слушать</button>` : '')
        }
        <button class="like-btn" onclick="toggleLike('track', ${t.id}, 'like-track-${t.id}')">
          ❤️ <span id="like-track-${t.id}">${formatNum(t.likes || 0)}</span>
        </button>
        ${t.link ? `<a href="${t.link}" target="_blank" class="listen-link" style="text-decoration:none;">🔗</a>` : ''}
        ${isAdmin() ? `<button class="delete-btn" onclick="deleteTrack(${t.id})">🗑</button>` : ''}
      </div>
    </div>
  `).join('');
}

async function loadNews() {
  const container = document.getElementById('news-list');
  if (!container) return;

  const { data: news } = await db.from('news').select('*').order('id', { ascending: false });
  if (!news) return;

  allNews = news;
  container.innerHTML = news.length === 0 ? '<div class="loading-spinner">Нет новостей</div>' : news.map(n => `
    <div class="glass-card news-card">
      ${n.image ? `<img src="${n.image}" style="width:100%; border-radius:12px; margin-bottom:8px;" alt="news">` : ''}
      <p style="font-size:13px; line-height:1.4;">${n.text}</p>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; font-size:11px; color:rgba(255,255,255,0.5);">
        <span>YaRkUsIk ✓</span>
        <button class="like-btn" onclick="toggleLike('news', ${n.id}, 'like-news-${n.id}')">
          ❤️ <span id="like-news-${n.id}">${formatNum(n.likes || 0)}</span>
        </button>
      </div>
      ${isAdmin() ? `<button class="delete-btn" onclick="deleteNews(${n.id})" style="margin-top:6px;">🗑 Удалить</button>` : ''}
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
  const el = document.getElementById(elementId);
  if (el) el.innerText = formatNum(count || 0);
}

async function handlePresave(trackId, btn) {
  const { data: done } = await db.from('presaves_v2').select('id').eq('telegram_id', USER_ID).eq('track_id', trackId).single();
  if (done) {
    tg?.showAlert('Уже сохранен!');
    return;
  }
  await db.from('presaves_v2').insert([{ telegram_id: USER_ID, track_id: trackId }]);
  btn.innerText = '✅ Сохранено';
  btn.disabled = true;
  tg?.showAlert('Пресейв успешно оформлен!');
}

// ==========================================
// 6. ВАЛЮТА И КЛИКЕР (ЯрКуАиК / +0.0005)
// ==========================================
let lastTapTime = 0;

async function handleTapClick(e) {
  const now = Date.now();
  if (now - lastTapTime < 800) return; // Защита от спама и автокликеров
  lastTapTime = now;

  // Визуальный отклик и анимация floating text (+0.0005)
  showTapAnimation(e);

  // Начисляем на сервере
  try {
    const { data, error } = await db.rpc('tap_click', { p_telegram_id: USER_ID });
    if (!error && data !== null) {
      userBalance = data;
      updateBalanceUI();
    } else {
      // Фолбек если RPC еще не создана в базе: считаем на клиенте и пишем в профиль
      userBalance = Number((userBalance + 0.0005).toFixed(4));
      await db.from('profiles').update({ ux_gold_balance: userBalance }).eq('telegram_id', USER_ID);
      updateBalanceUI();
    }
  } catch (err) {
    userBalance = Number((userBalance + 0.0005).toFixed(4));
    updateBalanceUI();
  }
}

function showTapAnimation(e) {
  const target = document.getElementById('clicker-emblem');
  if (!target) return;
  
  target.style.transform = 'scale(0.92)';
  setTimeout(() => target.style.transform = 'scale(1)', 100);

  const floatText = document.createElement('div');
  floatText.className = 'floating-plus';
  floatText.innerText = '+0.0005 ЯрКуАиК';
  
  const rect = target.getBoundingClientRect();
  floatText.style.left = `${e.clientX || (rect.left + rect.width / 2)}px`;
  floatText.style.top = `${e.clientY || rect.top}px`;
  document.body.appendChild(floatText);

  setTimeout(() => floatText.remove(), 1000);
}

// ==========================================
// 7. ПОДАРКИ И КОЛЛЕКЦИЯ
// ==========================================
async function loadGifts() {
  const container = document.getElementById('gifts-catalog');
  if (!container) return;

  const { data: gifts } = await db.from('gifts').select('*').eq('is_active', true);
  if (!gifts || gifts.length === 0) {
    container.innerHTML = `<div class="loading-spinner">Каталог подарков пуст</div>`;
    return;
  }

  container.innerHTML = gifts.map(g => `
    <div class="glass-card gift-card">
      <div style="font-size:36px; text-align:center; margin-bottom:8px;">${g.image_url || '🎁'}</div>
      <strong>${g.name}</strong>
      <p style="font-size:11px; color:rgba(255,255,255,0.6); margin:4px 0;">${g.description || ''}</p>
      <div style="font-size:12px; color:#ffb800; font-weight:bold; margin-bottom:8px;">💎 ${g.price} ЯрКуАиК</div>
      <button class="presave-btn" onclick="buyGift('${g.id}', ${g.price})">Купить</button>
    </div>
  `).join('');
}

async function buyGift(giftId, price) {
  if (userBalance < price) {
    tg?.showAlert('Недостаточно ЯрКуАиК на балансе!');
    return;
  }
  userBalance -= price;
  await db.from('profiles').update({ ux_gold_balance: userBalance }).eq('telegram_id', USER_ID);
  await db.from('user_gifts').insert([{ user_id: dbUserId, gift_id: giftId, acquisition_method: 'purchase' }]);
  updateBalanceUI();
  tg?.showAlert('🎉 Подарок успешно куплен и добавлен в твою коллекцию!');
}

// ==========================================
// 8. РОЗЫГРЫШИ
// ==========================================
async function loadGiveaways() {
  const container = document.getElementById('giveaways-list');
  if (!container) return;

  const { data: giveaways } = await db.from('giveaways').select('*').eq('is_active', true);
  if (!giveaways || giveaways.length === 0) {
    container.innerHTML = `<div class="loading-spinner">Активных розыгрышей нет</div>`;
    return;
  }

  container.innerHTML = giveaways.map(g => `
    <div class="glass-card">
      <h3>🎉 ${g.title}</h3>
      <p style="font-size:12px; color:rgba(255,255,255,0.7); margin:6px 0;">${g.description}</p>
      <div style="font-size:11px; color:#ffb800; margin-bottom:8px;">Приз: <strong>${g.prize_value}</strong></div>
      <button class="presave-btn" onclick="participateGiveaway('${g.id}')">Участвовать</button>
    </div>
  `).join('');
}

async function participateGiveaway(giveawayId) {
  const { data: existing } = await db.from('giveaway_participants').select('id').eq('giveaway_id', giveawayId).eq('user_id', dbUserId).single();
  if (existing) {
    tg?.showAlert('Вы уже участвуете в этом розыгрыше!');
    return;
  }
  await db.from('giveaway_participants').insert([{ giveaway_id: giveawayId, user_id: dbUserId }]);
  tg?.showAlert('✅ Успешно! Вы зарегистрированы в розыгрыше.');
}

// ==========================================
// 9. УЧАСТНИКИ И ЧАТЫ
// ==========================================
async function loadUsersList() {
  const container = document.getElementById('users-list');
  if (!container) return;

  const { data: users } = await db.from('profiles').select('*').order('created_at', { ascending: false }).limit(20);
  if (!users) return;

  container.innerHTML = users.map(u => `
    <div class="glass-card" style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px;">
      <div>
        <strong>${u.first_name}</strong>
        <div style="font-size:10px; color:rgba(255,255,255,0.5);">@${u.username || 'user'}</div>
      </div>
      <span style="font-size:11px; color:#ffb800;">🟡 ${formatNum(u.ux_gold_balance || 0)}</span>
    </div>
  `).join('');
}

// Задания и заработок
async function loadTasks() {
  const container = document.getElementById('tasks-list');
  if (!container) return;
  container.innerHTML = TASKS.map(t => `
    <div class="glass-card" style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <strong>${t.title}</strong><br>
        <small style="color:#ffb800;">+${t.reward} ЯрКуАиК</small>
      </div>
      <button class="presave-btn" onclick="executeTask('${t.id}', ${t.reward}, '${t.link}', this)">Выполнить</button>
    </div>
  `).join('');
}

async function executeTask(taskId, reward, link, btn) {
  tg?.openTelegramLink(link);
  setTimeout(async () => {
    userBalance += reward;
    await db.from('profiles').update({ ux_gold_balance: userBalance }).eq('telegram_id', USER_ID);
    updateBalanceUI();
    btn.innerText = '✅ Готово';
    btn.disabled = true;
    tg?.showAlert(`🎉 Получено +${reward} ЯрКуАиК!`);
  }, 2500);
}

// ==========================================
// 10. АУДИОПЛЕЕР И АДМИНКА
// ==========================================
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

function openAdminModal() { document.getElementById('admin-modal').style.display = 'flex'; }
function closeAdminModal() { document.getElementById('admin-modal').style.display = 'none'; }

function switchAdminTab(type) {
  document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.admin-form').forEach(f => f.classList.remove('active'));
  if (type === 'track') {
    document.querySelectorAll('.admin-tab-btn')[0].classList.add('active');
    document.getElementById('form-track').classList.add('active');
  } else {
    document.querySelectorAll('.admin-tab-btn')[1].classList.add('active');
    document.getElementById('form-news').classList.add('active');
  }
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
  await db.from('tracks').insert([trackData]);
  closeAdminModal();
  loadTracks();
}

async function handleNewsSubmit(e) {
  e.preventDefault();
  if (!isAdmin()) return;
  const newsData = {
    text: document.getElementById('news-text').value,
    image: document.getElementById('news-image-data').value
  };
  await db.from('news').insert([newsData]);
  closeAdminModal();
  loadNews();
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

function handleSearch() {
  const q = document.getElementById('search-input').value.toLowerCase();
  const filtered = allTracks.filter(t => t.title.toLowerCase().includes(q));
  renderTracks(filtered.filter(t => !t.is_upcoming), 'tracks-list');
  renderTracks(filtered.filter(t => t.is_upcoming), 'upcoming-list');
}
