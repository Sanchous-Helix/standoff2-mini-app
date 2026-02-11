// =============================================
//  КОЛЕСО ФОРТУНЫ — МЕХАНИКА ИЗ thecode.media
//  АДАПТИРОВАНО ПОД STANDOFF 2 (8 СЕКТОРОВ,
//  ШАНСЫ, БАЛАНС, БЕСПЛАТНАЯ КРУТКА 24Ч)
// =============================================

// ---------- Telegram WebApp ----------
const tg = window.Telegram?.WebApp;
if (tg) tg.ready();

// ---------- ПОЛЬЗОВАТЕЛЬ ----------
const user = tg?.initDataUnsafe?.user || {
    first_name: 'Игрок',
    id: Date.now()
};
document.getElementById('username').innerText = user.first_name;
document.getElementById('avatar').src = user.photo_url || `https://ui-avatars.com/api/?name=${user.first_name}&background=ffd700&color=000&size=128`;

// ---------- ДАННЫЕ СЕКТОРОВ ----------
const PRIZES = [
    { text: '250', color: 'hsl(0, 60%, 40%)' },
    { text: '100', color: 'hsl(0, 70%, 55%)' },
    { text: '50',  color: 'hsl(270, 50%, 50%)' },
    { text: '25',  color: 'hsl(210, 70%, 55%)' },
    { text: '15',  color: 'hsl(145, 60%, 45%)' },
    { text: '10',  color: 'hsl(50, 80%, 55%)' },
    { text: '5',   color: 'hsl(30, 70%, 55%)' },
    { text: '0',   color: 'hsl(0, 65%, 50%)' }
];

// ---------- ШАНСЫ ----------
const FREE_CHANCES = [0.01, 0.1, 0.7, 1.8, 4, 7.5, 15, 70.89];
const PAID_CHANCES = [0.1, 0.5, 2, 5, 10, 15, 17.4, 50];

// ---------- ИГРОВЫЕ ПЕРЕМЕННЫЕ ----------
let balance = 100;
let lastFreeTime = null;
let isSpinning = false;
let spinTimeout = null;

// ---------- DOM ЭЛЕМЕНТЫ ----------
const wheel = document.querySelector('.deal-wheel');
const spinner = wheel.querySelector('.spinner');
const trigger = wheel.querySelectorAll('.btn-spin');
const ticker = wheel.querySelector('.ticker');
const balanceSpan = document.getElementById('balance');
const resultEl = document.getElementById('result');
const freeBtn = document.getElementById('freeBtn');
const paidBtn = document.getElementById('paidBtn');
const timerSpan = document.getElementById('freeTimer');
const chancesList = document.getElementById('chancesList');

// ---------- ЗАГРУЗКА СОХРАНЕНИЙ ----------
const saved = localStorage.getItem(`standoff2_article_${user.id}`);
if (saved) {
    const data = JSON.parse(saved);
    balance = data.balance || 100;
    lastFreeTime = data.lastFree || null;
}
balanceSpan.innerText = balance;

// ---------- СОХРАНЕНИЕ ----------
function saveGame() {
    localStorage.setItem(`standoff2_article_${user.id}`, JSON.stringify({
        balance: balance,
        lastFree: lastFreeTime
    }));
}

// ============ 1. ПОСТРОЕНИЕ КОЛЕСА (ТОЧНО КАК В СТАТЬЕ) ============
const prizeSlice = 360 / PRIZES.length;
const prizeOffset = Math.floor(180 / PRIZES.length);

// Расставляем текст по секторам
PRIZES.forEach(({ text, color }, i) => {
    const rotation = (prizeSlice * i * -1) - prizeOffset;
    spinner.insertAdjacentHTML(
        'beforeend',
        `<li class="prize" style="--rotate: ${rotation}deg">
            <span class="text">${text}</span>
        </li>`
    );
});

// Рисуем разноцветные сектора (conic-gradient)
const gradientColors = PRIZES.map(({ color }, i) => {
    const percent = ((i + 1) * 100) / PRIZES.length;
    return `${color} 0 ${percent}%`;
}).reverse().join(', ');
spinner.style.background = `conic-gradient(from -90deg, ${gradientColors})`;

// ---------- ПОЛУЧАЕМ ВСЕ ЭЛЕМЕНТЫ ПРИЗОВ ----------
const prizeNodes = wheel.querySelectorAll('.prize');

// ============ 2. ОПРЕДЕЛЕНИЕ ВЫИГРЫША ПО УГЛУ ============
function getSectorIndex(angle) {
    let normalized = ((angle % 360) + 360) % 360;
    // Учитываем, что из-за rotate(25deg) смещение есть
    // ВАЖНО: в статье используется смещение, но мы его убрали для простоты
    // Мы задали начальный rotate 25deg в CSS. При вычислении сектора нужно это учесть.
    const effectiveAngle = (normalized + 25) % 360;
    return Math.floor(effectiveAngle / prizeSlice) % PRIZES.length;
}

// ============ 3. ФУНКЦИЯ ВРАЩЕНИЯ ============
function spinWheel(targetRotate = null) {
    if (isSpinning) return;
    isSpinning = true;

    // Если targetRotate не задан, генерируем случайный угол с учётом шансов
    if (targetRotate === null) {
        // ЭТО МЫ ЗАМЕНИМ НА ВЫБОР ПО ШАНСАМ
        const isPaid = (trigger === paidBtn); // Но тут мы будем вызывать отдельно
        // Пока заглушка
        targetRotate = 25 + Math.floor(Math.random() * 360);
    }

    // Крутим колесо (логика из статьи)
    const spin = () => {
        // Плавное замедление
        spinner.style.transition = 'transform 3s cubic-bezier(0.25, 0.1, 0.15, 1)';
        spinner.style.transform = `rotate(${targetRotate}deg)`;
    };
    spin();

    // Обработка остановки
    const stopSpin = () => {
        isSpinning = false;
        spinner.style.transition = 'none';

        // Получаем текущий угол поворота
        const style = window.getComputedStyle(spinner);
        const matrix = style.transform;
        let angle = 0;
        if (matrix !== 'none') {
            const values = matrix.split('(')[1].split(')')[0].split(',');
            const a = values[0];
            const b = values[1];
            angle = Math.round(Math.atan2(b, a) * (180 / Math.PI));
        }
        angle = (angle + 360) % 360;

        // Определяем сектор
        const sectorIndex = getSectorIndex(angle);
        const winValue = parseInt(PRIZES[sectorIndex].text);
        return winValue;
    };

    // Очищаем предыдущий таймер
    if (spinTimeout) clearTimeout(spinTimeout);
    spinTimeout = setTimeout(() => {
        const win = stopSpin();
        // Обработчик будет вызван из handleSpin
    }, 3200);
}

// ============ 4. ВЫБОР УГЛА ПО ШАНСАМ ============
function getAngleByChances(isPaid) {
    const chances = isPaid ? PAID_CHANCES : FREE_CHANCES;
    const rand = Math.random() * 100;
    let cumulative = 0;
    let selectedIndex = 0;
    for (let i = 0; i < chances.length; i++) {
        cumulative += chances[i];
        if (rand < cumulative) {
            selectedIndex = i;
            break;
        }
    }
    // Генерируем случайный угол внутри выбранного сектора
    const minAngle = selectedIndex * prizeSlice + 25; // +25 из-за rotate
    const maxAngle = (selectedIndex + 1) * prizeSlice + 25;
    const targetAngle = minAngle + Math.random() * (maxAngle - minAngle);
    return { targetAngle, selectedIndex, winValue: parseInt(PRIZES[selectedIndex].text) };
}

// ============ 5. ОСНОВНАЯ ЛОГИКА КРУТКИ ============
async function handleSpin(isPaid) {
    if (isSpinning) return alert('Колесо крутится!');

    // Бесплатная крутка
    if (!isPaid) {
        if (lastFreeTime) {
            const hours = (Date.now() - lastFreeTime) / 3600000;
            if (hours < 24) {
                const left = 24 - hours;
                return alert(`❌ Бесплатно через ${Math.floor(left)}ч ${Math.floor((left%1)*60)}м`);
            }
        }
    }

    // Платная крутка
    if (isPaid && balance < 10) {
        return alert('❌ Недостаточно G!');
    }

    // Блокируем кнопки
    freeBtn.disabled = true;
    paidBtn.disabled = true;

    // Списываем плату
    if (isPaid) {
        balance -= 10;
        balanceSpan.innerText = balance;
    }

    // Выбираем выигрыш
    const { targetAngle, winValue } = getAngleByChances(isPaid);
    resultEl.innerText = '🎰 КРУТИМ...';

    // Вращаем
    spinner.style.transition = 'transform 3s cubic-bezier(0.25, 0.1, 0.15, 1)';
    spinner.style.transform = `rotate(${targetAngle}deg)`;

    // Ждём окончания анимации
    await new Promise(resolve => {
        if (spinTimeout) clearTimeout(spinTimeout);
        spinTimeout = setTimeout(resolve, 3200);
    });

    isSpinning = false;

    // Начисляем выигрыш
    balance += winValue;
    balanceSpan.innerText = balance;

    // Для бесплатной крутки фиксируем время
    if (!isPaid) {
        lastFreeTime = Date.now();
    }

    saveGame();

    // Показываем результат
    if (winValue >= 100) {
        resultEl.innerText = `🔥 ДЖЕКПОТ! +${winValue}G 🔥`;
        resultEl.classList.add('jackpot-animation');
        setTimeout(() => resultEl.classList.remove('jackpot-animation'), 1500);
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
    paidBtn.disabled = balance < 10;
    updateTimer();
}

// ============ 6. ТАЙМЕР БЕСПЛАТНОЙ КРУТКИ ============
function updateTimer() {
    if (!lastFreeTime) {
        freeBtn.disabled = false;
        timerSpan.innerText = 'Готово';
        return;
    }
    const hours = (Date.now() - lastFreeTime) / 3600000;
    if (hours >= 24) {
        freeBtn.disabled = false;
        timerSpan.innerText = 'Готово';
    } else {
        freeBtn.disabled = true;
        const left = 24 - hours;
        timerSpan.innerText = `${Math.floor(left)}ч ${Math.floor((left % 1) * 60)}м`;
    }
}

// ============ 7. ОТОБРАЖЕНИЕ ШАНСОВ ============
function displayChances(isPaid) {
    const chances = isPaid ? PAID_CHANCES : FREE_CHANCES;
    let html = '';
    PRIZES.forEach((prize, i) => {
        let cls = 'chance-item';
        if (prize.text === '250') cls += ' jackpot';
        if (prize.text === '100') cls += ' highlight';
        html += `<div class="${cls}"><span>${prize.text} G</span><span>${chances[i]}%</span></div>`;
    });
    chancesList.innerHTML = html;
}

// ============ 8. ПОДПИСКА НА СОБЫТИЯ ============
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

// ============ 9. ИНИЦИАЛИЗАЦИЯ ============
updateTimer();
displayChances(false);
paidBtn.disabled = balance < 10;

// Автосохранение
setInterval(saveGame, 30000);
setInterval(updateTimer, 30000);
window.addEventListener('beforeunload', saveGame);