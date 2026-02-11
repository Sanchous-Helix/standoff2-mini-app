// Инициализация Telegram
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ============ КОНФИГУРАЦИЯ ============
// ПОРЯДОК СЕКТОРОВ ПО ЧАСОВОЙ СТРЕЛКЕ ОТ ВЕРХНЕЙ ТОЧКИ (0°)
const SECTORS = [
    { value: 250, color: '#c0392b', label: '250' }, // 0°   (верх)
    { value: 0, color: '#e74c3c', label: '0' },     // 45°
    { value: 5, color: '#e67e22', label: '5' },     // 90°
    { value: 10, color: '#f1c40f', label: '10' },   // 135°
    { value: 15, color: '#2ecc71', label: '15' },   // 180°
    { value: 25, color: '#3498db', label: '25' },   // 225°
    { value: 50, color: '#9b59b6', label: '50' },   // 270°
    { value: 100, color: '#e84342', label: '100' }  // 315°
];

// Шансы в СООТВЕТСТВИИ С НОВЫМ ПОРЯДКОМ СЕКТОРОВ
const CHANCES = {
    free: [
        0.01,   // 250 G — 0.01% (верх)
        70.89,  // 0 G   — 70.89%
        15,     // 5 G   — 15%
        7.5,    // 10 G  — 7.5%
        4,      // 15 G  — 4%
        1.8,    // 25 G  — 1.8%
        0.7,    // 50 G  — 0.7%
        0.1     // 100 G — 0.1%
    ],
    paid: [
        0.1,    // 250 G — 0.1%  (верх)
        50,     // 0 G   — 50%
        17.4,   // 5 G   — 17.4%
        15,     // 10 G  — 15%
        10,     // 15 G  — 10%
        5,      // 25 G  — 5%
        2,      // 50 G  — 2%
        0.5     // 100 G — 0.5%
    ]
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
            console.log(`🎲 Выпал сектор ${i}: ${SECTORS[i].value}G`);
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
        
        // Целевой угол: указатель смотрит на ВЕРХ (0°)
        // Нам нужно, чтобы верхняя точка (0 радиан) указывала на ЦЕНТР целевого сектора
        // Каждый сектор - 45 градусов (Math.PI/4 радиан)
        // Центр сектора находится на угле: i * 45° + 22.5°
        const targetAngle = (targetIndex * 45 + 22.5) * Math.PI / 180;
        
        // Добавляем несколько полных оборотов для красоты
        const spins = 8;
        const startAngle = currentRotation;
        
        // Вычисляем финальный угол
        let deltaAngle = (spins * Math.PI * 2) + targetAngle;
        
        // Вычитаем текущее положение, чтобы продолжить с того же места
        deltaAngle = deltaAngle - (currentRotation % (Math.PI * 2));
        
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
    if (isSpinning) {
        tg.showAlert('⏳ Барабан уже крутится!');
        return;
    }
    
    if (mode === 'free' && !checkFreeSpin()) {
        tg.showAlert('❌ Бесплатная крутка ещё недоступна!');
        return;
    }
    
    if (mode === 'paid' && balance < SPIN_COST) {
        tg.showAlert('❌ Недостаточно G!');
        return;
    }
    
    freeSpinBtn.disabled = true;
    paidSpinBtn.disabled = true;
    
    if (mode === 'paid') {
        balance -= SPIN_COST;
        updateBalanceUI();
    }
    
    const winIndex = getWinIndex(mode);
    const winAmount = SECTORS[winIndex].value;
    
    resultDisplay.innerHTML = '🎰 Крутим...';
    
    await spinWheel(winIndex);
    
    balance += winAmount;
    updateBalanceUI();
    
    if (mode === 'free') {
        lastFreeSpin = Date.now();
        localStorage.setItem(`lastFreeSpin_${user.id}`, lastFreeSpin);
    }
    
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
    
    if (!isSpinning) {
        paidSpinBtn.disabled = balance < SPIN_COST;
        checkFreeSpin();
    }
}

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============
function updateBalanceUI() {
    balanceEl.textContent = balance;
    localStorage.setItem(`balance_${user.id}`, balance);
    
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

// ============ ОБРАБОТЧИКИ ============
freeSpinBtn.addEventListener('click', () => handleSpin('free'));
paidSpinBtn.addEventListener('click', () => handleSpin('paid'));

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

setInterval(() => {
    if (!isSpinning) {
        checkFreeSpin();
    }
}, 60000);

drawWheel(currentRotation);
paidSpinBtn.disabled = balance < SPIN_COST;

window.addEventListener('beforeunload', () => {
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
    }
});