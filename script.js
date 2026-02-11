// ============================================================
// STANDOFF 2 РУЛЕТКА · ФИНАЛЬНАЯ РАБОЧАЯ ВЕРСИЯ
// Стрелка всегда останавливается на ЦЕНТРЕ выигранного сектора
// ============================================================

// ---------- Telegram WebApp ----------
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
}

// ---------- ЖЁСТКО ФИКСИРОВАННЫЕ ДАННЫЕ ----------
const SECTORS = [
    { value: 250, color: '#c0392b', centerDeg: 22.5 },   // 0° + 22.5
    { value: 100, color: '#e84342', centerDeg: 67.5 },   // 45 + 22.5
    { value: 50,  color: '#9b59b6', centerDeg: 112.5 },  // 90 + 22.5
    { value: 25,  color: '#3498db', centerDeg: 157.5 },  // 135 + 22.5
    { value: 15,  color: '#2ecc71', centerDeg: 202.5 },  // 180 + 22.5
    { value: 10,  color: '#f1c40f', centerDeg: 247.5 },  // 225 + 22.5
    { value: 5,   color: '#e67e22', centerDeg: 292.5 },  // 270 + 22.5
    { value: 0,   color: '#e74c3c', centerDeg: 337.5 }   // 315 + 22.5
];

// Бесплатные шансы (сумма = 100%)
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

// Платные шансы (10 голды)
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
let lastFreeTime = null;              // timestamp последней бесплатной крутки
let isSpinning = false;
let currentAngleRad = 0;             // текущий угол в радианах
let animFrame = null;

// ---------- DOM ЭЛЕМЕНТЫ ----------
const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');
const balanceSpan = document.getElementById('balanceValue');
const resultDiv = document.getElementById('resultDisplay');
const freeBtn = document.getElementById('freeButton');
const paidBtn = document.getElementById('paidButton');
const timerSpan = document.getElementById('timerDisplay');
const usernameEl = document.getElementById('username');
const avatarEl = document.getElementById('avatar');
const chancesList = document.getElementById('chancesList');
const tabFree = document.getElementById('tabFree');
const tabPaid = document.getElementById('tabPaid');

// ---------- ЗАГРУЗКА ДАННЫХ ПОЛЬЗОВАТЕЛЯ (Telegram / Гость) ----------
const user = tg?.initDataUnsafe?.user || {
    first_name: 'Игрок',
    id: Date.now()
};
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
    } catch (e) {}
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

// ---------- ОТРИСОВКА КОЛЕСА ----------
function drawWheel(angleRad = 0) {
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const radius = Math.min(w, h) / 2 - 12;
    const sectorRad = (Math.PI * 2) / SECTORS.length;

    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < SECTORS.length; i++) {
        const start = i * sectorRad + angleRad;
        const end = start + sectorRad;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, start, end);
        ctx.closePath();
        ctx.fillStyle = SECTORS[i].color;
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Текст
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(start + sectorRad / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 6;
        ctx.fillText(SECTORS[i].value, radius * 0.65, 0);
        ctx.restore();
    }

    // Центральный круг
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffd700';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
}

// ---------- ВЫБОР ВЫИГРЫША ПО ШАНСАМ ----------
function pickWinValue(isPaid) {
    const table = isPaid ? PAID_DISTRIBUTION : FREE_DISTRIBUTION;
    const rand = Math.random() * 100;
    let cumulative = 0;
    for (let i = 0; i < table.length; i++) {
        cumulative += table[i].chance;
        if (rand < cumulative) {
            return table[i].value;
        }
    }
    return 0;
}

// ---------- ВРАЩЕНИЕ К ЦЕНТРУ ВЫИГРЫШНОГО СЕКТОРА ----------
function spinToWin(winValue) {
    return new Promise((resolve) => {
        if (isSpinning) return resolve();
        isSpinning = true;

        const sector = SECTORS.find(s => s.value === winValue);
        if (!sector) {
            isSpinning = false;
            return resolve();
        }

        const targetDeg = sector.centerDeg;
        const targetRad = targetDeg * Math.PI / 180;
        const startRad = currentAngleRad;
        const spins = 8; // количество полных оборотов
        const fullTurns = spins * 2 * Math.PI;
        let delta = fullTurns + targetRad - (startRad % (2 * Math.PI));
        const finalRad = startRad + delta;

        const startTime = performance.now();
        const duration = 2800;

        function animate(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            currentAngleRad = startRad + (finalRad - startRad) * easeOut;
            drawWheel(currentAngleRad);

            if (progress < 1) {
                animFrame = requestAnimationFrame(animate);
            } else {
                currentAngleRad = finalRad % (2 * Math.PI);
                drawWheel(currentAngleRad);
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

    // Проверка бесплатной крутки
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

    // Проверка платной крутки
    if (isPaid && balance < 10) {
        alert('❌ Недостаточно G!');
        return;
    }

    // Блокировка кнопок
    freeBtn.disabled = true;
    paidBtn.disabled = true;

    // Списание платы
    if (isPaid) {
        balance -= 10;
        balanceSpan.textContent = balance;
    }

    // ВЫБОР ВЫИГРЫША (до вращения!)
    const win = pickWinValue(isPaid);
    resultDiv.textContent = '🎰 КРУТИМ...';

    // ВРАЩЕНИЕ
    await spinToWin(win);

    // НАЧИСЛЕНИЕ
    balance += win;
    balanceSpan.textContent = balance;

    // Обновление времени бесплатной крутки
    if (!isPaid) {
        lastFreeTime = Date.now();
    }

    saveGame();

    // ОТОБРАЖЕНИЕ РЕЗУЛЬТАТА
    if (win >= 100) {
        resultDiv.textContent = `🔥 ДЖЕКПОТ! +${win}G 🔥`;
        resultDiv.classList.add('jackpot-animation');
        setTimeout(() => resultDiv.classList.remove('jackpot-animation'), 1500);
        tg?.HapticFeedback?.impactOccurred('heavy');
    } else if (win >= 50) {
        resultDiv.textContent = `⚡ +${win}G ⚡`;
        tg?.HapticFeedback?.impactOccurred('medium');
    } else if (win > 0) {
        resultDiv.textContent = `🎉 +${win}G`;
        tg?.HapticFeedback?.impactOccurred('light');
    } else {
        resultDiv.textContent = `💔 0G...`;
        tg?.HapticFeedback?.notificationOccurred('error');
    }

    // Обновление таймера и разблокировка кнопок
    updateTimer();
    paidBtn.disabled = balance < 10;
    if (!isPaid) {
        freeBtn.disabled = true; // таймер сам включит через 24ч
    }
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
    for (let i = 0; i < table.length; i++) {
        let className = 'chance-item';
        if (table[i].value === 250) className += ' jackpot';
        if (table[i].value === 100) className += ' highlight';
        html += `<div class="${className}">
            <span>${table[i].value} G</span>
            <span>${table[i].chance}%</span>
        </div>`;
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
drawWheel(currentAngleRad);
updateTimer();
displayChances(false);
paidBtn.disabled = balance < 10;

// ---------- АВТОСОХРАНЕНИЕ ----------
setInterval(saveGame, 30000);
setInterval(updateTimer, 30000);

// ---------- СОХРАНЕНИЕ ПРИ ВЫХОДЕ ----------
window.addEventListener('beforeunload', () => {
    if (animFrame) cancelAnimationFrame(animFrame);
    saveGame();
});