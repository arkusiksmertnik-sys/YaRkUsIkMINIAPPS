/**
 * ЯрКуСиК Mini App - Глобально обновленный функционал (v7)
 * Интерактивное пространство сообщества с защитой и расширенными чатами
 */

const SUPABASE_URL = 'https://ktdzlkfoqunuwanpmxnt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0ZHpsa2ZvcXVudXdhbnBteG50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDgzNTIsImV4cCI6MjEwNjE4NDM1Mn0.KPVqb5R9h1u4OCIkY27T4GBsoNeps4yen3o4gpBBmhw';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const ADMIN_TELEGRAM_ID = 7261979362;

const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#0d0204');
    if (tg.BackButton) {
        tg.BackButton.onClick(() => {
            switchTab('tracks');
        });
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

const TASKS = [
    { id: 'sub_channel', title: 'Подписка на официальный канал ЯрКуСиК', reward: 500, link: 'https://t.me/yarkusik' },
    { id: 'sub_chat', title: 'Вступить в официальный чат сообщества', reward: 300, link: 'https://t.me/yarkusik' }
];

let userBalance = 0;
let allTracks = [];
let allNews = [];
let currentViewingUserId = null;
let activeChatPeerId = null;
let chatPollingInterval = null;

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    await initUserProfile();
    loadTracks();
    loadNews();
    loadTasks();
    loadGiftsCatalog();
    loadMyGifts();
    loadGiveaways();
    loadMembers();
    loadConversations();
    loadTapHistory();
});

// Система уведомлений (Тосты)
function showToast(text, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;
    toast.innerText = text;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

function formatNum(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return Number(num || 0).toLocaleString('ru-RU');
}

// Плавное переключение разделов
function switchTab(tabName) {
    const buttons = document.querySelectorAll('.dock-btn');
    const tabs = document.querySelectorAll('.tab-content');

    buttons.forEach(btn => btn.classList.remove('active'));
    tabs.forEach(tab => tab.classList.remove('active'));

    const tabMap = { 'tracks': 0, 'news': 1, 'tap': 2, 'gifts': 3, 'giveaways': 4, 'community': 5, 'earn': 6, 'info': 7 };
    if (tabMap[tabName] !== undefined && buttons[tabMap[tabName]]) {
        buttons[tabMap[tabName]].classList.add('active');
    }

    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) {
        targetTab.classList.add('active');
        // Анимация появления
        targetTab.style.opacity = 0;
        setTimeout(() => targetTab.style.opacity = 1, 50);
    }

    if (tg && tg.BackButton) {
        if (tabName === 'tracks') tg.BackButton.hide();
        else tg.BackButton.show();
    }

    const searchBox = document.getElementById('global-search-box');
    if (searchBox) {
        searchBox.style.display = (['tracks', 'news', 'community'].includes(tabName)) ? 'flex' : 'none';
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Работа с профилем пользователя
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
        document.getElementById('role-badge').innerText = 'Official Creator';
        document.getElementById('profile-hero-status').innerText = 'Verified Admin';
        document.getElementById('admin-badge').style.display = 'block';
    }

    let { data: profile } = await db.from('profiles').select('*').eq('telegram_id', USER_ID).single();
    if (!profile) {
        const { data: newProf } = await db.from('profiles').insert([{
            telegram_id: USER_ID,
            first_name: USER_NAME,
            username: USER.username || '',
            ux_gold_balance: 100,
            bio: 'ЯрКуСиК Listener 💖',
            photo_url: USER.photo_url || ''
        }]).select().single();
        profile = newProf;
    } else if (USER.photo_url && profile.photo_url !== USER.photo_url) {
        await db.from('profiles').update({ photo_url: USER.photo_url }).eq('telegram_id', USER_ID);
    }

    userBalance = profile?.ux_gold_balance || 0;
    if (profile?.bio) {
        const bioInput = document.getElementById('profile-bio-input');
        if (bioInput) bioInput.value = profile.bio;
    }

    updateBalanceUI();
}

function updateBalanceUI() {
    document.getElementById('header-balance').innerText = formatNum(userBalance);
    document.getElementById('prof-balance').innerText = formatNum(userBalance);
    const tapBal = document.getElementById('tap-balance-num');
    if (tapBal) tapBal.innerText = userBalance.toFixed(4);
}

async function saveUserBio() {
    const bioText = document.getElementById('profile-bio-input').value.trim();
    const { error } = await db.from('profiles').update({ bio: bioText }).eq('telegram_id', USER_ID);
    if (!error) showToast('✅ Статус успешно обновлен!');
    else showToast('❌ Ошибка сохранения', 'error');
}

// Загрузка музыки (v7)
async function loadTracks() {
    const { data: tracks, error } = await db.from('tracks').select('*').order('id', { ascending: false });
    if (error || !tracks) return;

    allTracks = tracks;
    document.getElementById('total-tracks-count').innerText = tracks.length;

    renderTracks(allTracks.filter(t => !t.is_upcoming), 'tracks-list');
    renderTracks(allTracks.filter(t => t.is_upcoming), 'upcoming-list');
}

function toggleUpcomingTracks() {
    const wrap = document.getElementById('upcoming-container-wrap');
    if (wrap) wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
}

function renderTracks(tracks, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (tracks.length === 0) {
        container.innerHTML = `<div class="loading-spinner">Здесь пока тишина...</div>`;
        return;
    }

    container.innerHTML = tracks.map(t => `
        <div class="track-card">
            <div class="track-top">
                <img class="track-cover" src="${t.cover || 'https://via.placeholder.com/150/1c0508/ff2a55?text=Y'}" alt="${t.title}" />
                <div class="track-details">
                    <div class="track-title">${t.title} ${t.is_upcoming ? '🔥' : ''}</div>
                    <div class="author-tag">
                        <span>Автор: <strong>ЯрКуСиК</strong></span>
                        <span class="blue-badge">✓</span>
                    </div>
                    ${t.release_date ? `<div class="track-date">Релиз: ${t.release_date}</div>` : ''}
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
                ${isAdmin() ? `<button class="delete-btn" onclick="deleteTrack(${t.id})" style="background:rgba(255,0,0,0.2); color:#ff6b6b;">🗑</button>` : ''}
            </div>
        </div>
    `).join('');
}

// Новости (v7)
async function loadNews() {
    const container = document.getElementById('news-list');
    const { data: news, error } = await db.from('news').select('*').order('id', { ascending: false });
    if (error || !news) return;

    allNews = news;

    if (news.length > 0) {
        const latest = news[0];
        document.getElementById('latest-news-banner').style.display = 'block';
        document.getElementById('latest-news-content').innerHTML = `
            <p style="font-size:13px; margin-bottom:6px; font-weight:500;">${latest.text}</p>
            <div style="font-size:10px; color:rgba(255,255,255,0.4);">${latest.date || ''}</div>
        `;
    }

    if (news.length === 0) {
        container.innerHTML = `<div class="loading-spinner">Новостей нет</div>`;
        return;
    }

    container.innerHTML = news.map(n => `
        <div class="news-card">
            ${n.image ? `<img class="news-img" src="${n.image}" style="width:100%; border-radius:14px; margin-bottom:10px;" />` : ''}
            <div class="news-text">${n.text}</div>
            <div class="news-footer" style="display:flex; justify-content:space-between; margin-top:10px; font-size:11px;">
                <div class="author-tag"><span><strong>ЯрКуСиК</strong></span> <span class="blue-badge">✓</span></div>
                <span style="opacity:0.5;">${n.date || ''}</span>
            </div>
            ${isAdmin() ? `<div style="margin-top:10px;"><button class="delete-btn" onclick="deleteNews(${n.id})" style="background:rgba(255,0,0,0.2); color:#ff6b6b;">🗑 Удалить</button></div>` : ''}
        </div>
    `).join('');
}

// Лайки (защита и атомарность)
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
        showToast('Вы уже подписаны на релиз!', 'error');
        return;
    }
    await db.from('presaves_v2').insert([{ telegram_id: USER_ID, track_id: trackId }]);
    btn.innerText = '✅ Оформлено';
    btn.disabled = true;
    showToast('🎉 Успешно! Ждите уведомления о релизе.');
}

// Задания
async function loadTasks() {
    const container = document.getElementById('tasks-list');
    if (!container) return;
    container.innerHTML = '';

    for (let task of TASKS) {
        const { data: comp } = await db.from('completed_tasks').select('id').eq('telegram_id', USER_ID).eq('task_id', task.id).single();
        const el = document.createElement('div');
        el.className = 'glass-card task-card';
        el.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                <div>
                    <strong style="font-size:14px;">${task.title}</strong><br>
                    <small style="color: #ffb800; font-weight:700;">+${task.reward} ЯрКуСиК</small>
                </div>
                <button class="presave-btn" ${comp ? 'disabled style="opacity:0.5"' : ''} onclick="executeTask('${task.id}', ${task.reward}, '${task.link}', this)">
                    ${comp ? '✅ Готово' : 'Старт'}
                </button>
            </div>
        `;
        container.appendChild(el);
    }
}

async function executeTask(taskId, reward, link, btn) {
    if (tg) tg.openTelegramLink(link);
    else window.open(link, '_blank');

    setTimeout(async () => {
        await db.from('completed_tasks').insert([{ telegram_id: USER_ID, task_id: taskId }]);
        userBalance += reward;
        await db.from('profiles').update({ ux_gold_balance: userBalance }).eq('telegram_id', USER_ID);
        updateBalanceUI();
        btn.innerText = '✅ Готово';
        btn.disabled = true;
        showToast(`🎉 Начислено +${reward} ЯрКуСиК!`);
    }, 2500);
}

// --- КЛИКЕР ЯРКУСИК (YKSI-Tap v7) ---
let tapThrottle = 0;
async function handleTap(e) {
    const now = Date.now();
    if (now - tapThrottle < 100) return; 
    tapThrottle = now;

    const earned = 0.0005;
    userBalance += earned;
    updateBalanceUI();

    const container = document.getElementById('floating-scores-container');
    if (container) {
        const floatEl = document.createElement('div');
        floatEl.className = 'floating-score';
        floatEl.innerText = '+0.0005 🟡';
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX || (rect.left + rect.width/2)) - rect.left;
        const y = (e.clientY || (rect.top + rect.height/2)) - rect.top;
        floatEl.style.left = `${x}px`;
        floatEl.style.top = `${y}px`;
        container.appendChild(floatEl);
        setTimeout(() => floatEl.remove(), 1000);
    }

    await db.from('profiles').update({ ux_gold_balance: userBalance }).eq('telegram_id', USER_ID);
    await db.from('tap_history').insert([{ telegram_id: USER_ID, earned: earned }]);
    loadTapHistory();
}

async function loadTapHistory() {
    const list = document.getElementById('tap-history-list');
    if (!list) return;
    const { data: hist } = await db.from('tap_history').select('*').eq('telegram_id', USER_ID).order('id', { ascending: false }).limit(5);
    if (!hist || hist.length === 0) {
        list.innerHTML = 'Журнал пуст';
        return;
    }
    list.innerHTML = hist.map(h => `<div>⚡ Получена энергия: +0.0005 ЯрКуСиК (${new Date(h.created_at).toLocaleTimeString()})</div>`).join('');
}

// --- ПОДАРКИ & NFT ---
function switchGiftsSubTab(sub) {
    document.querySelectorAll('#tab-gifts .admin-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.gifts-sub-content').forEach(c => c.classList.remove('active'));
    const subTabsMap = { 'catalog': 0, 'nft': 1, 'my': 2 };
    document.querySelectorAll('#tab-gifts .admin-tab-btn')[subTabsMap[sub]].classList.add('active');
    document.getElementById(`gifts-sub-${sub}`).classList.add('active');
}

async function loadGiftsCatalog() {
    const { data: gifts } = await db.from('gifts').select('*').order('price', { ascending: true });
    if (!gifts) return;
    const cat = gifts.filter(g => !g.is_nft);
    const nft = gifts.filter(g => g.is_nft);
    document.getElementById('catalog-gifts-list').innerHTML = cat.map(g => renderGiftCard(g)).join('');
    document.getElementById('nft-gifts-list').innerHTML = nft.map(g => renderGiftCard(g)).join('');
}

function renderGiftCard(g) {
    return `
        <div class="glass-card gift-card">
            <div style="font-size:40px; text-align:center; margin-bottom:8px;">${g.image || '🎁'}</div>
            <div style="font-weight:800; font-size:14px; text-align:center;">${g.name}</div>
            <div style="font-size:11px; opacity:0.6; text-align:center; margin-bottom:10px;">${g.description || ''}</div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto;">
                <span style="color:#ffb800; font-weight:800; font-size:12px;">🟡 ${formatNum(g.price)}</span>
                <button class="presave-btn" style="padding:6px 12px; font-size:11px;" onclick="buyGift(${g.id}, ${g.price})">Купить</button>
            </div>
        </div>
    `;
}

async function buyGift(giftId, price) {
    if (userBalance < price) return showToast('❌ Недостаточно ЯрКуСиК!', 'error');
    userBalance -= price;
    await db.from('profiles').update({ ux_gold_balance: userBalance }).eq('telegram_id', USER_ID);
    await db.from('user_gifts').insert([{ telegram_id: USER_ID, gift_id: giftId, acquired_at: new Date().toLocaleDateString(), source: 'Покупка' }]);
    updateBalanceUI(); loadMyGifts();
    showToast('🎉 Подарок добавлен в вашу коллекцию!');
}

async function loadMyGifts() {
    const container = document.getElementById('my-gifts-list');
    if (!container) return;
    const { data: myG } = await db.from('user_gifts').select('*, gifts(*)').eq('telegram_id', USER_ID);
    if (!myG || myG.length === 0) {
        container.innerHTML = '<div class="loading-spinner">Коллекция пуста</div>';
        return;
    }
    container.innerHTML = myG.map(ug => `
        <div class="glass-card gift-card">
            <div style="font-size:40px; text-align:center; margin-bottom:8px;">${ug.gifts?.image || '🎁'}</div>
            <div style="font-weight:800; font-size:14px; text-align:center;">${ug.gifts?.name}</div>
            <div style="font-size:10px; opacity:0.4; text-align:center;">${ug.source || 'Личный'}</div>
            <button class="listen-link" style="margin-top:10px; width:100%;" onclick="openSendGiftModal(${ug.id})">🎁 Подарить другу</button>
        </div>
    `).join('');
}

// --- РОЗЫГРЫШИ ---
async function loadGiveaways() {
    const container = document.getElementById('giveaways-list');
    const { data: gws } = await db.from('giveaways').select('*').order('id', { ascending: false });
    if (!gws || gws.length === 0) {
        container.innerHTML = '<div class="loading-spinner">Активных розыгрышей нет</div>';
        return;
    }
    container.innerHTML = gws.map(gw => `
        <div class="glass-card" style="padding:16px;">
            <div style="font-weight:900; font-size:16px; margin-bottom:6px;">🎟️ ${gw.title}</div>
            <p style="font-size:12px; opacity:0.7; margin-bottom:10px;">${gw.description || ''}</p>
            <div style="font-size:11px; color:#ffb800; margin-bottom:12px;">Приз: <strong>${gw.prize_gold > 0 ? formatNum(gw.prize_gold) + ' ЯрКуСиК' : 'Секретный подарок'}</strong></div>
            <button class="presave-btn" style="width:100%;" onclick="participateGiveaway(${gw.id}, ${gw.cost || 0})">Участвовать ${gw.cost > 0 ? '(' + gw.cost + ')' : ''}</button>
        </div>
    `).join('');
}

async function participateGiveaway(gwId, cost) {
    if (cost > 0) {
        if (userBalance < cost) return showToast('❌ Мало ЯрКуСиК!', 'error');
        userBalance -= cost;
        await db.from('profiles').update({ ux_gold_balance: userBalance }).eq('telegram_id', USER_ID);
        updateBalanceUI();
    }
    const { data: ex } = await db.from('giveaway_participants').select('id').eq('giveaway_id', gwId).eq('telegram_id', USER_ID).single();
    if (ex) return showToast('Вы уже в списке участников!', 'error');
    await db.from('giveaway_participants').insert([{ giveaway_id: gwId, telegram_id: USER_ID }]);
    showToast('🎉 Вы зарегистрированы в розыгрыше!');
}

// --- СООБЩЕСТВО & ЧАТЫ (v7) ---
function switchCommSubTab(sub) {
    document.querySelectorAll('#tab-community .admin-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.comm-sub-content').forEach(c => c.classList.remove('active'));
    const commTabsMap = { 'members': 0, 'chats': 1 };
    document.querySelectorAll('#tab-community .admin-tab-btn')[commTabsMap[sub]].classList.add('active');
    document.getElementById(`comm-sub-${sub}`).classList.add('active');
}

async function loadMembers() {
    const { data: mems } = await db.from('profiles').select('*').order('id', { ascending: false }).limit(40);
    if (!mems) return;
    document.getElementById('members-list').innerHTML = mems.map(m => `
        <div class="glass-card member-item" style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px;">
            <div style="display:flex; align-items:center; gap:12px; cursor:pointer;" onclick="openUserProfile(${m.telegram_id})">
                <img src="${m.photo_url || 'https://via.placeholder.com/40/1c0508/ff2a55?text=U'}" style="width:44px; height:44px; border-radius:50%; border:1px solid #ff2a55;" />
                <div>
                    <div style="font-weight:800; font-size:14px;">${m.first_name}</div>
                    <div style="font-size:10px; opacity:0.5;">${m.bio ? m.bio.substring(0,30) + '...' : 'Резидент ЯрКуСиК'}</div>
                </div>
            </div>
            <button class="presave-btn" style="padding:6px 12px; font-size:11px;" onclick="openUserProfile(${m.telegram_id})">Инфо</button>
        </div>
    `).join('');
}

async function openUserProfile(tgId) {
    currentViewingUserId = tgId;
    const { data: p } = await db.from('profiles').select('*').eq('telegram_id', tgId).single();
    if (!p) return;
    const details = document.getElementById('modal-user-details');
    details.innerHTML = `
        <img src="${p.photo_url || 'https://via.placeholder.com/80/1c0508/ff2a55?text=U'}" style="width:80px; height:80px; border-radius:50%; border:3px solid #ff2a55; margin-bottom:12px;" />
        <h3 style="font-weight:900; font-size:18px;">${p.first_name}</h3>
        <p style="font-size:12px; opacity:0.7; margin-top:6px;">${p.bio || 'Участник сообщества'}</p>
        <div style="font-size:11px; color:#ffb800; margin-top:10px; font-weight:700;">Статус: Резидент ЯрКуСиК</div>
    `;
    document.getElementById('user-profile-modal').style.display = 'flex';
}

function closeUserProfileModal() { document.getElementById('user-profile-modal').style.display = 'none'; }

function openDirectChat() {
    if (currentViewingUserId === USER_ID) return showToast('Это вы!', 'error');
    closeUserProfileModal();
    openChatWithPeer(currentViewingUserId);
}

async function openChatWithPeer(peerId) {
    activeChatPeerId = peerId;
    const { data: peer } = await db.from('profiles').select('first_name').eq('telegram_id', peerId).single();
    document.getElementById('chat-modal-title').innerText = `💬 Чат: ${peer?.first_name || 'Участник'}`;
    document.getElementById('chat-modal').style.display = 'flex';
    loadChatMessages();
    if (chatPollingInterval) clearInterval(chatPollingInterval);
    chatPollingInterval = setInterval(loadChatMessages, 3000);
}

async function loadChatMessages() {
    if (!activeChatPeerId) return;
    const cont = document.getElementById('chat-messages-container');
    const { data: msgs } = await db.from('messages')
        .select('*')
        .or(`and(sender_id.eq.${USER_ID},recipient_id.eq.${activeChatPeerId}),and(sender_id.eq.${activeChatPeerId},recipient_id.eq.${USER_ID})`)
        .order('id', { ascending: true });
    if (!msgs || msgs.length === 0) {
        cont.innerHTML = '<div style="text-align:center; opacity:0.4; font-size:11px; padding:30px;">Начните общение первым!</div>';
        return;
    }
    cont.innerHTML = msgs.map(m => {
        const isMe = m.sender_id === USER_ID;
        return `<div style="display:flex; justify-content:${isMe ? 'flex-end' : 'flex-start'};">
            <div style="background:${isMe ? 'linear-gradient(135deg, #ff2a55, #b80028)' : 'rgba(255,255,255,0.1)'}; padding:10px 14px; border-radius:14px; max-width:80%; font-size:13px; box-shadow:0 2px 10px rgba(0,0,0,0.2);">
                ${m.text}
                <div style="font-size:9px; opacity:0.5; text-align:right; margin-top:4px;">${new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
            </div>
        </div>`;
    }).join('');
    cont.scrollTop = cont.scrollHeight;
}

async function sendChatMessage() {
    const inp = document.getElementById('chat-input-message');
    const txt = inp.value.trim();
    if (!txt || !activeChatPeerId) return;
    if (txt.length > 500) return showToast('Слишком длинное!', 'error');
    inp.value = '';
    await db.from('messages').insert([{ sender_id: USER_ID, recipient_id: activeChatPeerId, text: txt }]);
    loadChatMessages(); loadConversations();
}

async function loadConversations() {
    const cont = document.getElementById('conversations-list');
    const { data: msgs } = await db.from('messages').select('*').or(`sender_id.eq.${USER_ID},recipient_id.eq.${USER_ID}`).order('id', { ascending: false });
    if (!msgs || msgs.length === 0) {
        cont.innerHTML = '<div class="loading-spinner">Диалогов пока нет</div>';
        return;
    }
    const peers = new Map();
    msgs.forEach(m => { const pid = m.sender_id === USER_ID ? m.recipient_id : m.sender_id; if(!peers.has(pid)) peers.set(pid, m); });
    const { data: profs } = await db.from('profiles').select('*').in('telegram_id', Array.from(peers.keys()));
    const profMap = new Map((profs || []).map(p => [p.telegram_id, p]));
    cont.innerHTML = Array.from(peers.entries()).map(([pid, last]) => {
        const p = profMap.get(pid) || { first_name: 'Участник' };
        return `<div class="glass-card" style="display:flex; align-items:center; gap:12px; padding:12px 16px; cursor:pointer;" onclick="openChatWithPeer(${pid})">
            <img src="${p.photo_url || 'https://via.placeholder.com/40/1c0508/ff2a55?text=U'}" style="width:44px; height:44px; border-radius:50%;" />
            <div style="flex:1; overflow:hidden;">
                <div style="font-weight:800; font-size:14px;">${p.first_name}</div>
                <div style="font-size:12px; opacity:0.6; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${last.text}</div>
            </div>
            <div style="font-size:10px; opacity:0.4;">${new Date(last.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
        </div>`;
    }).join('');
}

function closeChatModal() { document.getElementById('chat-modal').style.display = 'none'; clearInterval(chatPollingInterval); activeChatPeerId = null; }

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
function convertFromGold() { const g = parseFloat(document.getElementById('calc-gold').value) || 0; document.getElementById('calc-rub').value = (g / 100).toFixed(2); }
function convertFromRub() { const r = parseFloat(document.getElementById('calc-rub').value) || 0; document.getElementById('calc-gold').value = Math.round(r * 100); }

const audio = document.getElementById('audio-element');
function playAudio(url, title, cover) {
    if (!url || !audio) return;
    audio.src = url; audio.play();
    document.getElementById('player-title').innerText = title;
    document.getElementById('player-cover').src = cover || 'https://via.placeholder.com/50/1c0508/ff2a55?text=Y';
    document.getElementById('player-bar').classList.remove('hidden');
    document.getElementById('player-play-btn').innerText = '⏸';
}
function togglePlayPause() { if (audio.paused) { audio.play(); document.getElementById('player-play-btn').innerText = '⏸'; } else { audio.pause(); document.getElementById('player-play-btn').innerText = '▶️'; } }
if (audio) { audio.ontimeupdate = () => { if (audio.duration) { const pct = (audio.currentTime / audio.duration) * 100; document.getElementById('player-progress').style.width = pct + '%'; } }; }
function seekAudio(e) { const r = e.currentTarget.getBoundingClientRect(); audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration; }

function convertFileToBase64(fi, hi) { const file = fi.files[0]; if (!file) return; const reader = new FileReader(); reader.onloadend = () => document.getElementById(hi).value = reader.result; reader.readAsDataURL(file); }

// --- АДМИН ПАНЕЛЬ ---
function openAdminModal() { document.getElementById('admin-modal').style.display = 'flex'; populateBoostSelect(); }
function closeAdminModal() { document.getElementById('admin-modal').style.display = 'none'; }
function switchAdminTab(t) {
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-form').forEach(f => f.classList.remove('active'));
    const map = { 'add-track': 0, 'add-news': 1, 'edit-likes': 2, 'admin-gifts': 3, 'admin-giveaways': 4, 'admin-users': 5 };
    document.querySelectorAll('.admin-tab-btn')[map[t]].classList.add('active');
    document.getElementById(['form-track', 'form-news', 'form-likes', 'form-gifts-admin', 'form-giveaways-admin', 'form-users-admin'][map[t]]).classList.add('active');
}
function populateBoostSelect() { document.getElementById('boost-track-select').innerHTML = allTracks.map(t => `<option value="${t.id}">${t.title}</option>`).join(''); }
async function applyLikesBoost() {
    const tid = document.getElementById('boost-track-select').value;
    const lks = parseInt(document.getElementById('boost-likes-count').value);
    await db.from('tracks').update({ likes: lks }).eq('id', tid);
    showToast('Лайки обновлены!'); closeAdminModal(); loadTracks();
}
async function handleTrackSubmit(e) {
    e.preventDefault();
    const data = {
        title: document.getElementById('track-title').value,
        cover: document.getElementById('track-cover-data').value,
        audio: document.getElementById('track-audio-data').value,
        link: document.getElementById('track-link').value,
        release_date: document.getElementById('track-date').value,
        likes: parseInt(document.getElementById('track-initial-likes').value) || 0,
        is_upcoming: document.getElementById('track-upcoming').checked
    };
    await db.from('tracks').insert([data]);
    closeAdminModal(); loadTracks(); showToast('Релиз опубликован!');
}
async function handleNewsSubmit(e) {
    e.preventDefault();
    await db.from('news').insert([{ text: document.getElementById('news-text').value, image: document.getElementById('news-image-data').value, date: new Date().toLocaleDateString() }]);
    closeAdminModal(); loadNews(); showToast('Новость в ленте!');
}
async function adminCreateGift() {
    const data = { 
        name: document.getElementById('adm-gift-name').value, 
        description: document.getElementById('adm-gift-desc').value, 
        price: parseInt(document.getElementById('adm-gift-price').value), 
        image: document.getElementById('adm-gift-img').value, 
        is_nft: document.getElementById('adm-gift-is-nft').checked 
    };
    await db.from('gifts').insert([data]);
    closeAdminModal(); loadGiftsCatalog(); showToast('Подарок создан!');
}
async function adminCreateGiveaway() {
    const data = { 
        title: document.getElementById('adm-gw-title').value, 
        description: document.getElementById('adm-gw-desc').value, 
        prize_gold: parseInt(document.getElementById('adm-gw-prize-gold').value), 
        end_date: document.getElementById('adm-gw-end').value 
    };
    await db.from('giveaways').insert([data]);
    closeAdminModal(); loadGiveaways(); showToast('Розыгрыш запущен!');
}
async function adminAdjustBalance() {
    const tid = parseInt(document.getElementById('adm-user-tg-id').value);
    const am = parseInt(document.getElementById('adm-user-amount').value);
    const { data: p } = await db.from('profiles').select('ux_gold_balance').eq('telegram_id', tid).single();
    if (!p) return showToast('Нет юзера', 'error');
    await db.from('profiles').update({ ux_gold_balance: (p.ux_gold_balance || 0) + am }).eq('telegram_id', tid);
    closeAdminModal(); showToast('Баланс изменен!');
}

function handleSearch() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const f = allTracks.filter(t => t.title.toLowerCase().includes(q));
    renderTracks(f.filter(t => !t.is_upcoming), 'tracks-list');
    renderTracks(f.filter(t => t.is_upcoming), 'upcoming-list');
}
async function deleteTrack(id) { if(confirm('Удалить?')) { await db.from('tracks').delete().eq('id', id); loadTracks(); } }
async function deleteNews(id) { if(confirm('Удалить?')) { await db.from('news').delete().eq('id', id); loadNews(); } }
