// ========================================
//  STANDOFF 2 · РУЛЕТКА
//  ВСЁ РАБОТАЕТ ПО УГЛУ ОСТАНОВКИ
// ========================================

// Telegram
const tg = window.Telegram?.WebApp;
if (tg) tg.ready();

// Данные пользователя
const user = tg?.initDataUnsafe?.user || {
    first_name: 'Игрок',
    id: Date.now()
};
document.getElementById('username').innerText = user.first_name;
document.getElementById('avatar').src = user.photo_url || 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name)}&background=ffd700&color=000&size=128`;

// ========== НАСТРОЙКИ ==========
// Сектора: значение и диапазон углов (начало, конец)
const SECTORS = [
    { value: 250, start: 0, end: 45 },
    { value: 100, start: 45, end: 90 },
    { value: 50,  start: 90, end: 135 },
    { value: 25,  start: 135, end: 180 },
    { value: 15,  start: 180, end: 225 },
    { value: 10,  start: 225, end: 270 },
    { value: 5,   start: 270, end: 315 },
    { value: 0,   start: 315, end: 360 }
];

// Шансы РАВНЫЕ — каждый сектор 12.5%
// (можно легко изменить, поделив круг по-другому)
const SPIN_COST = 10;
const COOLDOWN = 24 * 60 * 60 * 1000; // 24 часа в мс

// ========== ПЕРЕМЕННЫЕ ==========
let balance = 100;
let lastFreeTime = null;
let isSpinning = false;
let spinTimeout = null;
let currentRotate = 0; // текущий угол поворота колеса (deg)

// DOM элементы
const wheel = document.getElementById('wheel');
const balanceSpan = document.getElementById('balance');
const resultEl = document.getElementById('result');
const freeBtn = document.getElementById('freeBtn');
const paidBtn = document.getElementById('paidBtn');
const timerSpan = document.getElementById('freeTimer');

// ========== ЗАГРУЗКА ИЗ STORAGE ==========
const storageKey = `roulette_${user.id}`;
const saved = localStorage.getItem(storageKey);
if (saved) {
    try {
        const data = JSON.parse(saved);
        balance = data.balance || 100;
        lastFreeTime = data.lastFree || null;
        currentRotate = data.currentRotate || 0;
        wheel.style.transform = `rotate(${currentRotate}deg)`;
    } catch (e) {}
}
balanceSpan.innerText = balance;

// ========== СОХРАНЕНИЕ ==========
function saveGame() {
    localStorage.setItem(storageKey, JSON.stringify({
        balance,
        lastFree: lastFreeTime,
        currentRotate
    }));
}

// ========== ОПРЕДЕЛЕНИЕ ВЫИГРЫША ПО УГЛУ ==========
function getWinByAngle(angle) {
    let norm = ((angle % 360) + 360) % 360;
    for (let s of SECTORS) {
        if (norm >= s.start && norm < s.end) {
            return s.value;
        }
    }
    return 0; // fallback
}

// ========== ВРАЩЕНИЕ ==========
function spinWheel(targetAngle) {
    return new Promise((resolve) => {
        if (isSpinning) return resolve();
        isSpinning = true;

        // Добавляем 5-8 полных оборотов для красоты
        const spins = 6;
        const start = currentRotate;
        const final = start + (spins * 360) + targetAngle - (start % 360);

        wheel.style.transition = 'transform 3s cubic-bezier(0.25, 0.1, 0.15, 1)';
        wheel.style.transform = `rotate(${final}deg)`;

        if (spinTimeout) clearTimeout(spinTimeout);
        spinTimeout = setTimeout(() => {
            // После остановки фиксируем угол
            currentRotate = final % 360;
            wheel.style.transition = 'none';
            wheel.style.transform = `rotate(${currentRotate}deg)`;
            isSpinning = false;
            resolve();
        }, 3200); // 3.2 сек (чуть больше, чем transition)
    });
}

// ========== ОБРАБОТКА КРУТКИ ==========
async function handleSpin(isPaid) {
    if (isSpinning) {
        alert('Колесо крутится!');
        return;
    }

    // Бесплатная крутка
    if (!isPaid) {
        if (lastFreeTime && Date.now() - lastFreeTime < COOLDOWN) {
            const left = COOLDOWN - (Date.now() - lastFreeTime);
            const hours = Math.floor(left / 3600000);
            const mins = Math.floor((left % 3600000) / 60000);
            alert(`❌ Бесплатно через ${hours}ч ${mins}м`);
            return;
        }
    }

    // Платная крутка
    if (isPaid && balance < 10) {
        alert('❌ Недостаточно G!');
        return;
    }

    // Блокируем кнопки
    freeBtn.disabled = true;
    paidBtn.disabled = true;

    // Списываем плату
    if (isPaid) {
        balance -= 10;
        balanceSpan.innerText = balance;
    }

    // Генерируем случайный угол остановки (0-360)
    const targetAngle = Math.random() * 360;

    resultEl.innerText = '🎰 КРУТИМ...';

    // Вращаем
    await spinWheel(targetAngle);

    // Определяем выигрыш по финальному углу
    const winAmount = getWinByAngle(currentRotate);
    
    // Начисляем
    balance += winAmount;
    balanceSpan.innerText = balance;

    // Обновляем время бесплатной крутки
    if (!isPaid) {
        lastFreeTime = Date.now();
    }

    saveGame();

    // Отображаем результат
    if (winAmount >= 100) {
        resultEl.innerText = `🔥 ДЖЕКПОТ! +${winAmount}G 🔥`;
        resultEl.classList.add('jackpot');
        setTimeout(() => resultEl.classList.remove('jackpot'), 1500);
        tg?.HapticFeedback?.impactOccurred('heavy');
    } else if (winAmount >= 50) {
        resultEl.innerText = `⚡ +${winAmount}G ⚡`;
        tg?.HapticFeedback?.impactOccurred('medium');
    } else if (winAmount > 0) {
        resultEl.innerText = `🎉 +${winAmount}G`;
        tg?.HapticFeedback?.impactOccurred('light');
    } else {
        resultEl.innerText = `💔 0G...`;
        tg?.HapticFeedback?.notificationOccurred('error');
    }

    // Разблокировка кнопок
    paidBtn.disabled = balance < 10;
    updateFreeTimer();
}

// ========== ТАЙМЕР БЕСПЛАТНОЙ КРУТКИ ==========
function updateFreeTimer() {
    if (!lastFreeTime) {
        freeBtn.disabled = false;
        timerSpan.innerText = 'Готово';
        return;
    }
    const left = COOLDOWN - (Date.now() - lastFreeTime);
    if (left <= 0) {
        freeBtn.disabled = false;
        timerSpan.innerText = 'Готово';
    } else {
        freeBtn.disabled = true;
        const hours = Math.floor(left / 3600000);
        const mins = Math.floor((left % 3600000) / 60000);
        timerSpan.innerText = `${hours}ч ${mins}м`;
    }
}

// ========== ПОДПИСКИ ==========
freeBtn.addEventListener('click', () => handleSpin(false));
paidBtn.addEventListener('click', () => handleSpin(true));

// ========== ИНИЦИАЛИЗАЦИЯ ==========
updateFreeTimer();
paidBtn.disabled = balance < 10;

// Автосохранение и таймер
setInterval(saveGame, 30000);
setInterval(updateFreeTimer, 60000);

// Сохраняем при выходе
window.addEventListener('beforeunload', saveGame);