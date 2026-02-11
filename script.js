// ============================================================
// STANDOFF 2 · КОЛЕСО ФОРТУНЫ — ФИНАЛЬНАЯ РАБОЧАЯ ВЕРСИЯ
// Основа — CSS-подход из thecode.media, полностью переработанный
// под твои требования: шансы, баланс, Telegram, сохранение.
// Стрелка ВСЕГДА останавливается на ЦЕНТРЕ выигранного сектора.
// ============================================================

// ---------- Telegram WebApp ----------
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

// ---------- НАСТРОЙКИ СЕКТОРОВ (8 шт, точные углы центра) ----------
const SECTORS = [
    { value: 250, color: 'hsl(0, 60%, 40%)',  centerDeg: 22.5 },   // тёмно-красный
    { value: 100, color: 'hsl(0, 70%, 55%)',  centerDeg: 67.5 },   // розовый
    { value: 50,  color: 'hsl(270, 50%, 50%)', centerDeg: 112.5 }, // фиолетовый
    { value: 25,  color: 'hsl(210, 70%, 55%)', centerDeg: 157.5 }, // синий
    { value: 15,  color: 'hsl(145, 60%, 45%)', centerDeg: 202.5 }, // зелёный
    { value: 10,  color: 'hsl(50, 80%, 55%)',  centerDeg: 247.5 }, // жёлтый
    { value: 5,   color: 'hsl(30, 70%, 55%)',  centerDeg: 292.5 }, // оранжевый
    { value: 0,   color: 'hsl(0, 65%, 50%)',   centerDeg: 337.5 }  // красный
];

// ---------- ШАНСЫ (ТОЧНО ПО ТВОИМ ТАБЛИЦАМ) ----------
const FREE_DISTRIBUTION = [
    { value: 250, chance: 0.01 },
    { value: 100, chance: 0.1 },
    { value: 50,  chance: 0.7 },
    { value: 25,  chance: 1.8 },
    { value: 15,  chance: 4 },
    { value: 10,  chance: 7.5 },
    { value: 5,   chance: 15 },
    { value: 0,   chance: 70.89 }
];

const PAID_DISTRIBUTION = [
    { value: 250, chance: 0.1 },
    { value: 100, chance: 0.5 },
    { value: 50,  chance: 2 },
    { value: 25,  chance: 5 },
    { value: 15,  chance: 10 },
    { value: 10,  chance: 15 },
    { value: 5,   chance: 17.4 },
    { value: 0,   chance: 50 }
];

// ---------- ИГРОВЫЕ ПЕРЕМЕННЫЕ ----------
let balance = 100;
let lastFreeTime = null;
let isSpinning = false;
let currentRotation = 25; // начальное смещение (CSS: --rotate, по умолч. 25)
let animFrame = null;

// ---------- DOM ЭЛЕМЕНТЫ ----------
const spinnerEl = document.getElementById('spinner');
const balanceSpan = document.getElementById('balanceValue');
const resultEl = document.getElementById('resultMessage');
const freeBtn = document.getElementById('freeSpinBtn');
const paidBtn = document.getElementById('paidSpinBtn');
const timerSpan = document.getElementById('freeTimer');
const usernameEl = document.getElementById('username');
const avatarEl = document.getElementById('avatar');
const chancesList = document.getElementById('chancesList');
const tabFree = document.getElementById('tabFree');
const tabPaid = document.getElementById('tabPaid');

// ---------- УСТАНОВКА ПРОФИЛЯ ----------
usernameEl.textContent = user.first_name + (user.last_name ? ' ' + user.last_name : '');
avatarEl.src = user.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name)}&background=ffd700&color=000&size=128`;

// ---------- ЗАГРУЗКА ИЗ LOCALSTORAGE ----------
function loadGame() {
    try {
        const saved = localStorage.getItem(`standoff2_final_${user.id}`);
        if (saved) {
            const data = JSON.parse(saved);
            balance = data.balance ?? 100;
            lastFreeTime = data.lastFree ?? null;
        }
    } catch(e) {}
    balanceSpan.textContent = balance;
}
loadGame();

// ---------- СОХРАНЕНИЕ ----------
function saveGame() {
    localStorage.setItem(`standoff2_final_${user.id}`, JSON.stringify({
        balance: balance,
        lastFree: lastFreeTime
    }));
}

// ---------- ОТРИСОВКА СЕКТОРОВ И ТЕКСТА ----------
function buildWheel() {
    // 1. Градиентный фон (цветные сектора)
    const gradientColors = SECTORS.map((s, i) => {
        const percent = ((i + 1) * 100) / SECTORS.length;
        return `${s.color} 0 ${percent}%`;
    }).reverse().join(', ');
    spinnerEl.style.background = `conic-gradient(from -90deg, ${gradientColors})`;

    // 2. Текстовые метки
    spinnerEl.innerHTML = ''; // очистка
    SECTORS.forEach((sector, index) => {
        const rotation = (index * (360 / SECTORS.length) * -1) - (180 / SECTORS.length);
        const li = document.createElement('li');
        li.className = 'prize';
        li.style.setProperty('--rotate', `${rotation}deg`);
        li.innerHTML = `<span class="text">${sector.value}</span>`;
        spinnerEl.appendChild(li);
    });
}
buildWheel();

// ---------- ВЫБОР ВЫИГРЫША (ЧЕСТНО, ДО ВРАЩЕНИЯ) ----------
function getWinValue(isPaid) {
    const table = isPaid ? PAID_DISTRIBUTION : FREE_DISTRIBUTION;
    const rand = Math.random() * 100;
    let cumulative = 0;
    for (let item of table) {
        cumulative += item.chance;
        if (rand < cumulative) return item.value;
    }
    return 0;
}

// ---------- ВРАЩЕНИЕ К ЦЕНТРУ ВЫИГРЫШНОГО СЕКТОРА ----------
function spinToWin(winValue) {
    return new Promise((resolve) => {
        if (isSpinning) return resolve();
        isSpinning = true;

        // находим сектор с нужным значением
        const sector = SECTORS.find(s => s.value === winValue);
        if (!sector) {
            isSpinning = false;
            return resolve();
        }

        // целевой угол: чтобы стрелка (которая наверху) указывала на центр сектора
        // стрелка всегда на 12 часах, поэтому нужно, чтобы rotate = centerDeg - начальное смещение
        const targetRotation = sector.centerDeg - 25; // 25 — базовый rotate из CSS
        // добавляем 8 полных оборотов
        const spins = 8;
        const finalRotation = currentRotation + (spins * 360) + 
            ((targetRotation - (currentRotation % 360) + 360) % 360);

        const startTime = performance.now();
        const duration = 2800;

        function animate(time) {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            currentRotation = currentRotation + (finalRotation - currentRotation) * easeOut;
            spinnerEl.style.setProperty('--rotate', currentRotation);

            if (progress < 1) {
                animFrame = requestAnimationFrame(animate);
            } else {
                currentRotation = finalRotation % 360;
                spinnerEl.style.setProperty('--rotate', currentRotation);
                isSpinning = false;
                resolve();
            }
        }
        animFrame = requestAnimationFrame(animate);
    });
}

// ---------- ОБРАБОТКА КРУТКИ ----------
async function handleSpin(isPaid) {
    if (isSpinning) {
        alert('Колесо уже крутится!');
        return;
    }

    // ----- бесплатная крутка -----
    if (!isPaid) {
        if (lastFreeTime) {
            const hoursPassed = (Date.now() - lastFreeTime) / (1000 * 60 * 60);
            if (hoursPassed < 24) {
                const left = 24 - hoursPassed;
                const h = Math.floor(left);
                const m = Math.floor((left - h) * 60);
                alert(`❌ Бесплатная крутка через ${h}ч ${m}м`);
                return;
            }
        }
    }

    // ----- платная крутка -----
    if (isPaid && balance < 10) {
        alert('❌ Недостаточно G!');
        return;
    }

    // блокируем кнопки
    freeBtn.disabled = true;
    paidBtn.disabled = true;

    // списываем плату
    if (isPaid) {
        balance -= 10;
        balanceSpan.textContent = balance;
    }

    // ВЫБОР ВЫИГРЫША (главное — до вращения!)
    const win = getWinValue(isPaid);
    resultEl.textContent = '🎰 КРУТИМ...';

    // вращение
    await spinToWin(win);

    // начисляем выигрыш
    balance += win;
    balanceSpan.textContent = balance;

    // обновляем время бесплатной крутки
    if (!isPaid) {
        lastFreeTime = Date.now();
    }

    saveGame();

    // ----- АНИМАЦИЯ И СООБЩЕНИЕ -----
    if (win >= 100) {
        resultEl.textContent = `🔥 ДЖЕКПОТ! +${win}G 🔥`;
        resultEl.classList.add('jackpot-animation');
        setTimeout(() => resultEl.classList.remove('jackpot-animation'), 1500);
        tg?.HapticFeedback?.impactOccurred('heavy');
    } else if (win >= 50) {
        resultEl.textContent = `⚡ +${win}G ⚡`;
        tg?.HapticFeedback?.impactOccurred('medium');
    } else if (win > 0) {
        resultEl.textContent = `🎉 +${win}G`;
        tg?.HapticFeedback?.impactOccurred('light');
    } else {
        resultEl.textContent = `💔 0G...`;
        tg?.HapticFeedback?.notificationOccurred('error');
    }

    // обновляем таймер и разблокируем кнопки
    updateTimer();
    paidBtn.disabled = balance < 10;
    if (!isPaid) freeBtn.disabled = true; // таймер сам включит через 24ч
}

// ---------- ТАЙМЕР БЕСПЛАТНОЙ КРУТКИ ----------
function updateTimer() {
    if (!lastFreeTime) {
        freeBtn.disabled = false;
        timerSpan.textContent = 'Готово';
        return;
    }
    const hours = (Date.now() - lastFreeTime) / (1000 * 60 * 60);
    if (hours >= 24) {
        freeBtn.disabled = false;
        timerSpan.textContent = 'Готово';
    } else {
        freeBtn.disabled = true;
        const left = 24 - hours;
        const h = Math.floor(left);
        const m = Math.floor((left - h) * 60);
        timerSpan.textContent = `${h}ч ${m}м`;
    }
}

// ---------- ОТОБРАЖЕНИЕ ШАНСОВ ----------
function displayChances(isPaid) {
    const table = isPaid ? PAID_DISTRIBUTION : FREE_DISTRIBUTION;
    let html = '';
    for (let item of table) {
        let cls = 'chance-item';
        if (item.value === 250) cls += ' jackpot';
        if (item.value === 100) cls += ' highlight';
        html += `<div class="${cls}"><span>${item.value} G</span><span>${item.chance}%</span></div>`;
    }
    chancesList.innerHTML = html;
}

// ---------- ПЕРЕКЛЮЧЕНИЕ ТАБОВ ----------
tabFree.addEventListener('click', () => {
    tabFree.classList.add('active');
    tabPaid.classList.remove('active');
    displayChances(false);
});
tabPaid.addEventListener('click', () => {
    tabPaid.classList.add('active');
    tabFree.classList.remove('active');
    displayChances(true);
});

// ---------- ПОДПИСКА НА КНОПКИ ----------
freeBtn.addEventListener('click', () => handleSpin(false));
paidBtn.addEventListener('click', () => handleSpin(true));

// ---------- ИНИЦИАЛИЗАЦИЯ ----------
displayChances(false);
updateTimer();
paidBtn.disabled = balance < 10;

// ---------- АВТОСОХРАНЕНИЕ ----------
setInterval(saveGame, 30000);
setInterval(updateTimer, 30000);

// ---------- СОХРАНЕНИЕ ПРИ ВЫХОДЕ ----------
window.addEventListener('beforeunload', () => {
    if (animFrame) cancelAnimationFrame(animFrame);
    saveGame();
});