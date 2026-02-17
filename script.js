// ========================================
//  STANDOFF 2 · КЕЙС-РУЛЕТКА
//  ШАНСЫ УМЕНЬШЕНЫ ПО ТВОЕЙ ПРОСЬБЕ
// ========================================

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

// ---------- ШАНСЫ (ПЕРЕСЧИТАНЫ ПО ТВОЕЙ ПРОСЬБЕ) ----------
const FREE_CHANCES = [
    { value: 0, prob: 85.4745 },  // 85.47% (нулёвка)
    { value: 5, prob: 7.5 },       // 7.5%
    { value: 10, prob: 3.75 },     // 3.75%
    { value: 15, prob: 2 },        // 2%
    { value: 25, prob: 0.9 },      // 0.9%
    { value: 50, prob: 0.35 },     // 0.35%
    { value: 100, prob: 0.025 },   // 0.025%
    { value: 250, prob: 0.0005 }   // 0.0005%
];

const PAID_CHANCES = [
    { value: 0, prob: 64.5745 },   // 64.57% (нулёвка)
    { value: 5, prob: 17.4 },      // 17.4%
    { value: 10, prob: 15 },       // 15%
    { value: 15, prob: 10 },       // 10%
    { value: 25, prob: 5 },        // 5%
    { value: 50, prob: 2 },        // 2%
    { value: 100, prob: 0.125 },   // 0.125% (было 0.5% ÷4)
    { value: 250, prob: 0.005 }    // 0.005% (было 0.1% ÷20)
];

// ---------- НАСТРОЙКИ ----------
const SPIN_COST = 10;
const COOLDOWN_HOURS = 24;
const ALLOWED_VALUES = [0, 5, 10, 15, 25, 50, 100, 250];
const ANIMATION_DURATION = 5000; // 5 секунд
const FRAME_RATE = 60; // 60 кадров в секунду

// ---------- СОСТОЯНИЕ ----------
let balance = 100;
let lastFreeSpin = null;
let isSpinning = false;
let animationInterval = null;
let spinTimeout = null;

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

// ---------- ВЫБОР ВЫИГРЫША ПО НОВЫМ ШАНСАМ ----------
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
    // 70% шанс показать число из списка, 30% - случайное
    if (Math.random() < 0.7) {
        return ALLOWED_VALUES[Math.floor(Math.random() * ALLOWED_VALUES.length)];
    } else {
        return Math.floor(Math.random() * 301);
    }
}

// ---------- ПЛАВНАЯ АНИМАЦИЯ ----------
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

// ---------- ОБНОВЛЕНИЕ ТАЙМЕРА ----------
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
        freeTimer.innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
    }
}

// ---------- ОСНОВНАЯ КРУТКА ----------
async function handleSpin(isPaid) {
    if (isSpinning) {
        tg?.showAlert?.('❌ Уже крутится!');
        return;
    }

    if (!isPaid && lastFreeSpin) {
        const hoursPassed = (Date.now() - lastFreeSpin) / (1000 * 60 * 60);
        if (hoursPassed < COOLDOWN_HOURS) {
            tg?.showAlert?.('❌ Бесплатная крутка ещё не доступна!');
            return;
        }
    }

    if (isPaid && balance < SPIN_COST) {
        tg?.showAlert?.('❌ Недостаточно G!');
        return;
    }

    isSpinning = true;
    freeBtn.disabled = true;
    paidBtn.disabled = true;
    resultEl.innerText = '';

    if (isPaid) {
        balance -= SPIN_COST;
        balanceEl.innerText = balance;
    }

    const winValue = getWinValue(isPaid);
    
    await startSmoothAnimation(winValue);
    
    balance += winValue;
    balanceEl.innerText = balance;

    if (!isPaid) {
        lastFreeSpin = Date.now();
    }

    saveGame();

    if (winValue >= 100) {
        resultEl.innerText = `🔥 ДЖЕКПОТ! +${winValue}G 🔥`;
        caseDisplay.classList.add('jackpot');
        setTimeout(() => caseDisplay.classList.remove('jackpot'), 1500);
        tg?.HapticFeedback?.impactOccurred('heavy');
    } else if (winValue >= 50) {
        resultEl.innerText = `⚡ +${winValue}G ⚡`;
        tg?.HapticFeedback?.impactOccurred('medium');
    } else if (winValue > 0) {
        resultEl.innerText = `🎉 +${winValue}G`;
        tg?.HapticFeedback?.impactOccurred('light');
    } else {
        resultEl.innerText = `💔 0G`;
        tg?.HapticFeedback?.notificationOccurred('error');
    }

    isSpinning = false;
    updateFreeTimer();
    paidBtn.disabled = balance < SPIN_COST;
}

// ---------- ПОДПИСКИ ----------
freeBtn.addEventListener('click', () => handleSpin(false));
paidBtn.addEventListener('click', () => handleSpin(true));

// ---------- ИНИЦИАЛИЗАЦИЯ ----------
updateFreeTimer();
paidBtn.disabled = balance < SPIN_COST;
caseDisplay.innerText = '0';

setInterval(updateFreeTimer, 1000);
setInterval(saveGame, 30000);

window.addEventListener('beforeunload', () => {
    if (animationInterval) clearInterval(animationInterval);
    if (spinTimeout) clearTimeout(spinTimeout);
    saveGame();
});