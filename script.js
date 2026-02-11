// Telegram WebApp
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ============ КОНФИГУРАЦИЯ - ПЕРЕСТАНОВКА ВСЕХ 8 СЕКТОРОВ ============
const SECTORS = [
    { value: 0, color: '#c0392b', label: '0' },      // 0°   (ВЕРХ) - было 250, стало 0
    { value: 15, color: '#e84342', label: '15' },    // 45°  - было 100, стало 15
    { value: 25, color: '#9b59b6', label: '25' },    // 90°  - было 50, стало 25
    { value: 50, color: '#3498db', label: '50' },    // 135° - было 25, стало 50
    { value: 100, color: '#2ecc71', label: '100' },  // 180° - было 15, стало 100
    { value: 5, color: '#f1c40f', label: '5' },      // 225° - было 10, стало 5
    { value: 10, color: '#e67e22', label: '10' },    // 270° - было 5, стало 10
    { value: 250, color: '#e74c3c', label: '250' }   // 315° - было 0, стало 250
];

// Шансы для бесплатной крутки
const FREE_CHANCES = [
    70.89,  // 0 G
    4,      // 15 G
    1.8,    // 25 G
    0.7,    // 50 G
    0.1,    // 100 G
    15,     // 5 G
    7.5,    // 10 G
    0.01    // 250 G
];

// Шансы для платной крутки
const PAID_CHANCES = [
    50,     // 0 G
    10,     // 15 G
    5,      // 25 G
    2,      // 50 G
    0.5,    // 100 G
    17.4,   // 5 G
    15,     // 10 G
    0.1     // 250 G
];

const SPIN_COST = 10;
const COOLDOWN_HOURS = 24;

// Состояние
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

// DOM элементы
const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');
const balanceEl = document.getElementById('balance');
const userNameEl = document.getElementById('userName');
const userAvatar = document.getElementById('userAvatar');
const resultDisplay = document.getElementById('resultDisplay');
const freeSpinBtn = document.getElementById('freeSpinBtn');
const paidSpinBtn = document.getElementById('paidSpinBtn');
const freeTimer = document.getElementById('freeTimer');

// Инициализация
userNameEl.textContent = user.first_name + (user.last_name ? ' ' + user.last_name : '');
userAvatar.src = user.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name)}&background=ffd700&color=000&size=128`;

// Загрузка сохранений
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
        
        ctx.fillStyle = SECTORS[i].color;
        ctx.fill();
        
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Текст
        ctx.save();
        ctx.translate(centerX, centerY);
        
        const textAngle = startAngle + anglePerSector / 2;
        const textRadius = radius * 0.65;
        const x = Math.cos(textAngle) * textRadius;
        const y = Math.sin(textAngle) * textRadius;
        
        ctx.translate(x, y);
        
        // Поворот текста для читаемости
        if (textAngle % (Math.PI * 2) > Math.PI/2 && textAngle % (Math.PI * 2) < Math.PI * 3/2) {
            ctx.rotate(textAngle + Math.PI);
        } else {
            ctx.rotate(textAngle);
        }
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 22px Arial';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 6;
        ctx.fillText(SECTORS[i].label, 0, 0);
        ctx.restore();
    }
    
    // Центр
    ctx.beginPath();
    ctx.arc(centerX, centerY, 25, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
}

// ============ ВЫБОР ВЫИГРЫША ============
function getWinIndex(isPaid) {
    const chances = isPaid ? PAID_CHANCES : FREE_CHANCES;
    const rand = Math.random() * 100;
    let cumulative = 0;
    
    for (let i = 0; i < chances.length; i++) {
        cumulative += chances[i];
        if (rand < cumulative) {
            console.log(`🎲 Выигрыш: ${SECTORS[i].value}G (сектор ${i})`);
            return i;
        }
    }
    return 0;
}

// ============ АНИМАЦИЯ ВРАЩЕНИЯ ============
function spinWheel(targetIndex) {
    return new Promise((resolve) => {
        if (isSpinning) return resolve();
        
        isSpinning = true;
        
        // Целевой угол - центр сектора
        const targetAngle = (targetIndex * 45 + 22.5) * Math.PI / 180;
        const spins = 8;
        const startAngle = currentRotation;
        
        let deltaAngle = (spins * Math.PI * 2) + targetAngle;
        deltaAngle = deltaAngle - (currentRotation % (Math.PI * 2));
        const finalAngle = currentRotation + deltaAngle;
        
        const startTime = performance.now();
        const duration = 3000;
        
        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentAngle = startAngle + (finalAngle - startAngle) * easeOut;
            
            drawWheel(currentAngle);
            
            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            } else {
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
async function handleSpin(isPaid) {
    if (isSpinning) {
        tg.showAlert('⏳ Барабан уже крутится!');
        return;
    }
    
    if (!isPaid && !checkFreeSpin()) {
        tg.showAlert('❌ Бесплатная крутка ещё недоступна!');
        return;
    }
    
    if (isPaid && balance < SPIN_COST) {
        tg.showAlert('❌ Недостаточно G!');
        return;
    }
    
    // Блокируем кнопки
    freeSpinBtn.disabled = true;
    paidSpinBtn.disabled = true;
    
    // Списываем плату
    if (isPaid) {
        balance -= SPIN_COST;
        updateBalanceUI();
    }
    
    // ВЫБИРАЕМ ВЫИГРЫШ
    const winIndex = getWinIndex(isPaid);
    const winAmount = SECTORS[winIndex].value;
    
    resultDisplay.innerHTML = '🎰 Крутим...';
    
    // КРУТИМ БАРАБАН
    await spinWheel(winIndex);
    
    // НАЧИСЛЯЕМ ВЫИГРЫШ
    balance += winAmount;
    updateBalanceUI();
    
    // Запоминаем время бесплатной крутки
    if (!isPaid) {
        lastFreeSpin = Date.now();
        localStorage.setItem(`lastFreeSpin_${user.id}`, lastFreeSpin);
    }
    
    // ПОКАЗЫВАЕМ РЕЗУЛЬТАТ
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
    if (!isSpinning) {
        paidSpinBtn.disabled = balance < SPIN_COST;
        checkFreeSpin();
    }
}

// ============ ВСПОМОГАТЕЛЬНЫЕ ============
function updateBalanceUI() {
    balanceEl.textContent = balance;
    localStorage.setItem(`balance_${user.id}`, balance);
    if (!isSpinning) paidSpinBtn.disabled = balance < SPIN_COST;
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
freeSpinBtn.addEventListener('click', () => handleSpin(false));
paidSpinBtn.addEventListener('click', () => handleSpin(true));

// Табы
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

// Таймер
setInterval(() => {
    if (!isSpinning) checkFreeSpin();
}, 60000);

// Старт
drawWheel(currentRotation);
paidSpinBtn.disabled = balance < SPIN_COST;

// Очистка
window.addEventListener('beforeunload', () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
});