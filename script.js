// ========================================
//  STANDOFF 2 · КЕЙС-РУЛЕТКА
//  СЛУЧАЙНЫЙ ВЫБОР С АНИМАЦИЕЙ ПЕРЕБОРА
// ========================================

// Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
}

// ---------- ДАННЫЕ ПОЛЬЗОВАТЕЛЯ ----------
const user = tg?.initDataUnsafe?.user || {
    first_name: 'Игрок',
    id: Date.now()
};

document.getElementById('username').innerText = user.first_name + (user.last_name ? ' ' + user.last_name : '');
document.getElementById('avatar').src = user.photo_url || 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name)}&background=ffd700&color=000&size=128`;

// ---------- НАСТРОЙКИ ----------
const VALUES = [0, 5, 10, 15, 25, 50, 100, 250];

const FREE_CHANCES = {
    values: [0, 5, 10, 15, 25, 50, 100, 250],
    probs: [70.89, 15, 7.5, 4, 1.8, 0.7, 0.1, 0.01]
};

const PAID_CHANCES = {
    values: [0, 5, 10, 15, 25, 50, 100, 250],
    probs: [50, 17.4, 15, 10, 5, 2, 0.5, 0.1]
};

const SPIN_COST = 10;
const COOLDOWN_HOURS = 24;

// ---------- СОСТОЯНИЕ ----------
let balance = 100;
let lastFreeSpin = null;
let isSpinning = false;
let spinInterval = null;

// ---------- DOM ЭЛЕМЕНТЫ ----------
const caseDisplay = document.getElementById('caseDisplay');
const balanceEl = document.getElementById('balance');
const resultEl = document.getElementById('result');
const freeBtn = document.getElementById('freeSpinBtn');
const paidBtn = document.getElementById('paidSpinBtn');
const freeTimer = document.getElementById('freeTimer');
const chancesList = document.getElementById('chancesList');
const runningValues = document.getElementById('runningValues');

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
    
    for (let i = 0; i < table.probs.length; i++) {
        cumulative += table.probs[i];
        if (rand < cumulative) {
            console.log(`🎲 Выигрыш: ${table.values[i]}G (шанс ${table.probs[i]}%)`);
            return table.values[i];
        }
    }
    return 0;
}

// ---------- АНИМАЦИЯ ПЕРЕБОРА ----------
function startRollingAnimation() {
    let count = 0;
    const maxRolls = 30; // Количество смен значений перед остановкой
    
    return new Promise((resolve) => {
        spinInterval = setInterval(() => {
            // Показываем случайные значения
            const randomIndex = Math.floor(Math.random() * VALUES.length);
            caseDisplay.innerText = VALUES[randomIndex];
            
            // Создаём бегущие точки для эффекта
            let dots = '';
            for (let i = 0; i < 10; i++) {
                dots += Math.random() > 0.5 ? '●' : '○';
            }
            runningValues.innerText = dots;
            
            count++;
            if (count >= maxRolls) {
                clearInterval(spinInterval);
                runningValues.innerText = '';
                resolve();
            }
        }, 80); // Смена каждые 80мс
    });
}

// ---------- ОСНОВНАЯ КРУТКА ----------
async function handleSpin(isPaid) {
    if (isSpinning) {
        tg?.showAlert?.('❌ Уже крутится!');
        return;
    }

    // Проверка бесплатной крутки
    if (!isPaid) {
        if (lastFreeSpin) {
            const hoursPassed = (Date.now() - lastFreeSpin) / (1000 * 60 * 60);
            if (hoursPassed < COOLDOWN_HOURS) {
                const left = COOLDOWN_HOURS - hoursPassed;
                const h = Math.floor(left);
                const m = Math.floor((left - h) * 60);
                tg?.showAlert?.(`❌ Бесплатно через ${h}ч ${m}м`);
                return;
            }
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
    resultEl.innerText = '🎰 КРУТИМ...';

    // Списываем плату
    if (isPaid) {
        balance -= SPIN_COST;
        balanceEl.innerText = balance;
    }

    // Запускаем анимацию
    await startRollingAnimation();

    // Определяем выигрыш ПОСЛЕ анимации
    const winValue = getWinValue(isPaid);
    
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
        resultEl.innerText = `🔥 ДЖЕКПОТ! +${winValue}G 🔥`;
        caseDisplay.classList.add('flash');
        setTimeout(() => caseDisplay.classList.remove('flash'), 1500);
        tg?.HapticFeedback?.impactOccurred('heavy');
    } else if (winValue >= 50) {
        resultEl.innerText = `⚡ +${winValue}G ⚡`;
        tg?.HapticFeedback?.impactOccurred('medium');
    } else if (winValue > 0) {
        resultEl.innerText = `🎉 +${winValue}G`;
        tg?.HapticFeedback?.impactOccurred('light');
    } else {
        resultEl.innerText = `💔 0G...`;
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
        freeTimer.innerText = '00:00';
        return;
    }
    
    const hoursPassed = (Date.now() - lastFreeSpin) / (1000 * 60 * 60);
    
    if (hoursPassed >= COOLDOWN_HOURS) {
        freeBtn.disabled = false;
        freeTimer.innerText = '00:00';
    } else {
        freeBtn.disabled = true;
        const left = COOLDOWN_HOURS - hoursPassed;
        const h = Math.floor(left);
        const m = Math.floor((left - h) * 60);
        freeTimer.innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
    }
}

// ---------- ОТОБРАЖЕНИЕ ШАНСОВ ----------
function displayChances(isPaid) {
    const table = isPaid ? PAID_CHANCES : FREE_CHANCES;
    let html = '';
    
    for (let i = 0; i < table.values.length; i++) {
        let className = 'chance-item';
        if (table.values[i] === 250) className += ' jackpot';
        if (table.values[i] === 100) className += ' highlight';
        
        html += `<div class="${className}">
            <span>${table.values[i]} G</span>
            <span>${table.probs[i]}%</span>
        </div>`;
    }
    chancesList.innerHTML = html;
}

// ---------- ПОДПИСКИ ----------
freeBtn.addEventListener('click', () => handleSpin(false));
paidBtn.addEventListener('click', () => handleSpin(true));

document.getElementById('tabFree').addEventListener('click', () => {
    document.getElementById('tabFree').classList.add('active');
    document.getElementById('tabPaid').classList.remove('active');
    displayChances(false);
});
document.getElementById('tabPaid').addEventListener('click', () => {
    document.getElementById('tabPaid').classList.add('active');
    document.getElementById('tabFree').classList.remove('active');
    displayChances(true);
});

// ---------- ИНИЦИАЛИЗАЦИЯ ----------
displayChances(false);
updateFreeTimer();
paidBtn.disabled = balance < SPIN_COST;
caseDisplay.innerText = '🎲';

// Автосохранение
setInterval(saveGame, 30000);
setInterval(updateFreeTimer, 60000);

// Сохранение при выходе
window.addEventListener('beforeunload', () => {
    if (spinInterval) clearInterval(spinInterval);
    saveGame();
});