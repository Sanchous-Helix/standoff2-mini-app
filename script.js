// Initialize Telegram Web App
let tg = window.Telegram?.WebApp;

// Game data
let gameData = {
    balance: 100, // Начальный баланс для теста
    totalSpins: 0,
    totalWon: 0,
    maxWin: 0,
    wins: 0,
    lastFreeSpin: null,
    freeSpinAvailable: true
};

// Шансы для бесплатной крутки
const FREE_SPIN_PRIZES = [
    { value: 0, chance: 70.89, text: '0 G', color: '#5d6d7e', class: 'sector-0' },
    { value: 5, chance: 15, text: '5 G', color: '#2ecc71', class: 'sector-5' },
    { value: 10, chance: 7.5, text: '10 G', color: '#3498db', class: 'sector-10' },
    { value: 15, chance: 4, text: '15 G', color: '#9b59b6', class: 'sector-15' },
    { value: 25, chance: 1.8, text: '25 G', color: '#f39c12', class: 'sector-25' },
    { value: 50, chance: 0.7, text: '50 G', color: '#e74c3c', class: 'sector-50' },
    { value: 100, chance: 0.1, text: '100 G', color: '#e91e63', class: 'sector-100' },
    { value: 250, chance: 0.01, text: '250 G', color: '#00bcd4', class: 'sector-250' }
];

// Шансы для платной крутки (за 10 G)
const PAID_SPIN_PRIZES = [
    { value: 0, chance: 50, text: '0 G', color: '#5d6d7e', class: 'sector-0' },
    { value: 5, chance: 17.4, text: '5 G', color: '#2ecc71', class: 'sector-5' },
    { value: 10, chance: 15, text: '10 G', color: '#3498db', class: 'sector-10' },
    { value: 15, chance: 10, text: '15 G', color: '#9b59b6', class: 'sector-15' },
    { value: 25, chance: 5, text: '25 G', color: '#f39c12', class: 'sector-25' },
    { value: 50, chance: 2, text: '50 G', color: '#e74c3c', class: 'sector-50' },
    { value: 100, chance: 0.5, text: '100 G', color: '#e91e63', class: 'sector-100' },
    { value: 250, chance: 0.1, text: '250 G', color: '#00bcd4', class: 'sector-250' }
];

// Все призы для отображения на колесе (должны соответствовать WHEEL_PRIZES_DISPLAY)
const WHEEL_PRIZES_DISPLAY = [
    { value: 0, text: 'ПРОИГРЫШ', color: '#5d6d7e', class: 'sector-0' },
    { value: 5, text: '5 G', color: '#2ecc71', class: 'sector-5' },
    { value: 10, text: '10 G', color: '#3498db', class: 'sector-10' },
    { value: 15, text: '15 G', color: '#9b59b6', class: 'sector-15' },
    { value: 25, text: '25 G', color: '#f39c12', class: 'sector-25' },
    { value: 50, text: '50 G', color: '#e74c3c', class: 'sector-50' },
    { value: 100, text: '100 G', color: '#e91e63', class: 'sector-100' },
    { value: 250, text: '250 G', color: '#00bcd4', class: 'sector-250' }
];

// Spin costs
const FREE_SPIN_COST = 0;
const PAID_SPIN_COST = 10;

// Free spin cooldown (4 hours in milliseconds)
const FREE_SPIN_COOLDOWN = 4 * 60 * 60 * 1000;

// Initialize game
function initGame() {
    console.log('🎡 Initializing GoldBank Roulette...');
    
    if (tg) {
        tg.expand();
        loadTelegramUserData();
        
        if (tg.HapticFeedback) {
            window.haptic = tg.HapticFeedback;
        }
    }
    
    loadSavedGame();
    initWheel();
    setupEventListeners();
    updateUI();
    startTimer();
    
    console.log('✅ Game ready! Balance:', gameData.balance + ' G');
}

// Load Telegram user data
function loadTelegramUserData() {
    if (!tg || !tg.initDataUnsafe?.user) return;
    
    const user = tg.initDataUnsafe.user;
    
    document.getElementById('username').textContent = 
        user.first_name || user.username || 'Игрок';
    
    if (user.photo_url) {
        const avatar = document.getElementById('userAvatar');
        avatar.innerHTML = `<img src="${user.photo_url}" alt="Avatar">`;
    }
}

// Load saved game
function loadSavedGame() {
    try {
        const saved = localStorage.getItem('goldBankRouletteSave');
        if (saved) {
            const parsed = JSON.parse(saved);
            gameData = { ...gameData, ...parsed };
            
            if (gameData.lastFreeSpin) {
                const now = Date.now();
                const timeSinceLastFreeSpin = now - gameData.lastFreeSpin;
                gameData.freeSpinAvailable = timeSinceLastFreeSpin >= FREE_SPIN_COOLDOWN;
            }
            
            console.log('🎮 Game loaded from save');
        }
    } catch (e) {
        console.error('❌ Load error:', e);
    }
}

// Save game
function saveGame() {
    try {
        localStorage.setItem('goldBankRouletteSave', JSON.stringify(gameData));
        return true;
    } catch (e) {
        showNotification('❌ Ошибка сохранения');
        return false;
    }
}

// Initialize wheel with equal sectors
function initWheel() {
    const wheel = document.getElementById('wheel');
    wheel.innerHTML = '';
    
    const totalSectors = WHEEL_PRIZES_DISPLAY.length;
    const sectorAngle = 360 / totalSectors;
    
    WHEEL_PRIZES_DISPLAY.forEach((prize, index) => {
        const sector = document.createElement('div');
        sector.className = `wheel-sector ${prize.class}`;
        sector.dataset.prize = prize.value;
        sector.dataset.index = index;
        
        const rotateAngle = index * sectorAngle;
        sector.style.transform = `rotate(${rotateAngle}deg)`;
        
        const span = document.createElement('span');
        span.innerHTML = prize.text;
        span.style.color = getContrastColor(prize.color);
        sector.appendChild(span);
        
        wheel.appendChild(sector);
    });
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('spinBtn').addEventListener('click', () => spinWheel(false));
    document.getElementById('freeSpinBtn').addEventListener('click', () => spinWheel(true));
}

// Update UI
function updateUI() {
    // Balance
    document.getElementById('balance').textContent = gameData.balance;
    document.getElementById('goldAmount').textContent = gameData.balance + ' G';
    
    // Update spin cost display
    document.getElementById('spinCost').textContent = PAID_SPIN_COST;
    
    // Stats
    document.getElementById('totalSpins').textContent = gameData.totalSpins;
    document.getElementById('totalWon').textContent = gameData.totalWon + ' G';
    document.getElementById('maxWin').textContent = gameData.maxWin + ' G';
    
    const luckRate = gameData.totalSpins > 0 
        ? Math.round((gameData.wins / gameData.totalSpins) * 100) 
        : 0;
    document.getElementById('luckRate').textContent = luckRate + '%';
    
    // Update buttons
    updateSpinButton();
    updateFreeSpinButton();
}

// Update spin button
function updateSpinButton() {
    const spinBtn = document.getElementById('spinBtn');
    spinBtn.disabled = gameData.balance < PAID_SPIN_COST;
}

// Update free spin button
function updateFreeSpinButton() {
    const freeSpinBtn = document.getElementById('freeSpinBtn');
    freeSpinBtn.disabled = !gameData.freeSpinAvailable;
}

// Start timer for free spin
function startTimer() {
    updateFreeSpinTimer();
    setInterval(updateFreeSpinTimer, 1000);
}

// Update free spin timer
function updateFreeSpinTimer() {
    const timerElement = document.getElementById('freeSpinTimer');
    
    if (!gameData.lastFreeSpin || gameData.freeSpinAvailable) {
        timerElement.textContent = 'Доступно сейчас';
        timerElement.style.color = '#2ecc71';
        return;
    }
    
    const now = Date.now();
    const timeSinceLastFreeSpin = now - gameData.lastFreeSpin;
    const timeLeft = FREE_SPIN_COOLDOWN - timeSinceLastFreeSpin;
    
    if (timeLeft <= 0) {
        gameData.freeSpinAvailable = true;
        updateFreeSpinButton();
        timerElement.textContent = 'Доступно сейчас';
        timerElement.style.color = '#2ecc71';
        showNotification('🎁 Бесплатный спин доступен!');
        return;
    }
    
    const hours = Math.floor(timeLeft / (60 * 60 * 1000));
    const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
    
    timerElement.textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    timerElement.style.color = '#ff4444';
}

// Spin wheel
let isSpinning = false;
let currentPrize = null;

function spinWheel(isFree) {
    if (isSpinning) return;
    
    const spinCost = isFree ? FREE_SPIN_COST : PAID_SPIN_COST;
    const prizePool = isFree ? FREE_SPIN_PRIZES : PAID_SPIN_PRIZES;
    
    if (!isFree && gameData.balance < spinCost) {
        showNotification(`❌ Недостаточно G для спина! Нужно ${spinCost} G`);
        return;
    }
    
    if (isFree && !gameData.freeSpinAvailable) {
        showNotification('⏳ Бесплатный спин еще не доступен!');
        return;
    }
    
    isSpinning = true;
    
    if (!isFree) {
        gameData.balance -= spinCost;
    } else {
        gameData.lastFreeSpin = Date.now();
        gameData.freeSpinAvailable = false;
    }
    
    gameData.totalSpins++;
    
    updateUI();
    playSound('spinSound');
    
    // Get random prize BEFORE spinning
    currentPrize = getRandomPrize(prizePool);
    console.log(`🎯 Выбран приз: ${currentPrize.text}, значение: ${currentPrize.value}`);
    
    // Найти индекс этого приза на колесе (по значению)
    let prizeIndex = WHEEL_PRIZES_DISPLAY.findIndex(p => p.value === currentPrize.value);
    
    // Если индекс не найден (должен всегда находиться)
    if (prizeIndex === -1) {
        console.error('❌ Приз не найден на колесе:', currentPrize);
        prizeIndex = 0; // По умолчанию проигрыш
    }
    
    console.log(`🎡 Индекс приза на колесе: ${prizeIndex} (${WHEEL_PRIZES_DISPLAY[prizeIndex].text})`);
    
    const wheel = document.getElementById('wheel');
    const totalSectors = WHEEL_PRIZES_DISPLAY.length;
    const sectorAngle = 360 / totalSectors;
    
    // Количество полных оборотов
    const fullRotations = 5;
    
    // Рассчитываем угол остановки так, чтобы нужный сектор оказался ПОД указателем
    // Указатель находится наверху (0 градусов)
    // Нам нужно повернуть колесо так, чтобы сектор с индексом prizeIndex оказался сверху
    
    // Каждый сектор занимает sectorAngle градусов
    // Мы хотим, чтобы указатель указывал на ВЕРХ сектора (начало сектора)
    const stopAngle = (fullRotations * 360) + 
                      (360 - (prizeIndex * sectorAngle)) + 
                      (sectorAngle / 2); // Смещаем немного, чтобы сектор был под указателем
    
    // Reset wheel position
    wheel.style.transition = 'none';
    wheel.style.transform = 'rotate(0deg)';
    
    // Force reflow
    void wheel.offsetWidth;
    
    // Start spinning animation
    wheel.style.transition = 'transform 4s cubic-bezier(0.2, 0.8, 0.3, 1)';
    wheel.style.transform = `rotate(${stopAngle}deg)`;
    
    // Process result after spin completes
    setTimeout(() => {
        processSpinResult(currentPrize, isFree);
        isSpinning = false;
        updateUI();
        saveGame();
        
        // Проверка: какой сектор под указателем
        const finalRotation = stopAngle % 360;
        const sectorAtPointer = Math.floor((finalRotation % 360) / sectorAngle);
        const actualSectorIndex = (totalSectors - sectorAtPointer) % totalSectors;
        
        console.log(`📍 Конечный поворот: ${finalRotation.toFixed(1)}°`);
        console.log(`📍 Сектор под указателем: ${actualSectorIndex} (${WHEEL_PRIZES_DISPLAY[actualSectorIndex].text})`);
        console.log(`📍 Ожидался сектор: ${prizeIndex} (${WHEEL_PRIZES_DISPLAY[prizeIndex].text})`);
        
        if (actualSectorIndex !== prizeIndex) {
            console.warn('⚠️ Внимание: сектор под указателем не соответствует ожидаемому!');
        }
    }, 4000);
}

// Get random prize from specified pool
function getRandomPrize(prizePool) {
    const totalChance = prizePool.reduce((sum, prize) => sum + prize.chance, 0);
    let random = Math.random() * totalChance;
    
    for (const prize of prizePool) {
        if (random < prize.chance) {
            return {
                value: prize.value,
                text: prize.text,
                color: prize.color,
                class: prize.class
            };
        }
        random -= prize.chance;
    }
    
    return {
        value: prizePool[0].value,
        text: prizePool[0].text,
        color: prizePool[0].color,
        class: prizePool[0].class
    };
}

// Process spin result
function processSpinResult(prize, isFree) {
    const winAmount = prize.value;
    
    if (winAmount > 0) {
        gameData.balance += winAmount;
        gameData.totalWon += winAmount;
        gameData.wins++;
    }
    
    if (winAmount > gameData.maxWin) {
        gameData.maxWin = winAmount;
    }
    
    // Show result
    let message = '';
    
    if (winAmount === 250) {
        message = `🏆 СУПЕР ДЖЕКПОТ! Вы выиграли ${winAmount} G!`;
        playSound('winSound');
        showWinEffect();
    } else if (winAmount === 100) {
        message = `🎉 МЕГА ВЫИГРЫШ! ${winAmount} G!`;
        playSound('winSound');
        showWinEffect();
    } else if (winAmount === 50) {
        message = `💰 БОЛЬШОЙ ВЫИГРЫШ! ${winAmount} G!`;
        playSound('winSound');
        showWinEffect();
    } else if (winAmount === 25) {
        message = `🎊 Отлично! Выигрыш ${winAmount} G!`;
        playSound('winSound');
    } else if (winAmount === 15) {
        message = `🎯 Хорошо! Выигрыш ${winAmount} G!`;
        playSound('winSound');
    } else if (winAmount === 10) {
        message = `👍 Неплохо! Выигрыш ${winAmount} G!`;
        playSound('winSound');
    } else if (winAmount === 5) {
        message = `👌 Хороший старт! Выигрыш ${winAmount} G!`;
        playSound('winSound');
    } else if (winAmount === 0) {
        message = `😔 К сожалению, вы ничего не выиграли`;
        playSound('loseSound');
    }
    
    // Добавляем информацию о том, что показано на колесе
    message += ` (На колесе: ${WHEEL_PRIZES_DISPLAY.find(p => p.value === winAmount)?.text || '0 G'})`;
    
    if (isFree) {
        message += ' - Бесплатный спин!';
    }
    
    showNotification(message);
    
    // Haptic feedback
    if (window.haptic) {
        if (winAmount >= 100) {
            window.haptic.impactOccurred('heavy');
        } else if (winAmount >= 25) {
            window.haptic.impactOccurred('medium');
        } else if (winAmount > 0) {
            window.haptic.impactOccurred('light');
        }
    }
}

// Show win effect
function showWinEffect() {
    const effect = document.getElementById('winEffect');
    effect.style.display = 'block';
    
    setTimeout(() => {
        effect.style.display = 'none';
    }, 1000);
}

// Show notification
function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.display = 'block';
    notification.style.animation = 'slideIn 0.3s ease';
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 300);
    }, 4000);
}

// Play sound
function playSound(soundId) {
    try {
        const sound = document.getElementById(soundId);
        if (sound) {
            sound.currentTime = 0;
            sound.volume = 0.3;
            sound.play().catch(e => console.log('Sound error:', e));
        }
    } catch (e) {
        // Ignore sound errors
    }
}

// Helper function for contrast color
function getContrastColor(hexcolor) {
    hexcolor = hexcolor.replace("#", "");
    const r = parseInt(hexcolor.substr(0, 2), 16);
    const g = parseInt(hexcolor.substr(2, 2), 16);
    const b = parseInt(hexcolor.substr(4, 2), 16);
    
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#FFFFFF';
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', initGame);