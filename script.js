// Инициализация Telegram
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ============ АВАРИЙНАЯ ОЧИСТКА ============
const APP_VERSION = '2.0';
const VERSION_KEY = 'standoff_roulette_version';

if (localStorage.getItem(VERSION_KEY) !== APP_VERSION) {
    localStorage.clear();
    localStorage.setItem(VERSION_KEY, APP_VERSION);
    console.log('✨ Полный сброс данных');
}

// ============ КОНФИГУРАЦИЯ - СТАБИЛЬНАЯ ============
const SECTORS = [
    { value: 0, color: '#e74c3c', label: '0' },     // 0°
    { value: 5, color: '#e67e22', label: '5' },     // 45°
    { value: 10, color: '#f1c40f', label: '10' },   // 90°
    { value: 15, color: '#2ecc71', label: '15' },   // 135°
    { value: 25, color: '#3498db', label: '25' },   // 180°
    { value: 50, color: '#9b59b6', label: '50' },   // 225°
    { value: 100, color: '#e84342', label: '100' }, // 270°
    { value: 250, color: '#c0392b', label: '250' }  // 315°
];

// Шансы для бесплатной крутки
const FREE_CHANCES = [
    70.89,  // 0G
    15,     // 5G
    7.5,    // 10G
    4,      // 15G
    1.8,    // 25G
    0.7,    // 50G
    0.1,    // 100G
    0.01    // 250G
];

// Шансы для платной крутки
const PAID_CHANCES = [
    50,     // 0G
    17.4,   // 5G
    15,     // 10G
    10,     // 15G
    5,      // 25G
    2,      // 50G
    0.5,    // 100G
    0.1     // 250G
];

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
    id: 'guest_' + Math.floor(Math.random() * 1000000)
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

// ============ НОВАЯ СИСТЕМА СОХРАНЕНИЯ ============
function saveGameData() {
    const gameData = {
        balance: balance,
        lastFreeSpin: lastFreeSpin,
        version: APP_VERSION
    };
    localStorage.setItem(`standoff_${user.id}`, JSON.stringify(gameData));
    console.log('💾 Сохранено:', gameData);
}

function loadGameData() {
    const saved = localStorage.getItem(`standoff_${user.id}`);
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (data.version === APP_VERSION) {
                balance = data.balance || 100;
                lastFreeSpin = data.lastFreeSpin || null;
                console.log('📂 Загружено:', data);
            } else {
                console.log('🆕 Устаревшие данные, используем дефолт');
            }
        } catch (e) {
            console.error('❌ Ошибка загрузки');
        }
    }
}

// Загружаем данные
loadGameData();

// Сохраняем при выходе
window.addEventListener('beforeunload', () => {
    saveGameData();
});

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
}

// ============ ВЫБОР ВЫИГРЫША ============
function getWinIndex(isPaid) {
    const chances = isPaid ? PAID_CHANCES : FREE_CHANCES;
    const rand = Math.random() * 100;
    let cumulative = 0;
    
    for (let i = 0; i < chances.length; i++) {
        cumulative += chances[i];
        if (rand < cumulative) {
            const winValue = SECTORS[i].value;
            console.log(`🎲 Выигрыш: ${winValue}G (сектор ${i}, шанс ${chances[i]}%)`);
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
    
    freeSpinBtn.disabled = true;
    paidSpinBtn.disabled = true;
    
    if (isPaid) {
        balance -= SPIN_COST;
        updateBalanceUI();
    }
    
    const winIndex = getWinIndex(isPaid);
    const winAmount = SECTORS[winIndex].value;
    
    resultDisplay.innerHTML = '🎰 Крутим...';
    await spinWheel(winIndex);
    
    balance += winAmount;
    updateBalanceUI();
    
    if (!isPaid) {
        lastFreeSpin = Date.now();
    }
    
    saveGameData();
    
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

// ============ ВСПОМОГАТЕЛЬНЫЕ ============
function updateBalanceUI() {
    balanceEl.textContent = balance;
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
freeSpinBtn.addEventListener('click', () => handleSpin(false));
paidSpinBtn.addEventListener('click', () => handleSpin(true));

// Табы
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        document.querySelectorAll('.chances-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(this.dataset.tab === 'free' ? 'freeChances' : 'paidChances').classList.add('active');
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
    saveGameData();
});