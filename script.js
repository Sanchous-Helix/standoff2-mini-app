// ========================================
//  STANDOFF 2 · КЕЙС-РУЛЕТКА
//  ИСПРАВЛЕННАЯ ВЕРСИЯ - РАБОТАЕТ С ТУННЕЛЕМ
// ========================================

const tg = window.Telegram?.WebApp;

if (!tg) {
    alert('Запустите приложение через Telegram!');
    throw new Error('Not in Telegram');
}

tg.ready();
tg.expand();

// ============ ТВОЙ РАБОЧИЙ URL ============
const API_BASE = 'https://khaki-planes-smell.loca.lt';
// ===========================================

// ---------- ЭЛЕМЕНТЫ DOM ----------
const loadingEl = document.getElementById('loading');
const avatarEl = document.getElementById('avatar');
const usernameEl = document.getElementById('username');
const balanceEl = document.getElementById('balance');
const caseDisplay = document.getElementById('caseDisplay');
const resultEl = document.getElementById('result');
const freeBtn = document.getElementById('freeSpinBtn');
const paidBtn = document.getElementById('paidSpinBtn');
const freeTimer = document.getElementById('freeTimer');
const caseContainer = document.querySelector('.case-container');

// ---------- ДАННЫЕ ПОЛЬЗОВАТЕЛЯ ----------
const user = tg.initDataUnsafe?.user;
if (!user) {
    alert('Ошибка: не удалось получить данные пользователя');
    throw new Error('No user data');
}

const userId = user.id;
const userName = user.first_name;
const userPhoto = user.photo_url;

usernameEl.innerText = userName;
avatarEl.src = userPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=ffd700&color=000&size=128`;

// ---------- ШАНСЫ ----------
const FREE_CHANCES = [
    { value: 0, prob: 85.4745 },
    { value: 5, prob: 7.5 },
    { value: 10, prob: 3.75 },
    { value: 15, prob: 2 },
    { value: 25, prob: 0.9 },
    { value: 50, prob: 0.35 },
    { value: 100, prob: 0.025 },
    { value: 250, prob: 0.0005 }
];

const PAID_CHANCES = [
    { value: 0, prob: 64.5745 },
    { value: 5, prob: 17.4 },
    { value: 10, prob: 15 },
    { value: 15, prob: 10 },
    { value: 25, prob: 5 },
    { value: 50, prob: 2 },
    { value: 100, prob: 0.125 },
    { value: 250, prob: 0.005 }
];

// ---------- НАСТРОЙКИ ----------
const SPIN_COST = 10;
const COOLDOWN_HOURS = 24;
const ALLOWED_VALUES = [0, 5, 10, 15, 25, 50, 100, 250];
const ANIMATION_DURATION = 5000;
const FRAME_RATE = 60;

// ---------- СОСТОЯНИЕ ----------
let balance = 0;
let lastFreeSpin = null;
let isSpinning = false;
let animationInterval = null;
let spinTimeout = null;
let timerInterval = null;

// ---------- ПОКАЗ/СКРЫТИЕ ЗАГРУЗКИ ----------
function showLoading(show) {
    if (loadingEl) {
        if (show) {
            loadingEl.classList.remove('hidden');
        } else {
            loadingEl.classList.add('hidden');
        }
    }
}

// ---------- API ЗАПРОСЫ (ИСПРАВЛЕНО) ----------
async function apiRequest(endpoint, method = 'POST', data = {}) {
    try {
        const response = await fetch(`${API_BASE}/${endpoint}`, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId,
                username: user.username,
                firstName: user.first_name,
                ...data
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`❌ API Error (${endpoint}):`, error);
        return { error: error.message };
    }
}

// ---------- ЗАГРУЗКА ПОЛЬЗОВАТЕЛЯ ----------
async function loadUser() {
    showLoading(true);
    
    try {
        const data = await apiRequest('api/user');
        
        if (data.error) {
            console.error('Ошибка загрузки пользователя:', data.error);
            const localBalance = localStorage.getItem(`balance_${userId}`);
            balance = localBalance ? parseInt(localBalance) : 100;
            lastFreeSpin = null;
        } else {
            balance = data.balance || 100;
            lastFreeSpin = data.lastFreeSpin ? new Date(data.lastFreeSpin) : null;
            console.log('✅ Данные загружены с сервера:', balance);
            localStorage.setItem(`balance_${userId}`, balance.toString());
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        const localBalance = localStorage.getItem(`balance_${userId}`);
        balance = localBalance ? parseInt(localBalance) : 100;
    }
    
    updateBalanceUI();
    updateFreeTimer();
    showLoading(false);
}

// ---------- ОБНОВЛЕНИЕ BALANCE UI ----------
function updateBalanceUI() {
    balanceEl.innerText = balance;
}

// ---------- ВЫБОР ВЫИГРЫША ----------
function getWinValue(isPaid) {
    const table = isPaid ? PAID_CHANCES : FREE_CHANCES;
    const rand = Math.random() * 100;
    let cumulative = 0;
    
    for (let item of table) {
        cumulative += item.prob;
        if (rand < cumulative) {
            console.log(`🎲 Выигрыш: ${item.value}G (шанс ${item.prob}%)`);
            return item.value;
        }
    }
    return 0;
}

// ---------- ГЕНЕРАЦИЯ СЛУЧАЙНОГО ЧИСЛА ----------
function getRandomRollerValue() {
    if (Math.random() < 0.7) {
        return ALLOWED_VALUES[Math.floor(Math.random() * ALLOWED_VALUES.length)];
    } else {
        return Math.floor(Math.random() * 301);
    }
}

// ---------- АНИМАЦИЯ ----------
function startSmoothAnimation(finalValue) {
    return new Promise((resolve) => {
        const startTime = performance.now();
        
        caseContainer.classList.add('spinning');
        
        if (animationInterval) clearInterval(animationInterval);
        
        animationInterval = setInterval(() => {
            const elapsed = performance.now() - startTime;
            
            if (elapsed < ANIMATION_DURATION) {
                const randomValue = getRandomRollerValue();
                caseDisplay.innerText = randomValue;
                
                const progress = elapsed / ANIMATION_DURATION;
                const opacity = 0.3 + Math.sin(progress * Math.PI * 10) * 0.4;
                caseDisplay.style.opacity = opacity;
                
                const blurAmount = Math.sin(progress * Math.PI) * 5;
                caseDisplay.style.textShadow = `0 0 ${blurAmount}px #ffd700`;
            }
        }, 1000 / FRAME_RATE);
        
        if (spinTimeout) clearTimeout(spinTimeout);
        spinTimeout = setTimeout(() => {
            clearInterval(animationInterval);
            caseContainer.classList.remove('spinning');
            caseDisplay.style.opacity = 1;
            caseDisplay.style.textShadow = '0 0 30px #ffd700';
            caseDisplay.innerText = finalValue;
            resolve();
        }, ANIMATION_DURATION);
    });
}

// ---------- ТАЙМЕР БЕСПЛАТНОГО СПИНА ----------
function updateFreeTimer() {
    if (!lastFreeSpin) {
        freeBtn.disabled = false;
        freeTimer.innerText = '24:00';
        return;
    }
    
    const now = Date.now();
    const hoursPassed = (now - lastFreeSpin) / (1000 * 60 * 60);
    
    if (hoursPassed >= COOLDOWN_HOURS) {
        freeBtn.disabled = false;
        freeTimer.innerText = '24:00';
        lastFreeSpin = null;
    } else {
        freeBtn.disabled = true;
        const left = COOLDOWN_HOURS - hoursPassed;
        const h = Math.floor(left);
        const m = Math.floor((left - h) * 60);
        const s = Math.floor(((left - h) * 60 - m) * 60);
        
        if (h > 0) {
            freeTimer.innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
        } else {
            freeTimer.innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        }
    }
}

// ---------- ОСНОВНАЯ КРУТКА ----------
async function handleSpin(isPaid) {
    if (isSpinning) {
        tg.showAlert('❌ Уже крутится!');
        return;
    }

    if (!isPaid && lastFreeSpin) {
        const hoursPassed = (Date.now() - lastFreeSpin) / (1000 * 60 * 60);
        if (hoursPassed < COOLDOWN_HOURS) {
            const left = COOLDOWN_HOURS - hoursPassed;
            const h = Math.floor(left);
            const m = Math.floor((left - h) * 60);
            tg.showAlert(`❌ Бесплатный спин через ${h}ч ${m}м`);
            return;
        }
    }

    if (isPaid && balance < SPIN_COST) {
        tg.showAlert('❌ Недостаточно G!');
        return;
    }

    isSpinning = true;
    freeBtn.disabled = true;
    paidBtn.disabled = true;
    resultEl.innerText = '';

    const oldBalance = balance;
    
    if (isPaid) {
        balance -= SPIN_COST;
        updateBalanceUI();
    }

    const winValue = getWinValue(isPaid);
    
    await startSmoothAnimation(winValue);
    
    const result = await apiRequest('api/spin', 'POST', {
        spinType: isPaid ? 'paid' : 'free',
        winAmount: winValue
    });
    
    if (!result.error) {
        balance = result.newBalance;
        if (result.lastFreeSpin) {
            lastFreeSpin = new Date(result.lastFreeSpin);
        }
        localStorage.setItem(`balance_${userId}`, balance.toString());
    } else {
        console.error('Ошибка сервера, используем локальное сохранение');
        if (isPaid) {
            balance = oldBalance - SPIN_COST + winValue;
        } else {
            balance = oldBalance + winValue;
            lastFreeSpin = Date.now();
        }
        localStorage.setItem(`balance_${userId}`, balance.toString());
    }
    
    updateBalanceUI();

    if (winValue >= 100) {
        resultEl.innerText = `🔥 ДЖЕКПОТ! +${winValue}G 🔥`;
        caseDisplay.classList.add('jackpot');
        setTimeout(() => caseDisplay.classList.remove('jackpot'), 1500);
        tg.HapticFeedback?.impactOccurred('heavy');
    } else if (winValue >= 50) {
        resultEl.innerText = `⚡ +${winValue}G ⚡`;
        tg.HapticFeedback?.impactOccurred('medium');
    } else if (winValue > 0) {
        resultEl.innerText = `🎉 +${winValue}G`;
        tg.HapticFeedback?.impactOccurred('light');
    } else {
        resultEl.innerText = `💔 0G`;
        tg.HapticFeedback?.notificationOccurred('error');
    }

    isSpinning = false;
    updateFreeTimer();
    paidBtn.disabled = balance < SPIN_COST;
}

// ---------- ПОДПИСКИ ----------
freeBtn.addEventListener('click', () => handleSpin(false));
paidBtn.addEventListener('click', () => handleSpin(true));

// ---------- ИНИЦИАЛИЗАЦИЯ ----------
(async function init() {
    await loadUser();
    updateFreeTimer();
    paidBtn.disabled = balance < SPIN_COST;
    caseDisplay.innerText = '0';
    
    timerInterval = setInterval(updateFreeTimer, 1000);
    
    try {
        const response = await fetch(API_BASE);
        if (response.ok) {
            console.log('✅ Соединение с сервером установлено');
        } else if (response.status === 511) {
            console.log('⚠️ Требуется активация туннеля - открой ссылку в браузере');
            // Показываем уведомление пользователю
            tg.showPopup({
                title: '⚠️ Требуется активация',
                message: 'Открой ссылку в браузере для активации туннеля',
                buttons: [{ type: 'default', text: 'Открыть' }]
            }, () => {
                window.open(API_BASE, '_blank');
            });
        }
    } catch (error) {
        console.warn('⚠️ Сервер не доступен, работаем в офлайн режиме');
    }
})();

// ---------- ОЧИСТКА ----------
window.addEventListener('beforeunload', () => {
    if (animationInterval) clearInterval(animationInterval);
    if (spinTimeout) clearTimeout(spinTimeout);
    if (timerInterval) clearInterval(timerInterval);
});