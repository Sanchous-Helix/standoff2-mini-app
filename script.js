// ============================================================
//  STANDOFF 2 · РУЛЕТКА (ГРАДУСНАЯ МОДЕЛЬ)
//  ВЫИГРЫШ ОПРЕДЕЛЯЕТСЯ ИСКЛЮЧИТЕЛЬНО ПО УГЛУ ОСТАНОВКИ СТРЕЛКИ
// ============================================================

// ---------- Telegram WebApp ----------
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

// ============ 1. ЖЁСТКО ЗАДАННЫЕ СЕКТОРА (УГЛЫ В ГРАДУСАХ) ============
// Сектора расположены ПО ЧАСОВОЙ СТРЕЛКЕ, начиная с верхней точки (0°)
// Каждый сектор занимает 45 градусов.
const SECTORS = [
    { value: 250, color: 'hsl(0, 60%, 40%)',  start: 0,   end: 45   }, // 0-45
    { value: 100, color: 'hsl(0, 70%, 55%)',  start: 45,  end: 90  }, // 45-90
    { value: 50,  color: 'hsl(270, 50%, 50%)', start: 90,  end: 135 }, // 90-135
    { value: 25,  color: 'hsl(210, 70%, 55%)', start: 135, end: 180 }, // 135-180
    { value: 15,  color: 'hsl(145, 60%, 45%)', start: 180, end: 225 }, // 180-225
    { value: 10,  color: 'hsl(50, 80%, 55%)',  start: 225, end: 270 }, // 225-270
    { value: 5,   color: 'hsl(30, 70%, 55%)',  start: 270, end: 315 }, // 270-315
    { value: 0,   color: 'hsl(0, 65%, 50%)',   start: 315, end: 360 }  // 315-360
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
let currentRotate = 0; // текущий угол поворота колеса (--rotate в CSS)
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

// ---------- ПРОФИЛЬ ----------
usernameEl.textContent = user.first_name + (user.last_name ? ' ' + user.last_name : '');
avatarEl.src = user.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name)}&background=ffd700&color=000&size=128`;

// ---------- ЗАГРУЗКА ИЗ LOCALSTORAGE ----------
function loadGame() {
    try {
        const saved = localStorage.getItem(`standoff2_degrees_${user.id}`);
        if (saved) {
            const data = JSON.parse(saved);
            balance = data.balance ?? 100;
            lastFreeTime = data.lastFree ?? null;
            // восстановим угол поворота (чтобы колесо не прыгало при перезагрузке)
            currentRotate = data.currentRotate ?? 0;
            spinnerEl.style.setProperty('--rotate', currentRotate);
        }
    } catch(e) {}
    balanceSpan.textContent = balance;
}
loadGame();

// ---------- СОХРАНЕНИЕ ----------
function saveGame() {
    localStorage.setItem(`standoff2_degrees_${user.id}`, JSON.stringify({
        balance: balance,
        lastFree: lastFreeTime,
        currentRotate: currentRotate
    }));
}

// ============ 2. ПОСТРОЕНИЕ КОЛЕСА (ГРАДИЕНТ + ТЕКСТ) ============
function buildWheel() {
    // Цветные сектора через conic-gradient
    // Начальный угол -90deg — чтобы первый сектор (0-45) оказался сверху
    const gradientParts = SECTORS.map((s, i) => {
        const percentStart = (i * 100) / SECTORS.length;
        const percentEnd = ((i + 1) * 100) / SECTORS.length;
        return `${s.color} ${percentStart}% ${percentEnd}%`;
    }).join(', ');
    spinnerEl.style.background = `conic-gradient(from -90deg, ${gradientParts})`;

    // Текстовые метки (цифры) — каждая повёрнута к центру
    spinnerEl.innerHTML = '';
    SECTORS.forEach((sector, index) => {
        // Угол поворота текста: чтобы он читался по радиусу
        // Формула из оригинальной статьи: (index * 45) * -1 - (180/8)
        const textRotate = (index * 45) * -1 - 22.5;
        const li = document.createElement('li');
        li.className = 'prize';
        li.style.setProperty('--rotate', `${textRotate}deg`);
        li.innerHTML = `<span class="text">${sector.value}</span>`;
        spinnerEl.appendChild(li);
    });
}
buildWheel();

// ============ 3. ВЫБОР СЛУЧАЙНОГО УГЛА С УЧЁТОМ ВЕРОЯТНОСТЕЙ ============
function getRandomAngleByChances(isPaid) {
    const distribution = isPaid ? PAID_DISTRIBUTION : FREE_DISTRIBUTION;
    
    // 1. Выбираем сектор согласно шансам
    const rand = Math.random() * 100;
    let cumulative = 0;
    let selectedSector = null;
    for (let item of distribution) {
        cumulative += item.chance;
        if (rand < cumulative) {
            selectedSector = SECTORS.find(s => s.value === item.value);
            break;
        }
    }
    if (!selectedSector) selectedSector = SECTORS[SECTORS.length - 1]; // 0G на всякий случай

    // 2. Генерируем случайный угол ВНУТРИ выбранного сектора
    const angle = selectedSector.start + Math.random() * (selectedSector.end - selectedSector.start);
    return { angle, selectedSector };
}

// ============ 4. ОПРЕДЕЛЕНИЕ СЕКТОРА ПО УГЛУ ============
function getSectorByAngle(angleDeg) {
    // Нормализуем угол в [0, 360)
    let norm = ((angleDeg % 360) + 360) % 360;
    for (let sector of SECTORS) {
        if (norm >= sector.start && norm < sector.end) {
            return sector;
        }
    }
    // Крайний случай: 360° попадает в последний сектор
    if (norm === 360) return SECTORS[SECTORS.length - 1];
    return SECTORS[0]; // fallback
}

// ============ 5. АНИМАЦИЯ ВРАЩЕНИЯ ============
function spinToAngle(targetAngle) {
    return new Promise((resolve) => {
        if (isSpinning) return resolve();
        isSpinning = true;

        // Добавляем несколько полных оборотов для красоты
        const spins = 8;
        const startRotate = currentRotate;
        const delta = (spins * 360) + targetAngle - (startRotate % 360);
        const finalRotate = startRotate + delta;

        const startTime = performance.now();
        const duration = 2800;

        function animate(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            currentRotate = startRotate + (finalRotate - startRotate) * easeOut;
            spinnerEl.style.setProperty('--rotate', currentRotate);

            if (progress < 1) {
                animFrame = requestAnimationFrame(animate);
            } else {
                currentRotate = finalRotate % 360;
                spinnerEl.style.setProperty('--rotate', currentRotate);
                isSpinning = false;
                resolve();
            }
        }
        animFrame = requestAnimationFrame(animate);
    });
}

// ============ 6. ОБРАБОТКА КРУТКИ ============
async function handleSpin(isPaid) {
    if (isSpinning) {
        alert('Колесо уже крутится!');
        return;
    }

    // ----- Бесплатная крутка -----
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

    // ----- Платная крутка -----
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
        balanceSpan.textContent = balance;
    }

    // ----- ВЫБИРАЕМ СЛУЧАЙНЫЙ УГОЛ С УЧЁТОМ ШАНСОВ -----
    const { angle, selectedSector } = getRandomAngleByChances(isPaid);
    
    resultEl.textContent = '🎰 КРУТИМ...';

    // ----- ВРАЩАЕМ К ЭТОМУ УГЛУ -----
    await spinToAngle(angle);

    // ----- ОПРЕДЕЛЯЕМ ВЫИГРЫШ ПО ТЕКУЩЕМУ УГЛУ (для надёжности) -----
    const currentAngle = ((currentRotate % 360) + 360) % 360;
    const winSector = getSectorByAngle(currentAngle);
    const winValue = winSector.value;

    // Начисляем выигрыш
    balance += winValue;
    balanceSpan.textContent = balance;

    // Обновляем время бесплатной крутки
    if (!isPaid) {
        lastFreeTime = Date.now();
    }

    saveGame();

    // ----- ОТОБРАЖАЕМ РЕЗУЛЬТАТ -----
    if (winValue >= 100) {
        resultEl.textContent = `🔥 ДЖЕКПОТ! +${winValue}G 🔥`;
        resultEl.classList.add('jackpot-animation');
        setTimeout(() => resultEl.classList.remove('jackpot-animation'), 1500);
        tg?.HapticFeedback?.impactOccurred('heavy');
    } else if (winValue >= 50) {
        resultEl.textContent = `⚡ +${winValue}G ⚡`;
        tg?.HapticFeedback?.impactOccurred('medium');
    } else if (winValue > 0) {
        resultEl.textContent = `🎉 +${winValue}G`;
        tg?.HapticFeedback?.impactOccurred('light');
    } else {
        resultEl.textContent = `💔 0G...`;
        tg?.HapticFeedback?.notificationOccurred('error');
    }

    // Разблокировка кнопок
    updateTimer();
    paidBtn.disabled = balance < 10;
    if (!isPaid) freeBtn.disabled = true; // таймер включит сам
}

// ============ 7. ТАЙМЕР БЕСПЛАТНОЙ КРУТКИ ============
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

// ============ 8. ОТОБРАЖЕНИЕ ШАНСОВ ============
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

// ============ 9. ОБРАБОТЧИКИ СОБЫТИЙ ============
freeBtn.addEventListener('click', () => handleSpin(false));
paidBtn.addEventListener('click', () => handleSpin(true));

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

// ============ 10. ИНИЦИАЛИЗАЦИЯ ============
displayChances(false);
updateTimer();
paidBtn.disabled = balance < 10;

// Автосохранение
setInterval(saveGame, 30000);
setInterval(updateTimer, 30000);

// Сохранение при выходе
window.addEventListener('beforeunload', () => {
    if (animFrame) cancelAnimationFrame(animFrame);
    saveGame();
});