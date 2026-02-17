// ========================================
//  STANDOFF 2 · КЕЙС-РУЛЕТКА
//  ПЛАВНАЯ СМЕНА ЧИСЕЛ, ШАНСЫ СКРЫТЫ
// ========================================

// ---------- Telegram ----------
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
}

// ---------- ПОЛЬЗОВАТЕЛЬ ----------
const user = tg?.initDataUnsafe?.user || {
    first_name: 'Игрок',
    id: Date.now()
};

document.getElementById('username').innerText = user.first_name;
document.getElementById('avatar').src = user.photo_url || 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name)}&background=ffd700&color=000&size=128`;

// ---------- ШАНСЫ (СКРЫТЫЕ) ----------
const FREE_CHANCES = [
    { value: 0, prob: 70.89 },
    { value: 5, prob: 15 },
    { value: 10, prob: 7.5 },
    { value: 15, prob: 4 },
    { value: 25, prob: 1.8 },
    { value: 50, prob: 0.7 },
    { value: 100, prob: 0.1 },
    { value: 250, prob: 0.01 }
];

const PAID_CHANCES = [
    { value: 0, prob: 50 },
    { value: 5, prob: 17.4 },
    { value: 10, prob: 15 },
    { value: 15, prob: 10 },
    { value: 25, prob: 5 },
    { value: 50, prob: 2 },
    { value: 100, prob: 0.5 },
    { value: 250, prob: 0.1 }
];

// ---------- НАСТРОЙКИ ----------
const SPIN_COST = 10;
const COOLDOWN_HOURS = 24;
const VALUES = [0, 5, 10, 15, 25, 50, 100, 250];
const ANIMATION_DURATION = 2000; // 2 секунды
const FRAME_RATE = 30; // смен в секунду

// ---------- СОСТОЯНИЕ ----------
let balance = 100;
let lastFreeSpin = null;
let isSpinning = false;
let animationInterval = null;
let glowInterval = null;

// ---------- DOM ----------
const caseDisplay = document.getElementById('caseDisplay');
const balanceEl = document.getElementById('balance');
const resultEl = document.getElementById('result');
const freeBtn = document.getElementById('freeSpinBtn');
const paidBtn = document.getElementById('paidSpinBtn');
const freeTimer = document.getElementById('freeTimer');
const caseContainer = document.querySelector('.case-container');

// ---------- ЗАГРУЗКА ----------
const saved = localStorage.getItem(`standoff_case_${user.id}`);
if (saved) {
    try {
        const data = JSON.parse(saved);
        balance = data.balance || 100;
        lastFreeSpin = data.lastFree || null;
    } catch(e) {}
}
balanceEl.innerText = balance;

// ---------- СОХРАНЕНИЕ ----------
function saveGame() {
    localStorage.setItem(`standoff_case_${user.id}`, JSON.stringify({
        balance: balance,
        lastFree: lastFreeSpin
    }));
}

// ---------- ВЫБОР ВЫИГРЫША ПО ШАНСАМ ----------
function getWinValue(isPaid) {
    const table = isPaid ? PAID_CHANCES : FREE_CHANCES;
    const rand = Math.random() * 100;
    let cumulative = 0;
    
    for (let item of table) {
        cumulative += item.prob;
        if (rand < cumulative) {
            return item.value;
        }
    }
    return 0;
}

// ---------- ПЛАВНАЯ АНИМАЦИЯ ----------
function startSmoothAnimation() {
    return new Promise((resolve) => {
        const startTime = performance.now();
        const finalValue = getWinValue(isPaid);
        
        // Эффект свечения
        caseContainer.classList.add('spinning');
        
        animationInterval = setInterval(() => {
            const elapsed = performance.now() - startTime;
            
            if (elapsed < ANIMATION_DURATION) {
                // Плавно меняем числа
                const randomValue = VALUES[Math.floor(Math.random() * VALUES.length)];
                caseDisplay.innerText = randomValue;
                
                // Плавное изменение яркости
                const progress = elapsed / ANIMATION_DURATION;
                const opacity = 0.5 + Math.sin(progress * Math.PI * 8) * 0.5;
                caseDisplay.style.opacity = opacity;
            } else {
                // Завершение анимации
                clearInterval(animationInterval);
                caseContainer.classList.remove('spinning');
                caseDisplay.style.opacity = 1;
                resolve(finalValue);
            }
        }, 1000 / FRAME_RATE);
    });
}

// ---------- ОСНОВНАЯ КРУТКА ----------
async function handleSpin(isPaid) {
    if (isSpinning) {
        tg?.showAlert?.('❌ Уже крутится!');
        return;
    }

    // Проверка бесплатной крутки
    if (!isPaid && lastFreeSpin) {
        const hoursPassed = (Date.now() - lastFreeSpin) / (1000 * 60 * 60);
        if (hoursPassed < COOLDOWN_HOURS) {
            const left = COOLDOWN_HOURS - hoursPassed;
            const h = Math.floor(left);
            const m = Math.floor((left - h) * 60);
            tg?.showAlert?.(`❌ Бесплатно через ${h}ч ${m}м`);
            return;
        }
    }

    // Проверка платной крутки
    if (isPaid && balance < SPIN_COST) {
        tg?.showAlert?.('❌ Недостаточно G!');
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
        balanceEl.innerText = balance;
    }

    // Запускаем анимацию
    const winValue = await startSmoothAnimation();
    
    // Показываем финальное значение
    caseDisplay.innerText = winValue;
    
    // Начисляем выигрыш
    balance += winValue;
    balanceEl.innerText = balance;

    // Обновляем время бесплатной крутки
    if (!isPaid) {
        lastFreeSpin = Date.now();
    }

    saveGame();

    // Показываем результат
    if (winValue >= 100) {
        resultEl.innerText = `🔥 +${winValue}G 🔥`;
        caseDisplay.classList.add('jackpot');
        setTimeout(() => caseDisplay.classList.remove('jackpot'), 1500);
        tg?.HapticFeedback?.impactOccurred('heavy');
    } else if (winValue >= 50) {
        resultEl.innerText = `⚡ +${winValue}G`;
        tg?.HapticFeedback?.impactOccurred('medium');
    } else if (winValue > 0) {
        resultEl.innerText = `🎉 +${winValue}G`;
        tg?.HapticFeedback?.impactOccurred('light');
    } else {
        resultEl.innerText = `💔 0G`;
        tg?.HapticFeedback?.notificationOccurred('error');
    }

    // Разблокировка кнопок
    isSpinning = false;
    updateFreeTimer();
    paidBtn.disabled = balance < SPIN_COST;
}

// ---------- ТАЙМЕР ----------
function updateFreeTimer() {
    if (!lastFreeSpin) {
        freeBtn.disabled = false;
        freeTimer.innerText = '24ч';
        return;
    }
    
    const hoursPassed = (Date.now() - lastFreeSpin) / (1000 * 60 * 60);
    
    if (hoursPassed >= COOLDOWN_HOURS) {
        freeBtn.disabled = false;
        freeTimer.innerText = '24ч';
    } else {
        freeBtn.disabled = true;
        const left = COOLDOWN_HOURS - hoursPassed;
        const h = Math.floor(left);
        const m = Math.floor((left - h) * 60);
        freeTimer.innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
    }
}

// ---------- ПОДПИСКИ ----------
freeBtn.addEventListener('click', () => handleSpin(false));
paidBtn.addEventListener('click', () => handleSpin(true));

// ---------- ИНИЦИАЛИЗАЦИЯ ----------
updateFreeTimer();
paidBtn.disabled = balance < SPIN_COST;
caseDisplay.innerText = '0';

// Автосохранение
setInterval(saveGame, 30000);
setInterval(updateFreeTimer, 60000);

// Сохранение при выходе
window.addEventListener('beforeunload', () => {
    if (animationInterval) clearInterval(animationInterval);
    saveGame();
});