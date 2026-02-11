// ==============================================
// STANDOFF 2 РУЛЕТКА - ФИНАЛЬНАЯ РАБОЧАЯ ВЕРСИЯ
// ==============================================

// Telegram WebApp
const tg = Telegram.WebApp;
tg.ready();
tg.expand();

// ============ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ ============
const user = tg.initDataUnsafe?.user || {
    first_name: 'Игрок',
    id: Date.now()
};

// ============ НАСТРОЙКИ РУЛЕТКИ ============
const SECTORS = [
    { value: 250, color: '#c0392b', angle: 22.5 },   // 0° + 22.5°
    { value: 100, color: '#e84342', angle: 67.5 },   // 45° + 22.5°
    { value: 50, color: '#9b59b6', angle: 112.5 },   // 90° + 22.5°
    { value: 25, color: '#3498db', angle: 157.5 },   // 135° + 22.5°
    { value: 15, color: '#2ecc71', angle: 202.5 },   // 180° + 22.5°
    { value: 10, color: '#f1c40f', angle: 247.5 },   // 225° + 22.5°
    { value: 5, color: '#e67e22', angle: 292.5 },    // 270° + 22.5°
    { value: 0, color: '#e74c3c', angle: 337.5 }     // 315° + 22.5°
];

// Шансы для бесплатной крутки
const FREE_CHANCES = [
    { value: 250, chance: 0.01 },
    { value: 100, chance: 0.1 },
    { value: 50, chance: 0.7 },
    { value: 25, chance: 1.8 },
    { value: 15, chance: 4 },
    { value: 10, chance: 7.5 },
    { value: 5, chance: 15 },
    { value: 0, chance: 70.89 }
];

// Шансы для платной крутки
const PAID_CHANCES = [
    { value: 250, chance: 0.1 },
    { value: 100, chance: 0.5 },
    { value: 50, chance: 2 },
    { value: 25, chance: 5 },
    { value: 15, chance: 10 },
    { value: 10, chance: 15 },
    { value: 5, chance: 17.4 },
    { value: 0, chance: 50 }
];

// ============ ИГРОВЫЕ ПЕРЕМЕННЫЕ ============
let balance = 100;
let lastFreeSpinTime = null;
let isSpinning = false;
let currentAngle = 0;
let animationFrame = null;

// ============ DOM ЭЛЕМЕНТЫ ============
const canvas = document.getElementById('rouletteCanvas');
const ctx = canvas.getContext('2d');
const balanceEl = document.getElementById('balance');
const usernameEl = document.getElementById('username');
const avatarEl = document.getElementById('avatar');
const resultEl = document.getElementById('result');
const freeBtn = document.getElementById('freeSpinBtn');
const paidBtn = document.getElementById('paidSpinBtn');
const freeTimer = document.getElementById('freeTimer');
const chancesList = document.getElementById('chancesList');
const tabFree = document.getElementById('tabFree');
const tabPaid = document.getElementById('tabPaid');

// ============ ИНИЦИАЛИЗАЦИЯ ПРОФИЛЯ ============
usernameEl.textContent = user.first_name + (user.last_name ? ' ' + user.last_name : '');
avatarEl.src = user.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name)}&background=ffd700&color=000&size=128`;

// ============ ЗАГРУЗКА ДАННЫХ ============
function loadData() {
    const saved = localStorage.getItem(`standoff2_${user.id}`);
    if (saved) {
        try {
            const data = JSON.parse(saved);
            balance = data.balance || 100;
            lastFreeSpinTime = data.lastFreeSpin || null;
        } catch (e) {
            console.log('Ошибка загрузки');
        }
    }
    balanceEl.textContent = balance;
}

loadData();

// ============ СОХРАНЕНИЕ ДАННЫХ ============
function saveData() {
    localStorage.setItem(`standoff2_${user.id}`, JSON.stringify({
        balance: balance,
        lastFreeSpin: lastFreeSpinTime
    }));
}

// ============ ОТРИСОВКА КОЛЕСА ============
function drawWheel(angle = 0) {
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 10;
    
    ctx.clearRect(0, 0, width, height);
    
    const sectorAngle = (Math.PI * 2) / SECTORS.length;
    
    for (let i = 0; i < SECTORS.length; i++) {
        const startAngle = i * sectorAngle + angle;
        const endAngle = startAngle + sectorAngle;
        
        // Рисуем сектор
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        
        ctx.fillStyle = SECTORS[i].color;
        ctx.fill();
        
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Рисуем текст
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + sectorAngle / 2);
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
    ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
}

// ============ ВЫБОР ВЫИГРЫША ПО ШАНСАМ ============
function getWinValue(isPaid) {
    const chances = isPaid ? PAID_CHANCES : FREE_CHANCES;
    const random = Math.random() * 100;
    let cumulative = 0;
    
    for (let i = 0; i < chances.length; i++) {
        cumulative += chances[i].chance;
        if (random < cumulative) {
            console.log(`🎲 Выигрыш: ${chances[i].value}G (random: ${random.toFixed(2)}%)`);
            return chances[i].value;
        }
    }
    return 0;
}

// ============ ВРАЩЕНИЕ К ВЫИГРЫШУ ============
function spinToWin(winValue) {
    return new Promise((resolve) => {
        if (isSpinning) return;
        isSpinning = true;
        
        // Находим сектор с нужным значением
        const sector = SECTORS.find(s => s.value === winValue);
        
        // Переводим угол в радианы
        const targetAngle = (sector.angle * Math.PI) / 180;
        
        // Добавляем 8 полных оборотов для красоты
        const spins = 8;
        const startAngle = currentAngle;
        const finalAngle = currentAngle + (spins * Math.PI * 2) + targetAngle - (currentAngle % (Math.PI * 2));
        
        const startTime = performance.now();
        const duration = 3000;
        
        function animate(time) {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Плавная остановка
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            currentAngle = startAngle + (finalAngle - startAngle) * easeOut;
            drawWheel(currentAngle);
            
            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                currentAngle = finalAngle % (Math.PI * 2);
                drawWheel(currentAngle);
                isSpinning = false;
                resolve();
            }
        }
        
        animationFrame = requestAnimationFrame(animate);
    });
}

// ============ ОБРАБОТКА КРУТКИ ============
async function handleSpin(isPaid) {
    if (isSpinning) {
        tg.showAlert('⏳ Колесо крутится!');
        return;
    }
    
    // Проверка бесплатной крутки
    if (!isPaid) {
        if (lastFreeSpinTime) {
            const hoursPassed = (Date.now() - lastFreeSpinTime) / (1000 * 60 * 60);
            if (hoursPassed < 24) {
                const hoursLeft = 24 - hoursPassed;
                tg.showAlert(`❌ Бесплатная крутка через ${Math.floor(hoursLeft)}ч ${Math.floor((hoursLeft % 1) * 60)}м`);
                return;
            }
        }
    }
    
    // Проверка платной крутки
    if (isPaid && balance < 10) {
        tg.showAlert('❌ Недостаточно G!');
        return;
    }
    
    // Блокируем кнопки
    freeBtn.disabled = true;
    paidBtn.disabled = true;
    
    // Списываем плату
    if (isPaid) {
        balance -= 10;
        balanceEl.textContent = balance;
    }
    
    // ВЫБИРАЕМ ВЫИГРЫШ
    const winValue = getWinValue(isPaid);
    
    // Показываем процесс
    resultEl.textContent = '🎰 КРУТИМ...';
    
    // КРУТИМ КОЛЕСО
    await spinToWin(winValue);
    
    // НАЧИСЛЯЕМ ВЫИГРЫШ
    balance += winValue;
    balanceEl.textContent = balance;
    
    // Обновляем время бесплатной крутки
    if (!isPaid) {
        lastFreeSpinTime = Date.now();
    }
    
    // Сохраняем данные
    saveData();
    
    // ПОКАЗЫВАЕМ РЕЗУЛЬТАТ
    if (winValue >= 100) {
        resultEl.textContent = `🔥 ДЖЕКПОТ! +${winValue}G 🔥`;
        resultEl.classList.add('jackpot-animation');
        setTimeout(() => resultEl.classList.remove('jackpot-animation'), 1500);
        tg.HapticFeedback.impactOccurred('heavy');
    } else if (winValue >= 50) {
        resultEl.textContent = `⚡ +${winValue}G ⚡`;
        tg.HapticFeedback.impactOccurred('medium');
    } else if (winValue > 0) {
        resultEl.textContent = `🎉 +${winValue}G`;
        tg.HapticFeedback.impactOccurred('light');
    } else {
        resultEl.textContent = `💔 0G...`;
        tg.HapticFeedback.notificationOccurred('error');
    }
    
    // Разблокируем кнопки
    paidBtn.disabled = balance < 10;
    updateFreeTimer();
}

// ============ ОБНОВЛЕНИЕ ТАЙМЕРА ============
function updateFreeTimer() {
    if (!lastFreeSpinTime) {
        freeBtn.disabled = false;
        freeTimer.textContent = 'Готово';
        return;
    }
    
    const hoursPassed = (Date.now() - lastFreeSpinTime) / (1000 * 60 * 60);
    
    if (hoursPassed >= 24) {
        freeBtn.disabled = false;
        freeTimer.textContent = 'Готово';
    } else {
        freeBtn.disabled = true;
        const hoursLeft = 24 - hoursPassed;
        const hours = Math.floor(hoursLeft);
        const minutes = Math.floor((hoursLeft - hours) * 60);
        freeTimer.textContent = `${hours}ч ${minutes}м`;
    }
}

// ============ ОТОБРАЖЕНИЕ ШАНСОВ ============
function displayChances(isPaid) {
    const chances = isPaid ? PAID_CHANCES : FREE_CHANCES;
    let html = '';
    
    for (let i = 0; i < chances.length; i++) {
        let className = 'chance-item';
        if (chances[i].value === 250) className += ' jackpot';
        if (chances[i].value === 100) className += ' highlight';
        
        html += `<div class="${className}">
            <span>${chances[i].value} G</span>
            <span>${chances[i].chance}%</span>
        </div>`;
    }
    
    chancesList.innerHTML = html;
}

// ============ ОБРАБОТЧИКИ СОБЫТИЙ ============
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

// ============ ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ============
drawWheel();
updateFreeTimer();
displayChances(false);
paidBtn.disabled = balance < 10;

// ============ АВТОСОХРАНЕНИЕ ============
setInterval(saveData, 30000);
setInterval(updateFreeTimer, 60000);

// ============ СОХРАНЕНИЕ ПРИ ВЫХОДЕ ============
window.addEventListener('beforeunload', () => {
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
    }
    saveData();
});