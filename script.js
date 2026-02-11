// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Состояние приложения
let balance = 100;
let lastFreeSpin = null;
const SPIN_COST = 10;
const COOLDOWN_HOURS = 24;

// Данные пользователя
const user = tg.initDataUnsafe?.user || {
    first_name: 'Игрок',
    username: 'player',
    id: Math.floor(Math.random() * 1000000)
};

// Элементы DOM
const wheel = document.getElementById('wheel');
const balanceEl = document.getElementById('balance');
const userNameEl = document.getElementById('userName');
const userAvatar = document.getElementById('userAvatar');
const resultDisplay = document.getElementById('resultDisplay');
const freeSpinBtn = document.getElementById('freeSpinBtn');
const paidSpinBtn = document.getElementById('paidSpinBtn');
const freeTimer = document.getElementById('freeTimer');

// Установка данных пользователя
userNameEl.textContent = user.first_name + (user.last_name ? ' ' + user.last_name : '');
userAvatar.src = user.photo_url || `https://ui-avatars.com/api/?name=${user.first_name}&background=ffd700&color=000&size=128`;

// Шансы для разных режимов
const CHANCES = {
    free: [
        { value: 0, chance: 70.89 },
        { value: 5, chance: 15 },
        { value: 10, chance: 7.5 },
        { value: 15, chance: 4 },
        { value: 25, chance: 1.8 },
        { value: 50, chance: 0.7 },
        { value: 100, chance: 0.1 },
        { value: 250, chance: 0.01 }
    ],
    paid: [
        { value: 0, chance: 50 },
        { value: 5, chance: 17.4 },
        { value: 10, chance: 15 },
        { value: 15, chance: 10 },
        { value: 25, chance: 5 },
        { value: 50, chance: 2 },
        { value: 100, chance: 0.5 },
        { value: 250, chance: 0.1 }
    ]
};

// Функция выбора выигрыша на основе шансов
function getWinValue(mode) {
    const chances = CHANCES[mode];
    const rand = Math.random() * 100;
    let cumulative = 0;
    
    for (const item of chances) {
        cumulative += item.chance;
        if (rand < cumulative) {
            return item.value;
        }
    }
    return 0;
}

// Анимация вращения барабана
async function spinWheel(targetValue) {
    // Определяем сектор для выигрыша
    const sectorIndex = CHANCES.free.findIndex(item => item.value === targetValue);
    const targetRotation = 360 * 5 + (45 * sectorIndex) + 22.5; // 5 полных оборотов + смещение
    
    // Вращаем
    wheel.style.transform = `rotate(${targetRotation}deg)`;
    
    // Ждём окончания анимации
    await new Promise(resolve => setTimeout(resolve, 3000));
}

// Обновление баланса
function updateBalanceUI() {
    balanceEl.textContent = balance;
}

// Проверка бесплатной крутки
function checkFreeSpin() {
    if (!lastFreeSpin) {
        freeSpinBtn.disabled = false;
        freeTimer.textContent = 'Готово!';
        return true;
    }
    
    const now = Date.now();
    const hoursPassed = (now - lastFreeSpin) / (1000 * 60 * 60);
    
    if (hoursPassed >= COOLDOWN_HOURS) {
        freeSpinBtn.disabled = false;
        freeTimer.textContent = 'Готово!';
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

// Обновление таймера каждую минуту
setInterval(checkFreeSpin, 60000);

// Бесплатная крутка
async function handleFreeSpin() {
    if (!checkFreeSpin()) {
        tg.showAlert('❌ Бесплатная крутка ещё недоступна!');
        return;
    }
    
    // Блокируем кнопки
    freeSpinBtn.disabled = true;
    paidSpinBtn.disabled = true;
    
    // Получаем выигрыш
    const winAmount = getWinValue('free');
    
    // Анимируем
    await spinWheel(winAmount);
    
    // Начисляем выигрыш
    balance += winAmount;
    updateBalanceUI();
    
    // Обновляем время последней бесплатной крутки
    lastFreeSpin = Date.now();
    localStorage.setItem('lastFreeSpin', lastFreeSpin);
    
    // Показываем результат
    if (winAmount >= 100) {
        resultDisplay.innerHTML = `🔥 ДЖЕКПОТ! +${winAmount}G 🔥`;
        tg.HapticFeedback.impactOccurred('heavy');
    } else if (winAmount >= 50) {
        resultDisplay.innerHTML = `⚡ +${winAmount}G! ⚡`;
        tg.HapticFeedback.impactOccurred('medium');
    } else if (winAmount > 0) {
        resultDisplay.innerHTML = `🎉 +${winAmount}G!`;
        tg.HapticFeedback.impactOccurred('light');
    } else {
        resultDisplay.innerHTML = `💔 0G... Повезёт в следующий раз`;
        tg.HapticFeedback.notificationOccurred('error');
    }
    
    // Разблокируем кнопки
    paidSpinBtn.disabled = false;
    checkFreeSpin();
}

// Платная крутка
async function handlePaidSpin() {
    if (balance < SPIN_COST) {
        tg.showAlert('❌ Недостаточно G!');
        return;
    }
    
    // Блокируем кнопки
    freeSpinBtn.disabled = true;
    paidSpinBtn.disabled = true;
    
    // Списываем плату
    balance -= SPIN_COST;
    updateBalanceUI();
    
    // Получаем выигрыш
    const winAmount = getWinValue('paid');
    
    // Анимируем
    await spinWheel(winAmount);
    
    // Начисляем выигрыш
    balance += winAmount;
    updateBalanceUI();
    
    // Показываем результат
    if (winAmount >= 100) {
        resultDisplay.innerHTML = `🔥 ДЖЕКПОТ! +${winAmount}G 🔥`;
        tg.HapticFeedback.impactOccurred('heavy');
    } else if (winAmount >= 50) {
        resultDisplay.innerHTML = `⚡ +${winAmount}G! ⚡`;
        tg.HapticFeedback.impactOccurred('medium');
    } else if (winAmount > 0) {
        resultDisplay.innerHTML = `🎉 +${winAmount}G!`;
        tg.HapticFeedback.impactOccurred('light');
    } else {
        resultDisplay.innerHTML = `💔 0G... Повезёт в следующий раз`;
        tg.HapticFeedback.notificationOccurred('error');
    }
    
    // Разблокируем кнопки
    freeSpinBtn.disabled = false;
    paidSpinBtn.disabled = false;
    checkFreeSpin();
}

// Переключение табов
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        document.querySelectorAll('.chances-panel').forEach(p => p.classList.remove('active'));
        if (this.dataset.tab === 'free') {
            document.getElementById('freeChances').classList.add('active');
        } else {
            document.getElementById('paidChances').classList.add('active');
        }
    });
});

// Загрузка сохранённых данных
const savedBalance = localStorage.getItem(`balance_${user.id}`);
const savedLastFreeSpin = localStorage.getItem(`lastFreeSpin_${user.id}`);

if (savedBalance) {
    balance = parseInt(savedBalance);
    updateBalanceUI();
}

if (savedLastFreeSpin) {
    lastFreeSpin = parseInt(savedLastFreeSpin);
}

// Обработчики кнопок
freeSpinBtn.addEventListener('click', handleFreeSpin);
paidSpinBtn.addEventListener('click', handlePaidSpin);

// Сохранение при закрытии
window.addEventListener('beforeunload', () => {
    localStorage.setItem(`balance_${user.id}`, balance);
    localStorage.setItem(`lastFreeSpin_${user.id}`, lastFreeSpin);
    
    tg.sendData(JSON.stringify({
        balance: balance,
        userId: user.id
    }));
});

// Проверяем доступность бесплатной крутки при загрузке
checkFreeSpin();