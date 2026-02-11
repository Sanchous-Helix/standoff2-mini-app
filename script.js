// Инициализация Telegram
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ============ КОНФИГУРАЦИЯ ============
const SECTORS = [
    { value: 0, color: '#e74c3c', label: '0' },
    { value: 5, color: '#e67e22', label: '5' },
    { value: 10, color: '#f1c40f', label: '10' },
    { value: 15, color: '#2ecc71', label: '15' },
    { value: 25, color: '#3498db', label: '25' },
    { value: 50, color: '#9b59b6', label: '50' },
    { value: 100, color: '#e84342', label: '100' },
    { value: 250, color: '#c0392b', label: '250' }
];

const CHANCES = {
    free: [70.89, 15, 7.5, 4, 1.8, 0.7, 0.1, 0.01],
    paid: [50, 17.4, 15, 10, 5, 2, 0.5, 0.1]
};

const SPIN_COST = 10;
const COOLDOWN_HOURS = 24;

// ============ СОСТОЯНИЕ ============
let balance = 100;
let lastFreeSpin = null;
let isSpinning = false;
let currentRotation = 0;
let animationFrame = null;

// Данные пользователя
const user = tg.initDataUnsafe?.user || {
    first_name: 'Игрок',
    id: Math.floor(Math.random() * 1000000)
};

// ============ DOM ЭЛЕМЕНТЫ ============
const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');
const balanceEl = document.getElementById('balance');
const userNameEl = document.getElementById('userName');
const userAvatar = document.getElementById('userAvatar');
const resultDisplay = document.getElementById('resultDisplay');
const freeSpinBtn = document.getElementById('freeSpinBtn');
const paidSpinBtn = document.getElementById('paidSpinBtn');
const freeTimer = document.getElementById('freeTimer');

// ============ ИНИЦИАЛИЗАЦИЯ ============
userNameEl.textContent = user.first_name + (user.last_name ? ' ' + user.last_name : '');
userAvatar.src = user.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name)}&background=ffd700&color=000&size=128`;

// Загрузка сохранённых данных
const savedBalance = localStorage.getItem(`balance_${user.id}`);
const savedLastFreeSpin = localStorage.getItem(`lastFreeSpin_${user.id}`);

if (savedBalance) balance = parseInt(savedBalance);
if (savedLastFreeSpin) lastFreeSpin = parseInt(savedLastFreeSpin);

updateBalanceUI();
checkFreeSpin();

// ============ ОТРИСОВКА БАРАБАНА ============
function drawWheel(rotationAngle = 0) {
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 10;
    
    ctx.clearRect(0, 0, width, height);
    
    const anglePerSector = (Math.PI * 2) / SECTORS.length;
    
    for (let i = 0; i < SECTORS.length; i++) {
        const startAngle = i * anglePerSector + rotationAngle;
        const endAngle = startAngle + anglePerSector;
        
        // Рисуем сектор
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        
        // Заливка
        ctx.fillStyle = SECTORS[i].color;
        ctx.fill();
        
        // Обводка
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Текст
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + anglePerSector / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText(SECTORS[i].label, radius * 0.65, 0);
        ctx.restore();
    }
    
    // Рисуем центральный круг
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
}

// ============ ВЫБОР ВЫИГРЫША ============
function getWinIndex(mode) {
    const chances = CHANCES[mode];
    const rand = Math.random() * 100;
    let cumulative = 0;
    
    for (let i = 0; i < chances.length; i++) {
        cumulative += chances[i];
        if (rand < cumulative) {
            return i;
        }
    }
    return 0;
}

// ============ АНИМАЦИЯ ВРАЩЕНИЯ ============
function spinWheel(targetIndex) {
    return new Promise((resolve) => {
        if (isSpinning) {
            resolve();
            return;
        }
        
        isSpinning = true;
        
        // Целевой угол: указатель должен смотреть на СЕРЕДИНУ сектора
        // Каждый сектор занимает 45 градусов (Math.PI/4 радиан)
        // Нам нужно, чтобы верхняя точка (0 радиан) указывала на середину целевого сектора
        const targetAngle = (targetIndex * 45 + 22.5) * Math.PI / 180;
        
        // Добавляем несколько полных оборотов
        const spins = 8;
        const startAngle = currentRotation;
        const deltaAngle = (spins * Math.PI * 2) + targetAngle - (currentRotation % (Math.PI * 2));
        const finalAngle = currentRotation + deltaAngle;
        
        // Анимация
        const startTime = performance.now();
        const duration = 3000;
        
        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing для плавной остановки
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentAngle = startAngle + (finalAngle - startAngle) * easeOut;
            
            drawWheel(currentAngle);
            
            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                // Сохраняем финальный угол
                currentRotation = finalAngle % (Math.PI * 2);
                drawWheel(currentRotation);
                
                isSpinning = false;
                resolve();
            }
        }
        
        animationFrame = requestAnimationFrame(animate);
    });
}

// ============ ОБРАБОТКА КРУТКИ ============
async function handleSpin(mode) {
    // Проверка на вращение
    if (isSpinning) {
        tg.showAlert('⏳ Барабан уже крутится!');
        return;
    }
    
    // Проверка для бесплатной крутки
    if (mode === 'free' && !checkFreeSpin()) {
        tg.showAlert('❌ Бесплатная крутка ещё недоступна!');
        return;
    }
    
    // Проверка для платной крутки
    if (mode === 'paid' && balance < SPIN_COST) {
        tg.showAlert('❌ Недостаточно G!');
        return;
    }
    
    // БЛОКИРУЕМ КНОПКИ
    freeSpinBtn.disabled = true;
    paidSpinBtn.disabled = true;
    
    // 1️⃣ Списываем плату (для платной крутки)
    if (mode === 'paid') {
        balance -= SPIN_COST;
        updateBalanceUI();
    }
    
    // 2️⃣ ОПРЕДЕЛЯЕМ ВЫИГРЫШ ДО ВРАЩЕНИЯ
    const winIndex = getWinIndex(mode);
    const winAmount = SECTORS[winIndex].value;
    
    // Показываем, что крутим
    resultDisplay.innerHTML = '🎰 Крутим...';
    
    // 3️⃣ КРУТИМ БАРАБАН К ВЫИГРЫШУ
    await spinWheel(winIndex);
    
    // 4️⃣ ТОЛЬКО ТЕПЕРЬ НАЧИСЛЯЕМ ВЫИГРЫШ
    balance += winAmount;
    updateBalanceUI();
    
    // Для бесплатной крутки - ставим таймер
    if (mode === 'free') {
        lastFreeSpin = Date.now();
        localStorage.setItem(`lastFreeSpin_${user.id}`, lastFreeSpin);
    }
    
    // 5️⃣ ПОКАЗЫВАЕМ РЕЗУЛЬТАТ
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
    
    // 6️⃣ РАЗБЛОКИРУЕМ КНОПКИ
    // Для платной кнопки проверяем баланс
    paidSpinBtn.disabled = balance < SPIN_COST;
    // Для бесплатной проверяем таймер
    checkFreeSpin();
}

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============
function updateBalanceUI() {
    balanceEl.textContent = balance;
    localStorage.setItem(`balance_${user.id}`, balance);
    
    // Обновляем состояние кнопки платной крутки
    if (!isSpinning) {
        paidSpinBtn.disabled = balance < SPIN_COST;
    }
}

function checkFreeSpin() {
    if (!lastFreeSpin) {
        if (!isSpinning) freeSpinBtn.disabled = false;
        freeTimer.textContent = 'Готово!';
        return true;
    }
    
    const now = Date.now();
    const hoursPassed = (now - lastFreeSpin) / (1000 * 60 * 60);
    
    if (hoursPassed >= COOLDOWN_HOURS) {
        if (!isSpinning) freeSpinBtn.disabled = false;
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

// ============ ОБРАБОТЧИКИ СОБЫТИЙ ============
freeSpinBtn.addEventListener('click', () => handleSpin('free'));
paidSpinBtn.addEventListener('click', () => handleSpin('paid'));

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

// Обновление таймера каждую минуту
setInterval(() => {
    if (!isSpinning) {
        checkFreeSpin();
    }
}, 60000);

// Начальная отрисовка
drawWheel(currentRotation);

// Проверка баланса при старте
paidSpinBtn.disabled = balance < SPIN_COST;

// Очистка анимации при уходе
window.addEventListener('beforeunload', () => {
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
    }
});