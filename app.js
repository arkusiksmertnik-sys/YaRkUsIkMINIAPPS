// ==========================================
// 1. КОНФИГУРАЦИЯ СУПАБЕЙЗ И КЛЮЧИ
// ==========================================
const SUPABASE_URL = 'https://ktdzlkfoqunuwanpmxnt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0ZHpsa2ZvcXVudXdhbnBteG50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDgzNTIsImV4cCI6MjEwNjE4NDM1Mn0.KPVqb5R9h1u4OCIkY27T4GBsoNeps4yen3o4gpBBmhw';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Твой единственный администраторский Telegram ID (YaRkUsIk)
const ADMIN_TELEGRAM_ID = 7261979362;

// ==========================================
// 2. ИНИЦИАЛИЗАЦИЯ TELEGRAM WEBAPP
// ==========================================
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

function isArtistAdmin() {
  return Number(USER_ID) === Number(ADMIN_TELEGRAM_ID);
}

// Список заданий для раздела "Заработать UX Gold"
const TASKS = [
  { id: 'sub_channel', title: 'Подписка на официальный канал YaRkUsIk', reward: 500, link: 'https://t.me/yarkusik' },
  { id: 'sub_chat', title: 'Вступить в официальный чат', reward: 300, link: 'https://t.me/yarkusik' }
];

let userBalance = 0;
let allTracks = [];
let allNews = [];

// ==========================================
// 3. СТАРТ ПРИЛОЖЕНИЯ И ИНИЦИАЛИЗАЦИЯ
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  initUserProfile();
  loadTracks();
  loadNews();
  loadTasks();
});

// Форматирование больших чисел (например, 1200 -> 1.2k, 1000000 -> 1M)
function formatNum(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return (num || 0).toString();
}

// Переключение экранов (кнопки "Назад" и Меню)
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
}

// Синхронизация профиля с базой данных
async function initUserProfile() {
  const headerUser = document.getElementById('header-username');
  const profName = document.getElementById('prof-name');
  const profId = document.getElementById('prof-id');

  if (headerUser) headerUser.innerText = USER_NAME;
  if (profName) profName.innerText = USER_NAME;
  if (profId) profId.innerText = `ID: ${USER_ID}`;

  if (USER.photo_url) {
    const headerAvatar = document.getElementById('header-avatar');
    if (headerAvatar) headerAvatar.innerHTML = `<img src="${USER.photo_url}" style="width:24px;height:24px;border-radius:50%;">`;
  }

  // Получаем или создаем профиль пользователя в таблице profiles
  let { data: profile } = await supabase.from('profiles').select('*').eq('telegram_id', USER_ID).single();

  if (!profile) {
    const { data: newProf } = await supabase.from('profiles').insert([{
      telegram_id: USER_ID,
      first_name: USER_NAME,
      username: USER.username || '',
      ux_gold_balance: 100 // Бонус за регистрацию
    }]).select().single();
    profile = newProf;
  }

  userBalance = profile?.ux_gold_balance || 0;
  updateBalanceUI();
}

function updateBalanceUI() {
  const hb = document.getElementById('header-balance');
  const pb = document.getElementById('prof-balance');
  if (hb) hb.innerText = formatNum(userBalance);
  if (pb) pb.innerText = formatNum(userBalance);
}

// ==========================================
// 4. ТРЕКИИ РЕЛИЗЫ
// ==========================================
async function loadTracks() {
  const container = document.getElementById('tracks-list');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:20px;color:#888;">Загрузка треков...</div>';

  const { data: tracks, error } = await supabase.from('tracks').select('*').order('id', { ascending: false });
  if (error || !tracks) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:#888;">Не удалось загрузить треки.</div>';
    return;
  }

  allTracks = tracks;
  container.innerHTML = '';

  for (let track of tracks) {
    // Получаем реальный подсчет лайков из таблицы likes
    const { count } = await supabase.from('likes').select('*', { count: 'exact' }).eq('target_type', 'track').eq('target_id', track.id);
    const likesCount = count || track.likes || 0;

    const el = document.createElement('div');
    el.className = 'glass-card track-card';
    
    const isUpcoming = track.is_upcoming;

    el.innerHTML = `
      <div class="track-main">
        <img src="${track.cover || 'https://via.placeholder.com/60/1c0508/ff2a55?text=Y'}" class="track-cover" alt="cover">
        <div>
          <strong>${track.title}</strong>
          <div style="font-size:12px; color:rgba(255,255,255,0.7); display:flex; align-items:center; gap:4px; margin-top:2px;">
            <span>Автор: <strong>YaRkUsIk</strong></span>
            <span style="background:#007aff; color:#fff; border-radius:50%; width:14px; height:14px; display:inline-flex; align-items:center; justify-content:center; font-size:8px; font-weight:bold;">✓</span>
          </div>
          <small style="color: var(--text-muted); font-size:11px;">${isUpcoming ? '📅 Анонс: ' + (track.release_date || '') : '🔥 Релиз'}</small>
        </div>
      </div>
      <div class="track-actions">
        ${isUpcoming 
          ? `<button class="btn-neon" onclick="handlePresave(${track.id}, this)">🔔 Пресейв</button>`
          : (track.audio ? `<button class="btn-neon" onclick="playAudio('${track.audio}', '${track.title}', '${track.cover}')">▶️ Слушать</button>` : '')
        }
        <button class="btn-outline" onclick="toggleLike('track', ${track.id}, 'track-like-${track.id}')">
          ❤️ <span id="track-like-${track.id}">${formatNum(likesCount)}</span>
        </button>
        ${track.link ? `<a href="${track.link}" target="_blank" class="btn-outline" style="text-decoration:none; text-align:center;">🔗</a>` : ''}
      </div>
    `;
    container.appendChild(el);
  }
}

// ==========================================
// 5. НОВОСТИ И ЛЕНТА
// ==========================================
async function loadNews() {
  const container = document.getElementById('news-list');
  if (!container) return;

  const { data: news } = await supabase.from('news').select('*').order('id', { ascending: false });
  if (!news) return;

  allNews = news;
  container.innerHTML = '';

  for (let item of news) {
    const { count } = await supabase.from('likes').select('*', { count: 'exact' }).eq('target_type', 'news').eq('target_id', item.id);

    const el = document.createElement('div');
    el.className = 'glass-card news-card';
    el.innerHTML = `
      ${item.image ? `<img src="${item.image}" style="width:100%; border-radius:12px; margin-bottom:8px;" alt="news">` : ''}
      <p style="font-size:14px; line-height:1.4;">${item.text}</p>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
        <div style="font-size:12px; display:flex; align-items:center; gap:4px;">
          <span>Автор: <strong>YaRkUsIk</strong></span>
          <span style="background:#007aff; color:#fff; border-radius:50%; width:14px; height:14px; display:inline-flex; align-items:center; justify-content:center; font-size:8px; font-weight:bold;">✓</span>
        </div>
        <button class="btn-outline" onclick="toggleLike('news', ${item.id}, 'news-like-${item.id}')">
          ❤️ <span id="news-like-${item.id}">${formatNum(count || 0)}</span>
        </button>
      </div>
    `;
    container.appendChild(el);
  }
}

// ==========================================
// 6. ЛАЙКИ И ПРЕСЕЙВЫ (ЗАЩИТА ОТ НАКРУТКИ)
// ==========================================
async function toggleLike(type, id, elementId) {
  const { data: existing } = await supabase.from('likes').select('id').eq('telegram_id', USER_ID).eq('target_type', type).eq('target_id', id).single();

  if (existing) {
    // Пользователь уже лайкал -> убираем лайк
    await supabase.from('likes').delete().eq('id', existing.id);
  } else {
    // Добавляем новый уник лайк
    await supabase.from('likes').insert([{ telegram_id: USER_ID, target_type: type, target_id: id }]);
  }

  const { count } = await supabase.from('likes').select('*', { count: 'exact' }).eq('target_type', type).eq('target_id', id);
  const targetElem = document.getElementById(elementId);
  if (targetElem) targetElem.innerText = formatNum(count || 0);
}

async function handlePresave(trackId, btn) {
  const { data: done } = await supabase.from('presaves_v2').select('id').eq('telegram_id', USER_ID).eq('track_id', trackId).single();

  if (done) {
    tg?.showAlert('Вы уже оформили пресейв на этот релиз!');
    return;
  }

  await supabase.from('presaves_v2').insert([{ telegram_id: USER_ID, track_id: trackId }]);
  btn.innerText = '✅ Сохранено';
  btn.disabled = true;
  btn.style.opacity = '0.6';
  tg?.showAlert('Успешно! Трек сохранен в твои пресейвы!');
}

// ==========================================
// 7. ЗАДАНИЯ И ЭКОНОМИКА UX GOLD
// ==========================================
async function loadTasks() {
  const container = document.getElementById('tasks-list');
  if (!container) return;
  container.innerHTML = '';

  for (let task of TASKS) {
    const { data: completed } = await supabase.from('completed_tasks').select('id').eq('telegram_id', USER_ID).eq('task_id', task.id).single();

    const el = document.createElement('div');
    el.className = 'glass-card task-card';
    el.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong>${task.title}</strong><br>
          <small style="color: #ffb800; font-weight:bold;">+${task.reward} UX Gold</small>
        </div>
        <button class="btn-neon" ${completed ? 'disabled style="opacity:0.5"' : ''} onclick="executeTask('${task.id}', ${task.reward}, '${task.link}', this)">
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
    await supabase.from('completed_tasks').insert([{ telegram_id: USER_ID, task_id: taskId }]);
    
    userBalance += reward;
    await supabase.from('profiles').update({ ux_gold_balance: userBalance }).eq('telegram_id', USER_ID);
    
    updateBalanceUI();
    btn.innerText = '✅ Выполнено';
    btn.disabled = true;
    btn.style.opacity = '0.5';
    tg?.showAlert(`🎉 Начислено +${reward} UX Gold!`);
  }, 2500);
}

// Калькулятор конвертера валют
function convertFromGold() {
  const goldInput = document.getElementById('calc-gold');
  const rubInput = document.getElementById('calc-rub');
  if (!goldInput || !rubInput) return;
  const gold = parseFloat(goldInput.value) || 0;
  rubInput.value = (gold / 100).toFixed(2);
}

function convertFromRub() {
  const goldInput = document.getElementById('calc-gold');
  const rubInput = document.getElementById('calc-rub');
  if (!goldInput || !rubInput) return;
  const rub = parseFloat(rubInput.value) || 0;
  goldInput.value = Math.round(rub * 100);
}

// ==========================================
// 8. КАСТОМНЫЙ АУДИОПЛЕЕР
// ==========================================
const audio = document.getElementById('audio-element');

function playAudio(url, title, cover) {
  if (!url || !audio) return;
  
  audio.src = url;
  audio.play();

  const pTitle = document.getElementById('player-title');
  const pCover = document.getElementById('player-cover');
  const pBar = document.getElementById('player-bar');
  const pBtn = document.getElementById('player-play-btn');

  if (pTitle) pTitle.innerText = title;
  if (pCover) pCover.src = cover || 'https://via.placeholder.com/50/1c0508/ff2a55?text=Y';
  if (pBar) pBar.classList.remove('hidden');
  if (pBtn) pBtn.innerText = '⏸';
}

function togglePlayPause() {
  if (!audio) return;
  const pBtn = document.getElementById('player-play-btn');
  if (audio.paused) {
    audio.play();
    if (pBtn) pBtn.innerText = '⏸';
  } else {
    audio.pause();
    if (pBtn) pBtn.innerText = '▶️';
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

// Конвертация локальных файлов (картинки/MP3) в Base64 для Админки
function convertFileToBase64(fileInput, hiddenInputId) {
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onloadend = function () {
    const hiddenElem = document.getElementById(hiddenInputId);
    if (hiddenElem) hiddenElem.value = reader.result;
  };
  reader.readAsDataURL(file);
}
