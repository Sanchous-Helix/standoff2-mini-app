// ============================================================
//  КОЛЕСО ФОРТУНЫ — ТОЧНАЯ РЕАЛИЗАЦИЯ МЕХАНИКИ ИЗ СТАТЬИ
//  ДОБАВЛЕНЫ: ШАНСЫ, БАЛАНС, БЕСПЛАТНАЯ КРУТКА 24Ч, ПРОФИЛЬ
// ============================================================

// ---------- Telegram WebApp ----------
const tg = window.Telegram?.WebApp;
if (tg) tg.ready();

// ---------- ПОЛЬЗОВАТЕЛЬ ----------
const user = tg?.initDataUnsafe?.user || {
    first_name: 'Игрок',
    id: Date.now()
};
document.getElementById('username').innerText = user.first_name;
document.getElementById('avatar').src = user.photo_url || 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name)}&background=ffd700&color=000&size=128`;

// ============ ДАННЫЕ ИЗ ТВОИХ ТАБЛИЦ ============
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

// Шансы для бесплатной крутки (сумма 100%)
const FREE_CHANCES = [0.01, 0.1, 0.7, 1.8, 4, 7.5, 15, 70.89];
// Шансы для платной крутки
const PAID_CHANCES = [0.1, 0.5, 2, 5, 10, 15, 17.4, 50];

// ============ ПЕРЕМЕННЫЕ ИГРОКА ============
let balance = 100;
let lastFreeTime = null;        // timestamp последней бесплатной крутки
let isSpinning = false;        // флаг вращения
let spinTimeout = null;        // таймер остановки

// ============ DOM ЭЛЕМЕНТЫ ============
const wheel = document.querySelector('.deal-wheel');
const spinner = wheel.querySelector('.spinner');
const ticker = wheel.querySelector('.ticker');
const balanceSpan = document.getElementById('balance');
const resultEl = document.getElementById('result');
const freeBtn = document.getElementById('freeBtn');
const paidBtn = document.getElementById('paidBtn');
const timerSpan = document.getElementById('freeTimer');
const chancesList = document.getElementById('chancesList');

// ============ ЗАГРУЗКА ИЗ LOCALSTORAGE ============
const saved = localStorage.getItem(`standoff2_article_${user.id}`);
if (saved) {
    try {
        const data = JSON.parse(saved);
        balance = data.balance || 100;
        lastFreeTime = data.lastFree || null;
    } catch(e) {}
}
balanceSpan.innerText = balance;

// ============ СОХРАНЕНИЕ ============
function saveGame() {
    localStorage.setItem(`standoff2_article_${user.id}`, JSON.stringify({
        balance: balance,
        lastFree: lastFreeTime
    }));
}

// ============ ПОСТРОЕНИЕ КОЛЕСА (ТОЧНО КАК В СТАТЬЕ) ============
const prizeSlice = 360 / PRIZES.length;          // 45°
const prizeOffset = Math.floor(180 / PRIZES.length); // 22°

// Расставляем текст
PRIZES.forEach(({ text, color }, i) => {
    const rotation = (prizeSlice * i * -1) - prizeOffset;
    spinner.insertAdjacentHTML(
        'beforeend',
        `<li class="prize" style="--rotate: ${rotation}deg">
            <span class="text">${text}</span>
        </li>`
    );
});

// Рисуем цветные сектора через conic-gradient
const gradientColors = PRIZES.map(({ color }, i) => {
    const percent = ((i + 1) * 100) / PRIZES.length;
    return `${color} 0 ${percent}%`;
}).reverse().join(', ');
spinner.style.background = `conic-gradient(from -90deg, ${gradientColors})`;

// Сохраняем все призовые элементы
const prizeNodes = wheel.querySelectorAll('.prize');

// ============ ОПРЕДЕЛЕНИЕ СЕКТОРА ПО УГЛУ ============
function getSectorIndex(angle) {
    // Нормализуем угол [0, 360)
    let norm = ((angle % 360) + 360) % 360;
    // Учитываем начальный rotate (25deg)
    const effectiveAngle = (norm + 25) % 360;
    return Math.floor(effectiveAngle / prizeSlice) % PRIZES.length;
}

// ============ ВЫБОР ЦЕЛЕВОГО УГЛА ПО ШАНСАМ ============
function getTargetAngle(isPaid) {
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
    // Случайный угол внутри выбранного сектора (плюс начальный rotate)
    const minAngle = selectedIndex * prizeSlice + 25;
    const maxAngle = (selectedIndex + 1) * prizeSlice + 25;
    const targetAngle = minAngle + Math.random() * (maxAngle - minAngle);
    return { targetAngle, selectedIndex };
}

// ============ УДАЛЕНИЕ ВЫДЕЛЕНИЯ С ПРЕДЫДУЩЕГО СЕКТОРА ============
function removeSelectedClass() {
    prizeNodes.forEach(node => node.classList.remove('selected'));
}

// ============ ОСНОВНАЯ ФУНКЦИЯ КРУТКИ ============
async function handleSpin(isPaid) {
    if (isSpinning) {
        alert('Колесо уже крутится!');
        return;
    }

    // Бесплатная крутка — проверка 24 часов
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

    // Платная крутка — проверка баланса
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

    // Убираем подсветку предыдущего сектора
    removeSelectedClass();

    // Выбираем целевой угол согласно шансам
    const { targetAngle, selectedIndex } = getTargetAngle(isPaid);
    const winValue = PRIZES[selectedIndex].text;

    // Показываем процесс
    resultEl.innerText = '🎰 КРУТИМ...';

    // Добавляем класс is-spinning для активации анимации язычка
    wheel.classList.add('is-spinning');

    // Запускаем вращение
    spinner.style.transition = 'transform 8s cubic-bezier(0.1, -0.01, 0, 1)';
    spinner.style.transform = `rotate(${targetAngle}deg)`;

    // Ждём окончания анимации
    await new Promise(resolve => {
        if (spinTimeout) clearTimeout(spinTimeout);
        spinTimeout = setTimeout(resolve, 8200); // 8s + запас
    });

    // Убираем класс вращения
    wheel.classList.remove('is-spinning');
    isSpinning = false;

    // Получаем реальный угол поворота после анимации
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

    // Определяем сектор по углу
    const sectorIndex = getSectorIndex(angle);
    const winValueActual = PRIZES[sectorIndex].text;
    const winNumber = parseInt(winValueActual);

    // Подсвечиваем выигравший сектор
    prizeNodes[sectorIndex].classList.add('selected');

    // Начисляем выигрыш
    balance += winNumber;
    balanceSpan.innerText = balance;

    // Если это была бесплатная крутка — запоминаем время
    if (!isPaid) {
        lastFreeTime = Date.now();
    }

    saveGame();

    // Выводим сообщение
    if (winNumber >= 100) {
        resultEl.innerText = `🔥 ДЖЕКПОТ! +${winNumber}G 🔥`;
        resultEl.classList.add('jackpot-animation');
        setTimeout(() => resultEl.classList.remove('jackpot-animation'), 1500);
        tg?.HapticFeedback?.impactOccurred('heavy');
    } else if (winNumber >= 50) {
        resultEl.innerText = `⚡ +${winNumber}G ⚡`;
        tg?.HapticFeedback?.impactOccurred('medium');
    } else if (winNumber > 0) {
        resultEl.innerText = `🎉 +${winNumber}G`;
        tg?.HapticFeedback?.impactOccurred('light');
    } else {
        resultEl.innerText = `💔 0G...`;
        tg?.HapticFeedback?.notificationOccurred('error');
    }

    // Разблокировка кнопок
    paidBtn.disabled = balance < 10;
    updateTimer();
}

// ============ ТАЙМЕР БЕСПЛАТНОЙ КРУТКИ ============
function updateTimer() {
    if (!lastFreeTime) {
        freeBtn.disabled = false;
        timerSpan.innerText = 'Готово';
        return;
    }
    const hours = (Date.now() - lastFreeTime) / (1000 * 60 * 60);
    if (hours >= 24) {
        freeBtn.disabled = false;
        timerSpan.innerText = 'Готово';
    } else {
        freeBtn.disabled = true;
        const left = 24 - hours;
        const h = Math.floor(left);
        const m = Math.floor((left - h) * 60);
        timerSpan.innerText = `${h}ч ${m}м`;
    }
}

// ============ ОТОБРАЖЕНИЕ ШАНСОВ ============
function displayChances(isPaid) {
    const chances = isPaid ? PAID_CHANCES : FREE_CHANCES;
    let html = '';
    PRIZES.forEach((prize, i) => {
        let cls = 'chance-item';
        if (prize.text === '250') cls += ' jackpot';
        if (prize.text === '100') cls += ' highlight';
        html += `<div class="${cls}">
            <span>${prize.text} G</span>
            <span>${chances[i]}%</span>
        </div>`;
    });
    chancesList.innerHTML = html;
}

// ============ ПОДПИСКА НА СОБЫТИЯ ============
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

// ============ ИНИЦИАЛИЗАЦИЯ ============
updateTimer();
displayChances(false);
paidBtn.disabled = balance < 10;

// Автосохранение и таймер
setInterval(saveGame, 30000);
setInterval(updateTimer, 30000);

// Сохраняем перед закрытием
window.addEventListener('beforeunload', () => {
    if (spinTimeout) clearTimeout(spinTimeout);
    saveGame();
});