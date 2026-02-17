// ========================================
//  STANDOFF 2 · КЕЙС-РУЛЕТКА
//  С ИСПОЛЬЗОВАНИЕМ TELEGRAM CLOUD STORAGE
//  ИСПРАВЛЕН ТАЙМЕР И СИНХРОНИЗАЦИЯ
// ========================================

const tg = window.Telegram?.WebApp;

// ---------- ПРОВЕРКА ЗАПУСКА В TELEGRAM ----------
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

usernameEl.innerText = user.first_name;
avatarEl.src = user.photo_url || 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name)}&background=ffd700&color=000&size=128`;

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

// ---------- ЗАГРУЗКА ИЗ CLOUD STORAGE ----------
async function loadGame() {
    showLoading(true);
    
    try {
        // Загружаем баланс
        const balanceData = await tg.CloudStorage.getItem('balance');
        if (balanceData) {
            balance = parseInt(balanceData);
            console.log('Баланс загружен:', balance);
        } else {
            // Первый запуск — даём 100G
            balance = 100;
            await tg.CloudStorage.setItem('balance', balance.toString());
            console.log('Первый запуск, баланс = 100');
        }
        
        // Загружаем время последнего бесплатного спина
        const freeSpinData = await tg.CloudStorage.getItem('lastFreeSpin');
        if (freeSpinData) {
            lastFreeSpin = parseInt(freeSpinData);
            console.log('lastFreeSpin загружен:', new Date(lastFreeSpin).toLocaleString());
        }
        
    } catch(e) {
        console.error('Ошибка загрузки из облака:', e);
        // Если ошибка, оставляем дефолтные значения
        balance = 100;
        lastFreeSpin = null;
    }
    
    updateBalanceUI();
    showLoading(false);
}

// ---------- СОХРАНЕНИЕ В CLOUD STORAGE ----------
async function saveGame() {
    try {
        await tg.CloudStorage.setItem('balance', balance.toString());
        if (lastFreeSpin) {
            await tg.CloudStorage.setItem('lastFreeSpin', lastFreeSpin.toString());
        } else {
            await tg.CloudStorage.removeItem('lastFreeSpin');
        }
        console.log('Данные сохранены в облако');
    } catch(e) {
        console.error('Ошибка сохранения в облако:', e);
    }
}

// ---------- ПОКАЗ/СКРЫТИЕ ЗАГРУЗКИ ----------
function showLoading(show) {
    if (show) {
        loadingEl.classList.remove('hidden');
    } else {
        loadingEl.classList.add('hidden');
    }
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

// ---------- ГЕНЕРАЦИЯ СЛУЧАЙНОГО ЧИСЛА ДЛЯ АНИМАЦИИ ----------
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
        saveGame(); // Сохраняем сброс таймера
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

    // Проверка бесплатного спина
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

    // Проверка платного спина
    if (isPaid && balance < SPIN_COST) {
        tg.showAlert('❌ Недостаточно G!');
        return;
    }

    // Блокируем кнопки
    isSpinning = true;
    freeBtn.disabled = true;
    paidBtn.disabled = true;
    resultEl.innerText = '';

    // Списываем плату
    if (isPaid) {
        balance -= SPIN_COST;
        updateBalanceUI();
        await saveGame(); // Сохраняем после списания
    }

    // Выбираем выигрыш ДО анимации
    const winValue = getWinValue(isPaid);
    
    // Запускаем анимацию
    await startSmoothAnimation(winValue);
    
    // Начисляем выигрыш
    balance += winValue;
    updateBalanceUI();

    // Обновляем время бесплатного спина
    if (!isPaid) {
        lastFreeSpin = Date.now();
    }

    await saveGame(); // Сохраняем всё

    // Показываем результат
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

    // Разблокировка кнопок
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
    
    // Запускаем таймер (обновление каждую секунду)
    timerInterval = setInterval(updateFreeTimer, 1000);
    
    // Автосохранение каждые 30 секунд
    setInterval(saveGame, 30000);
})();

// ---------- ОЧИСТКА ПРИ ВЫХОДЕ ----------
window.addEventListener('beforeunload', () => {
    if (animationInterval) clearInterval(animationInterval);
    if (spinTimeout) clearTimeout(spinTimeout);
    if (timerInterval) clearInterval(timerInterval);
    saveGame();
});