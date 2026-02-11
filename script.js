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

// Призы, которые отображаются на колесе (8 равных секторов)
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

// Шансы для бесплатной крутки (ТОЧНО как вы указали)
const FREE_SPIN_CHANCES = {
    0: 70.89,   // 0 G
    5: 15,      // 5 G
    10: 7.5,    // 10 G
    15: 4,      // 15 G
    25: 1.8,    // 25 G
    50: 0.7,    // 50 G
    100: 0.1,   // 100 G
    250: 0.01   // 250 G
};

// Шансы для платной крутки за 10 G (ТОЧНО как вы указали)
const PAID_SPIN_CHANCES = {
    0: 50,      // 0 G
    5: 17.4,    // 5 G
    10: 15,     // 10 G
    15: 10,     // 15 G
    25: 5,      // 25 G
    50: 2,      // 50 G
    100: 0.5,   // 100 G
    250: 0.1    // 250 G
};

// Проверка суммы вероятностей
function validateChances(chances) {
    const sum = Object.values(chances).reduce((a, b) => a + b, 0);
    console.log(`Сумма вероятностей: ${sum}%`);
    return Math.abs(sum - 100) < 0.01;
}

// Spin costs
const FREE_SPIN_COST = 0;
const PAID_SPIN_COST = 10;

// Free spin cooldown (4 hours in milliseconds)
const FREE_SPIN_COOLDOWN = 4 * 60 * 60 * 1000;

// Initialize game
function initGame() {
    console.log('🎡 Инициализация GoldBank Roulette...');
    
    // Проверяем вероятности
    console.log('✅ Проверка шансов для бесплатной крутки:', validateChances(FREE_SPIN_CHANCES));
    console.log('✅ Проверка шансов для платной крутки:', validateChances(PAID_SPIN_CHANCES));
    
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
    
    console.log('✅ Игра готова! Баланс:', gameData.balance + ' G');
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
            
            console.log('🎮 Игра загружена из сохранения');
        }
    } catch (e) {
        console.error('❌ Ошибка загрузки:', e);
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

// Initialize wheel with 8 equal sectors
function initWheel() {
    const wheel = document.getElementById('wheel');
    wheel.innerHTML = '';
    
    const totalSectors = WHEEL_PRIZES.length;
    const sectorAngle = 360 / totalSectors;
    
    WHEEL_PRIZES.forEach((prize, index) => {
        const sector = document.createElement('div');
        sector.className = `wheel-sector ${prize.class}`;
        sector.dataset.value = prize.value;
        sector.dataset.index = index;
        
        const rotateAngle = index * sectorAngle;
        sector.style.transform = `rotate(${rotateAngle}deg)`;
        
        const span = document.createElement('span');
        span.innerHTML = prize.text;
        span.style.color = getContrastColor(prize.color);
        sector.appendChild(span);
        
        wheel.appendChild(sector);
    });
    
    console.log('✅ Колесо создано с 8 секторами:', WHEEL_PRIZES.map(p => p.text).join(', '));
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

// Get random prize based on chances
function getRandomPrize(chances) {
    // Преобразуем объект в массив для удобства
    const prizes = Object.keys(chances).map(value => ({
        value: parseInt(value),
        chance: chances[value]
    }));
    
    const totalChance = prizes.reduce((sum, prize) => sum + prize.chance, 0);
    let random = Math.random() * totalChance;
    
    for (const prize of prizes) {
        if (random < prize.chance) {
            return prize.value;
        }
        random -= prize.chance;
    }
    
    return 0; // По умолчанию проигрыш
}

// Spin wheel
let isSpinning = false;

function spinWheel(isFree) {
    if (isSpinning) return;
    
    const spinCost = isFree ? FREE_SPIN_COST : PAID_SPIN_COST;
    const chances = isFree ? FREE_SPIN_CHANCES : PAID_SPIN_CHANCES;
    
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
    
    // Получаем случайный выигрыш
    const winAmount = getRandomPrize(chances);
    console.log(`🎯 Случайный выигрыш: ${winAmount} G (${isFree ? 'бесплатный' : 'платный'} спин)`);
    
    // Находим индекс этого приза на колесе
    const prizeIndex = WHEEL_PRIZES.findIndex(p => p.value === winAmount);
    
    if (prizeIndex === -1) {
        console.error('❌ Ошибка: приз не найден на колесе!', winAmount);
        isSpinning = false;
        return;
    }
    
    console.log(`🎡 Индекс на колесе: ${prizeIndex} (${WHEEL_PRIZES[prizeIndex].text})`);
    
    // Вращаем колесо
    rotateWheelToPrize(prizeIndex, () => {
        processSpinResult(winAmount, isFree);
        isSpinning = false;
        updateUI();
        saveGame();
    });
}

// Rotate wheel to specific prize index
function rotateWheelToPrize(prizeIndex, callback) {
    const wheel = document.getElementById('wheel');
    const totalSectors = WHEEL_PRIZES.length;
    const sectorAngle = 360 / totalSectors;
    
    // Количество полных оборотов
    const fullRotations = 5;
    
    // Рассчитываем угол остановки
    // Указатель находится наверху (0 градусов)
    // Нужно чтобы сектор prizeIndex оказался под указателем
    // Формула: полные обороты + позиционирование нужного сектора под указателем
    const stopAngle = (fullRotations * 360) + (360 - (prizeIndex * sectorAngle)) + (sectorAngle / 2);
    
    // Reset wheel position
    wheel.style.transition = 'none';
    wheel.style.transform = 'rotate(0deg)';
    
    // Force reflow
    void wheel.offsetWidth;
    
    // Start spinning animation
    wheel.style.transition = 'transform 3s cubic-bezier(0.2, 0.8, 0.3, 1)';
    wheel.style.transform = `rotate(${stopAngle}deg)`;
    
    // Callback after animation completes
    setTimeout(callback, 3000);
}

// Process spin result
function processSpinResult(winAmount, isFree) {
    // Обновляем статистику
    if (winAmount > 0) {
        gameData.balance += winAmount;
        gameData.totalWon += winAmount;
        gameData.wins++;
    }
    
    if (winAmount > gameData.maxWin) {
        gameData.maxWin = winAmount;
    }
    
    // Показываем уведомление
    let message = '';
    const prizeText = WHEEL_PRIZES.find(p => p.value === winAmount)?.text || '0 G';
    
    switch (winAmount) {
        case 250:
            message = `🏆 СУПЕР ДЖЕКПОТ! Вы выиграли ${winAmount} G!`;
            playSound('winSound');
            showWinEffect();
            break;
        case 100:
            message = `🎉 МЕГА ВЫИГРЫШ! ${winAmount} G!`;
            playSound('winSound');
            showWinEffect();
            break;
        case 50:
            message = `💰 БОЛЬШОЙ ВЫИГРЫШ! ${winAmount} G!`;
            playSound('winSound');
            showWinEffect();
            break;
        case 25:
            message = `🎊 Отлично! Выигрыш ${winAmount} G!`;
            playSound('winSound');
            break;
        case 15:
            message = `🎯 Хорошо! Выигрыш ${winAmount} G!`;
            playSound('winSound');
            break;
        case 10:
            message = `👍 Неплохо! Выигрыш ${winAmount} G!`;
            playSound('winSound');
            break;
        case 5:
            message = `👌 Хороший старт! Выигрыш ${winAmount} G!`;
            playSound('winSound');
            break;
        case 0:
            message = `😔 К сожалению, вы ничего не выиграли`;
            playSound('loseSound');
            break;
        default:
            message = `🎰 Вы выиграли ${winAmount} G!`;
            playSound('winSound');
    }
    
    // Добавляем информацию о типе спина
    if (isFree) {
        message += ' (Бесплатный спин)';
    }
    
    showNotification(message);
    
    // Вибрация (для мобильных устройств)
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