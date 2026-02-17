// ========================================
//  STANDOFF 2 · КЕЙС-РУЛЕТКА
//  ИСПРАВЛЕННАЯ ЗАГРУЗКА ДАННЫХ
// ========================================

const tg = window.Telegram?.WebApp;

if (!tg) {
    alert('Запустите приложение через Telegram!');
    throw new Error('Not in Telegram');
}

tg.ready();
tg.expand();

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

const userId = user.id.toString();
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
let balance = 100;
let lastFreeSpin = null;
let isSpinning = false;
let animationInterval = null;
let spinTimeout = null;
let timerInterval = null;

// ---------- КЛЮЧИ ДЛЯ ХРАНЕНИЯ ----------
const STORAGE_KEYS = {
    BALANCE: `balance_${userId}`,
    LAST_FREE: `lastFree_${userId}`
};

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

// ---------- БЕЗОПАСНОЕ ПРЕОБРАЗОВАНИЕ В ЧИСЛО ----------
function safeParseInt(value, defaultValue = 100) {
    if (!value) return defaultValue;
    const parsed = parseInt(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

function safeParseFloat(value, defaultValue = null) {
    if (!value) return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

// ---------- ЗАГРУЗКА ИЗ CLOUD STORAGE ----------
async function loadFromCloud() {
    try {
        // Запрашиваем оба значения одним вызовом
        const result = await tg.CloudStorage.getItems([STORAGE_KEYS.BALANCE, STORAGE_KEYS.LAST_FREE]);
        
        if (result && result[STORAGE_KEYS.BALANCE] !== undefined) {
            balance = safeParseInt(result[STORAGE_KEYS.BALANCE], 100);
            console.log('✅ Баланс из облака:', balance);
        }
        
        if (result && result[STORAGE_KEYS.LAST_FREE] !== undefined) {
            const freeValue = safeParseFloat(result[STORAGE_KEYS.LAST_FREE], null);
            if (freeValue !== null) {
                lastFreeSpin = freeValue;
                console.log('✅ lastFree из облака:', new Date(lastFreeSpin).toLocaleString());
            }
        }
        
        return true;
    } catch(e) {
        console.warn('⚠️ Ошибка загрузки из облака:', e);
        return false;
    }
}

// ---------- ЗАГРУЗКА ИЗ LOCALSTORAGE ----------
function loadFromLocal() {
    try {
        const balanceData = localStorage.getItem(STORAGE_KEYS.BALANCE);
        const freeData = localStorage.getItem(STORAGE_KEYS.LAST_FREE);
        
        if (balanceData) {
            balance = safeParseInt(balanceData, 100);
            console.log('✅ Баланс из localStorage:', balance);
        }
        
        if (freeData) {
            lastFreeSpin = safeParseFloat(freeData, null);
            if (lastFreeSpin !== null) {
                console.log('✅ lastFree из localStorage:', new Date(lastFreeSpin).toLocaleString());
            }
        }
        
        return true;
    } catch(e) {
        console.warn('⚠️ Ошибка загрузки из localStorage:', e);
        return false;
    }
}

// ---------- ОСНОВНАЯ ЗАГРУЗКА ----------
async function loadGame() {
    showLoading(true);
    
    // Пробуем загрузить из облака
    const cloudSuccess = await loadFromCloud();
    
    // Если облако не сработало или данных нет, пробуем localStorage
    if (!cloudSuccess || balance === 100 && !lastFreeSpin) {
        loadFromLocal();
    }
    
    // Если после всего баланс не установлен или NaN, ставим 100
    if (typeof balance !== 'number' || isNaN(balance) || balance < 0) {
        balance = 100;
        console.log('🆕 Установлен баланс по умолчанию: 100');
    }
    
    // Проверяем lastFreeSpin на валидность
    if (lastFreeSpin && (isNaN(lastFreeSpin) || lastFreeSpin > Date.now() + 86400000)) {
        lastFreeSpin = null;
        console.log('🆕 Сброс невалидного lastFreeSpin');
    }
    
    updateBalanceUI();
    updateFreeTimer();
    
    showLoading(false);
}

// ---------- СОХРАНЕНИЕ В CLOUD ----------
async function saveToCloud() {
    try {
        const items = {};
        items[STORAGE_KEYS.BALANCE] = balance.toString();
        
        if (lastFreeSpin) {
            items[STORAGE_KEYS.LAST_FREE] = lastFreeSpin.toString();
        } else {
            // Если lastFreeSpin null, удаляем ключ
            await tg.CloudStorage.removeItem(STORAGE_KEYS.LAST_FREE).catch(() => {});
        }
        
        await tg.CloudStorage.setItems(items);
        console.log('✅ Сохранено в облако');
        return true;
    } catch(e) {
        console.warn('⚠️ Ошибка сохранения в облако:', e);
        return false;
    }
}

// ---------- СОХРАНЕНИЕ В LOCALSTORAGE ----------
function saveToLocal() {
    try {
        localStorage.setItem(STORAGE_KEYS.BALANCE, balance.toString());
        if (lastFreeSpin) {
            localStorage.setItem(STORAGE_KEYS.LAST_FREE, lastFreeSpin.toString());
        } else {
            localStorage.removeItem(STORAGE_KEYS.LAST_FREE);
        }
        console.log('✅ Сохранено в localStorage');
        return true;
    } catch(e) {
        console.warn('⚠️ Ошибка сохранения в localStorage:', e);
        return false;
    }
}

// ---------- ОСНОВНОЕ СОХРАНЕНИЕ ----------
async function saveGame() {
    await saveToCloud();
    saveToLocal();
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
        saveGame();
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

    if (isPaid) {
        balance -= SPIN_COST;
        updateBalanceUI();
        await saveGame();
    }

    const winValue = getWinValue(isPaid);
    
    await startSmoothAnimation(winValue);
    
    balance += winValue;
    updateBalanceUI();

    if (!isPaid) {
        lastFreeSpin = Date.now();
    }

    await saveGame();

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
    await loadGame();
    updateFreeTimer();
    paidBtn.disabled = balance < SPIN_COST;
    caseDisplay.innerText = '0';
    
    timerInterval = setInterval(updateFreeTimer, 1000);
    setInterval(saveGame, 30000);
})();

// ---------- ОЧИСТКА ----------
window.addEventListener('beforeunload', () => {
    if (animationInterval) clearInterval(animationInterval);
    if (spinTimeout) clearTimeout(spinTimeout);
    if (timerInterval) clearInterval(timerInterval);
    saveGame();
});