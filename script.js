// Initialize Telegram Web App
let tg = window.Telegram?.WebApp;

// Game data
let gameData = {
    balance: 100,
    totalSpins: 0,
    totalWon: 0,
    maxWin: 0,
    wins: 0,
    lastFreeSpin: null,
    freeSpinAvailable: true
};

// 8 ПРИЗОВ НА КОЛЕСЕ - СТРОГО ПО ПОРЯДКУ
const WHEEL_PRIZES = [
    { value: 0, text: '0 G', color: '#5d6d7e', class: 'sector-0' },
    { value: 5, text: '5 G', color: '#2ecc71', class: 'sector-5' },
    { value: 10, text: '10 G', color: '#3498db', class: 'sector-10' },
    { value: 15, text: '15 G', color: '#9b59b6', class: 'sector-15' },
    { value: 25, text: '25 G', color: '#f39c12', class: 'sector-25' },
    { value: 50, text: '50 G', color: '#e74c3c', class: 'sector-50' },
    { value: 100, text: '100 G', color: '#e91e63', class: 'sector-100' },
    { value: 250, text: '250 G', color: '#00bcd4', class: 'sector-250' }
];

// Шансы для бесплатной крутки (В ТОЧНОСТИ КАК В ЗАДАНИИ)
const FREE_SPIN_CHANCES = [
    { value: 0, chance: 70.89 },
    { value: 5, chance: 15 },
    { value: 10, chance: 7.5 },
    { value: 15, chance: 4 },
    { value: 25, chance: 1.8 },
    { value: 50, chance: 0.7 },
    { value: 100, chance: 0.1 },
    { value: 250, chance: 0.01 }
];

// Шансы для платной крутки (В ТОЧНОСТИ КАК В ЗАДАНИИ)
const PAID_SPIN_CHANCES = [
    { value: 0, chance: 50 },
    { value: 5, chance: 17.4 },
    { value: 10, chance: 15 },
    { value: 15, chance: 10 },
    { value: 25, chance: 5 },
    { value: 50, chance: 2 },
    { value: 100, chance: 0.5 },
    { value: 250, chance: 0.1 }
];

// Spin costs
const FREE_SPIN_COST = 0;
const PAID_SPIN_COST = 10;
const FREE_SPIN_COOLDOWN = 4 * 60 * 60 * 1000;

// Initialize game
function initGame() {
    console.log('🎡 Инициализация...');
    
    if (tg) {
        tg.expand();
    }
    
    loadSavedGame();
    createWheel();
    setupEventListeners();
    updateUI();
    startTimer();
}

// Create wheel with 8 sectors
function createWheel() {
    const wheel = document.getElementById('wheel');
    wheel.innerHTML = '';
    
    const sectorAngle = 360 / 8; // 45 градусов
    
    WHEEL_PRIZES.forEach((prize, index) => {
        const sector = document.createElement('div');
        sector.className = `wheel-sector ${prize.class}`;
        
        const rotateAngle = index * sectorAngle;
        sector.style.transform = `rotate(${rotateAngle}deg)`;
        
        const span = document.createElement('span');
        span.innerHTML = prize.text;
        span.style.color = getContrastColor(prize.color);
        
        sector.appendChild(span);
        wheel.appendChild(sector);
    });
    
    console.log('✅ Колесо создано: 8 секторов');
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('spinBtn').onclick = () => spinWheel(false);
    document.getElementById('freeSpinBtn').onclick = () => spinWheel(true);
}

// Update UI
function updateUI() {
    document.getElementById('balance').textContent = gameData.balance;
    document.getElementById('goldAmount').textContent = gameData.balance + ' G';
    document.getElementById('spinCost').textContent = PAID_SPIN_COST;
    document.getElementById('totalSpins').textContent = gameData.totalSpins;
    document.getElementById('totalWon').textContent = gameData.totalWon + ' G';
    document.getElementById('maxWin').textContent = gameData.maxWin + ' G';
    
    const luckRate = gameData.totalSpins > 0 
        ? Math.round((gameData.wins / gameData.totalSpins) * 100) 
        : 0;
    document.getElementById('luckRate').textContent = luckRate + '%';
    
    document.getElementById('spinBtn').disabled = gameData.balance < PAID_SPIN_COST;
    document.getElementById('freeSpinBtn').disabled = !gameData.freeSpinAvailable;
}

// Load saved game
function loadSavedGame() {
    try {
        const saved = localStorage.getItem('goldBankSave');
        if (saved) {
            const parsed = JSON.parse(saved);
            gameData = { ...gameData, ...parsed };
            
            if (gameData.lastFreeSpin) {
                const now = Date.now();
                gameData.freeSpinAvailable = (now - gameData.lastFreeSpin) >= FREE_SPIN_COOLDOWN;
            }
        }
    } catch (e) {}
}

// Save game
function saveGame() {
    try {
        localStorage.setItem('goldBankSave', JSON.stringify(gameData));
    } catch (e) {}
}

// Start timer
function startTimer() {
    updateFreeSpinTimer();
    setInterval(updateFreeSpinTimer, 1000);
}

// Update timer
function updateFreeSpinTimer() {
    const timerElement = document.getElementById('freeSpinTimer');
    
    if (!gameData.lastFreeSpin || gameData.freeSpinAvailable) {
        timerElement.textContent = 'Доступно сейчас';
        timerElement.style.color = '#2ecc71';
        return;
    }
    
    const now = Date.now();
    const timeLeft = FREE_SPIN_COOLDOWN - (now - gameData.lastFreeSpin);
    
    if (timeLeft <= 0) {
        gameData.freeSpinAvailable = true;
        document.getElementById('freeSpinBtn').disabled = false;
        timerElement.textContent = 'Доступно сейчас';
        timerElement.style.color = '#2ecc71';
        showNotification('🎁 Бесплатный спин доступен!');
        return;
    }
    
    const hours = Math.floor(timeLeft / 3600000);
    const minutes = Math.floor((timeLeft % 3600000) / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    
    timerElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    timerElement.style.color = '#ff4444';
}

// Get random prize
function getRandomPrize(chances) {
    const totalChance = chances.reduce((sum, p) => sum + p.chance, 0);
    let random = Math.random() * totalChance;
    
    for (const prize of chances) {
        if (random < prize.chance) {
            return prize.value;
        }
        random -= prize.chance;
    }
    return 0;
}

// Spin wheel
let isSpinning = false;

function spinWheel(isFree) {
    if (isSpinning) return;
    
    const chances = isFree ? FREE_SPIN_CHANCES : PAID_SPIN_CHANCES;
    
    // Проверка баланса
    if (!isFree && gameData.balance < PAID_SPIN_COST) {
        showNotification('❌ Недостаточно G!');
        return;
    }
    
    if (isFree && !gameData.freeSpinAvailable) {
        showNotification('⏳ Бесплатный спин недоступен!');
        return;
    }
    
    isSpinning = true;
    
    // Списание
    if (!isFree) {
        gameData.balance -= PAID_SPIN_COST;
    } else {
        gameData.lastFreeSpin = Date.now();
        gameData.freeSpinAvailable = false;
    }
    
    gameData.totalSpins++;
    updateUI();
    
    // Получаем выигрыш
    const winAmount = getRandomPrize(chances);
    console.log(`🎯 Выпало: ${winAmount} G`);
    
    // Находим индекс на колесе
    const prizeIndex = WHEEL_PRIZES.findIndex(p => p.value === winAmount);
    console.log(`🎡 Сектор: ${prizeIndex} (${WHEEL_PRIZES[prizeIndex].text})`);
    
    // Вращаем колесо
    const wheel = document.getElementById('wheel');
    const sectorAngle = 360 / 8;
    
    // ПРОСТАЯ ФОРМУЛА: 5 оборотов + позиция сектора
    const stopAngle = 1800 + (prizeIndex * 45) + 22.5;
    
    wheel.style.transition = 'transform 3s';
    wheel.style.transform = `rotate(${stopAngle}deg)`;
    
    // Обработка результата
    setTimeout(() => {
        // Начисляем выигрыш
        if (winAmount > 0) {
            gameData.balance += winAmount;
            gameData.totalWon += winAmount;
            gameData.wins++;
            
            if (winAmount > gameData.maxWin) {
                gameData.maxWin = winAmount;
            }
        }
        
        // Показываем сообщение
        let message = '';
        if (winAmount === 250) message = '🏆 СУПЕР ДЖЕКПОТ! +250 G!';
        else if (winAmount === 100) message = '🎉 МЕГА ВЫИГРЫШ! +100 G!';
        else if (winAmount === 50) message = '💰 БОЛЬШОЙ ВЫИГРЫШ! +50 G!';
        else if (winAmount === 25) message = '🎊 Отлично! +25 G!';
        else if (winAmount === 15) message = '🎯 Хорошо! +15 G!';
        else if (winAmount === 10) message = '👍 Неплохо! +10 G!';
        else if (winAmount === 5) message = '👌 +5 G!';
        else message = '😔 Вы ничего не выиграли';
        
        if (isFree) message += ' (Бесплатно)';
        
        showNotification(message);
        
        if (winAmount >= 50) {
            showWinEffect();
            playSound('winSound');
        } else if (winAmount > 0) {
            playSound('winSound');
        } else {
            playSound('loseSound');
        }
        
        updateUI();
        saveGame();
        isSpinning = false;
    }, 3000);
}

// Show notification
function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Show win effect
function showWinEffect() {
    const effect = document.getElementById('winEffect');
    effect.style.display = 'block';
    
    setTimeout(() => {
        effect.style.display = 'none';
    }, 1000);
}

// Play sound
function playSound(soundId) {
    try {
        const sound = document.getElementById(soundId);
        if (sound) {
            sound.currentTime = 0;
            sound.volume = 0.3;
            sound.play();
        }
    } catch (e) {}
}

// Get contrast color
function getContrastColor(hexcolor) {
    hexcolor = hexcolor.replace("#", "");
    const r = parseInt(hexcolor.substr(0, 2), 16);
    const g = parseInt(hexcolor.substr(2, 2), 16);
    const b = parseInt(hexcolor.substr(4, 2), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 128 ? '#000000' : '#FFFFFF';
}

// Start game
document.addEventListener('DOMContentLoaded', initGame);