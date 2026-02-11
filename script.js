// Telegram WebApp
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ============ ЖЁСТКАЯ ФИКСАЦИЯ ДАННЫХ ============
const APP_VERSION = '3.0_final';
const STORAGE_KEY = 'standoff2_roulette';

// ПОЛНЫЙ СБРОС ВСЕХ СТАРЫХ ДАННЫХ
for (let key in localStorage) {
    if (key.includes('balance') || key.includes('spin') || key.includes('standoff')) {
        localStorage.removeItem(key);
    }
}

// ============ НАСТРОЙКИ ============
const SECTORS = [
    { value: 250, color: '#c0392b', label: '250' }, // 0°   - ДЖЕКПОТ
    { value: 100, color: '#e84342', label: '100' }, // 45°
    { value: 50, color: '#9b59b6', label: '50' },   // 90°
    { value: 25, color: '#3498db', label: '25' },   // 135°
    { value: 15, color: '#2ecc71', label: '15' },   // 180°
    { value: 10, color: '#f1c40f', label: '10' },   // 225°
    { value: 5, color: '#e67e22', label: '5' },     // 270°
    { value: 0, color: '#e74c3c', label: '0' }      // 315°
];

// Шансы для бесплатной крутки
const FREE_CHANCES = {
    values: [0, 5, 10, 15, 25, 50, 100, 250],
    chances: [70.89, 15, 7.5, 4, 1.8, 0.7, 0.1, 0.01]
};

// Шансы для платной крутки
const PAID_CHANCES = {
    values: [0, 5, 10, 15, 25, 50, 100, 250],
    chances: [50, 17.4, 15, 10, 5, 2, 0.5, 0.1]
};

const SPIN_COST = 10;
const COOLDOWN_HOURS = 24;

// ============ СОСТОЯНИЕ ============
let balance = 100;
let lastFreeSpin = null;
let isSpinning = false;
let currentRotation = 0;
let spinTimeout = null;

// Данные пользователя
const user = tg.initDataUnsafe?.user || {
    first_name: 'Игрок',
    id: 'guest_' + Date.now()
};

// ============ DOM ЭЛЕМЕНТЫ ============
const wheel = document.getElementById('wheel');
const balanceEl = document.getElementById('balance');
const userNameEl = document.getElementById('userName');
const userAvatar = document.getElementById('userAvatar');
const resultAmount = document.getElementById('resultAmount');
const freeSpinBtn = document.getElementById('freeSpinBtn');
const paidSpinBtn = document.getElementById('paidSpinBtn');
const freeTimer = document.getElementById('freeTimer');
const chancesDisplay = document.getElementById('chancesDisplay');

// ============ ИНИЦИАЛИЗАЦИЯ ============
userNameEl.textContent = user.first_name + (user.last_name ? ' ' + user.last_name : '');
userAvatar.src = user.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name)}&background=ffd700&color=000&size=128`;

// ============ НОВАЯ СИСТЕМА СОХРАНЕНИЯ ============
function saveData() {
    const data = {
        balance: balance,
        lastFreeSpin: lastFreeSpin,
        version: APP_VERSION,
        userId: user.id
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log('💾 Сохранено');
}

function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (data.version === APP_VERSION && data.userId === user.id) {
                balance = data.balance || 100;
                lastFreeSpin = data.lastFreeSpin || null;
                console.log('📂 Загружено');
            }
        } catch (e) {}
    }
}

loadData();
updateBalanceUI();
updateChancesDisplay('free');
checkFreeSpin();

// ============ ВЫБОР ВЫИГРЫША - АБСОЛЮТНО ЧЕСТНО ============
function getWinAmount(isPaid) {
    const table = isPaid ? PAID_CHANCES : FREE_CHANCES;
    const rand = Math.random() * 100;
    let cumulative = 0;
    
    for (let i = 0; i < table.chances.length; i++) {
        cumulative += table.chances[i];
        if (rand < cumulative) {
            const winValue = table.values[i];
            console.log(`🎲 ВЫИГРЫШ: ${winValue}G (рандом: ${rand.toFixed(2)}%)`);
            return winValue;
        }
    }
    return 0;
}

// ============ ВРАЩЕНИЕ К ВЫИГРЫШУ ============
function spinToWin(winValue) {
    // Находим индекс сектора с нужным значением
    const targetIndex = SECTORS.findIndex(s => s.value === winValue);
    if (targetIndex === -1) return;
    
    // Вычисляем угол для остановки
    const targetAngle = targetIndex * 45; // 0°, 45°, 90°, ...
    const spins = 8; // Количество оборотов
    const finalAngle = spins * 360 + targetAngle;
    
    // Применяем вращение
    wheel.style.transform = `rotate(${finalAngle}deg)`;
    currentRotation = finalAngle % 360;
    
    return new Promise(resolve => {
        if (spinTimeout) clearTimeout(spinTimeout);
        spinTimeout = setTimeout(() => {
            resolve();
        }, 3000);
    });
}

// ============ ОБРАБОТКА КРУТКИ ============
async function handleSpin(isPaid) {
    if (isSpinning) {
        tg.showAlert('⏳ Колесо крутится!');
        return;
    }
    
    if (!isPaid && !checkFreeSpin()) {
        tg.showAlert('❌ Бесплатная крутка через ' + freeTimer.textContent);
        return;
    }
    
    if (isPaid && balance < SPIN_COST) {
        tg.showAlert('❌ Недостаточно G!');
        return;
    }
    
    // Блокируем кнопки
    isSpinning = true;
    freeSpinBtn.disabled = true;
    paidSpinBtn.disabled = true;
    
    // Списываем плату
    if (isPaid) {
        balance -= SPIN_COST;
        updateBalanceUI();
    }
    
    // ВЫБИРАЕМ ВЫИГРЫШ
    const winAmount = getWinAmount(isPaid);
    
    // Очищаем результат
    resultAmount.textContent = '...';
    
    // КРУТИМ КОЛЕСО
    await spinToWin(winAmount);
    
    // ПОКАЗЫВАЕМ РЕЗУЛЬТАТ
    resultAmount.textContent = `+${winAmount} G`;
    
    // АНИМАЦИЯ ДЖЕКПОТА
    if (winAmount >= 100) {
        resultAmount.classList.add('jackpot-animation');
        setTimeout(() => resultAmount.classList.remove('jackpot-animation'), 1500);
        tg.HapticFeedback.impactOccurred('heavy');
    } else if (winAmount >= 50) {
        tg.HapticFeedback.impactOccurred('medium');
    } else if (winAmount > 0) {
        tg.HapticFeedback.impactOccurred('light');
    } else {
        tg.HapticFeedback.notificationOccurred('error');
    }
    
    // НАЧИСЛЯЕМ ВЫИГРЫШ
    balance += winAmount;
    updateBalanceUI();
    
    // Бесплатная крутка
    if (!isPaid) {
        lastFreeSpin = Date.now();
    }
    
    // Сохраняем
    saveData();
    
    // Разблокируем кнопки
    isSpinning = false;
    paidSpinBtn.disabled = balance < SPIN_COST;
    checkFreeSpin();
}

// ============ ВСПОМОГАТЕЛЬНЫЕ ============
function updateBalanceUI() {
    balanceEl.textContent = balance;
}

function checkFreeSpin() {
    if (!lastFreeSpin) {
        freeSpinBtn.disabled = false;
        freeTimer.textContent = 'Готово';
        return true;
    }
    
    const now = Date.now();
    const hoursPassed = (now - lastFreeSpin) / (1000 * 60 * 60);
    
    if (hoursPassed >= COOLDOWN_HOURS) {
        freeSpinBtn.disabled = false;
        freeTimer.textContent = 'Готово';
        return true;
    } else {
        freeSpinBtn.disabled = true;
        const hoursLeft = COOLDOWN_HOURS - hoursPassed;
        const hours = Math.floor(hoursLeft);
        const minutes = Math.floor((hoursLeft - hours) * 60);
        freeTimer.textContent = `${hours}ч ${minutes}м`;
        return false;
    }
}

function updateChancesDisplay(mode) {
    const table = mode === 'free' ? FREE_CHANCES : PAID_CHANCES;
    let html = '';
    
    for (let i = 0; i < table.values.length; i++) {
        let className = 'chance-item';
        if (table.values[i] === 250) className += ' jackpot';
        if (table.values[i] === 100) className += ' highlight';
        
        html += `<div class="${className}">
            <span>${table.values[i]} G</span>
            <span>${table.chances[i]}%</span>
        </div>`;
    }
    
    chancesDisplay.innerHTML = html;
}

// ============ ОБРАБОТЧИКИ ============
freeSpinBtn.addEventListener('click', () => handleSpin(false));
paidSpinBtn.addEventListener('click', () => handleSpin(true));

// Табы
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        updateChancesDisplay(this.dataset.mode);
    });
});

// Таймер
setInterval(() => {
    if (!isSpinning) checkFreeSpin();
}, 60000);

// Старт
paidSpinBtn.disabled = balance < SPIN_COST;