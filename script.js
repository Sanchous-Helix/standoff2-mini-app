// Initialize Telegram Web App
let tg = window.Telegram?.WebApp;

// Game data
let gameData = {
    balance: 0, // Gold balance
    totalSpins: 0,
    totalWon: 0,
    maxWin: 0,
    wins: 0,
    lastFreeSpin: null,
    freeSpinAvailable: true
};

// Wheel prizes (Gold only)
const WHEEL_PRIZES = [
    { value: 1, chance: 40, text: '1 G', color: '#5d6d7e', class: 'sector-1' },
    { value: 5, chance: 25, text: '5 G', color: '#2ecc71', class: 'sector-2' },
    { value: 10, chance: 15, text: '10 G', color: '#3498db', class: 'sector-3' },
    { value: 50, chance: 10, text: '50 G', color: '#9b59b6', class: 'sector-4' },
    { value: 100, chance: 7, text: '100 G', color: '#f39c12', class: 'sector-5' },
    { value: 500, chance: 3, text: '500 G', color: '#e74c3c', class: 'sector-6' }
];

// Spin cost
const SPIN_COST = 5;

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
    initChancesDisplay();
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

// Initialize wheel
function initWheel() {
    const wheel = document.getElementById('wheel');
    wheel.innerHTML = '';
    
    const totalSectors = WHEEL_PRIZES.length;
    const sectorAngle = 360 / totalSectors;
    
    WHEEL_PRIZES.forEach((prize, index) => {
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

// Initialize chances display
function initChancesDisplay() {
    const chancesList = document.getElementById('chancesList');
    chancesList.innerHTML = '';
    
    WHEEL_PRIZES.forEach(prize => {
        const chanceItem = document.createElement('div');
        chanceItem.className = 'chance-item';
        chanceItem.innerHTML = `
            <span class="chance-prize">${prize.text}</span>
            <span class="chance-percent">${prize.chance}%</span>
        `;
        chancesList.appendChild(chanceItem);
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
    spinBtn.disabled = gameData.balance < SPIN_COST;
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

function spinWheel(isFree) {
    if (isSpinning) return;
    
    if (!isFree && gameData.balance < SPIN_COST) {
        showNotification('❌ Недостаточно G для спина!');
        return;
    }
    
    if (isFree && !gameData.freeSpinAvailable) {
        showNotification('⏳ Бесплатный спин еще не доступен!');
        return;
    }
    
    isSpinning = true;
    
    if (!isFree) {
        gameData.balance -= SPIN_COST;
    } else {
        gameData.lastFreeSpin = Date.now();
        gameData.freeSpinAvailable = false;
    }
    
    gameData.totalSpins++;
    
    updateUI();
    playSound('spinSound');
    
    // Get random prize BEFORE spinning
    const prize = getRandomPrize();
    const prizeIndex = WHEEL_PRIZES.indexOf(prize);
    
    // Log for debugging
    console.log(`🎯 Selected prize: ${prize.text}, index: ${prizeIndex}`);
    
    // Show the selected prize immediately (optional, for debugging)
    // showNotification(`🎰 Выбран приз: ${prize.text}`);
    
    const wheel = document.getElementById('wheel');
    
    // Calculate stop position so pointer points to selected sector
    const totalSectors = WHEEL_PRIZES.length;
    const sectorAngle = 360 / totalSectors;
    
    // Pointer is at top (0 degrees), we need to rotate wheel so that
    // the selected sector ends up at pointer position (just past the top)
    
    // Each sector occupies sectorAngle degrees
    // We want the selected sector to be centered at pointer
    // Since pointer is at 0 degrees, we need to rotate the wheel
    // so that selected sector's center is at 180 degrees (bottom)
    // and then rotate back a little so it stops just past pointer
    
    const fullRotations = 5; // Number of full spins before stopping
    const pointerOffset = -90; // Pointer is at top (0 degrees), but we want sector center at pointer
    
    // Calculate exact stop angle
    // We want the wheel to stop with selected sector at pointer
    // The calculation: rotate full circles + position sector at pointer - half sector to center it
    const stopAngle = (fullRotations * 360) + 
                      ((totalSectors - prizeIndex) * sectorAngle) + 
                      (sectorAngle / 2) + 
                      pointerOffset;
    
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
        processSpinResult(prize, isFree);
        isSpinning = false;
        updateUI();
        saveGame();
        
        // Debug: check which sector is at pointer
        const finalRotation = stopAngle % 360;
        const sectorAtPointer = Math.floor(((360 - finalRotation) % 360) / sectorAngle);
        console.log(`📍 Final rotation: ${finalRotation.toFixed(1)}°, Sector at pointer: ${sectorAtPointer}, Expected: ${prizeIndex}`);
    }, 4000);
}

// Get random prize
function getRandomPrize() {
    const totalChance = WHEEL_PRIZES.reduce((sum, prize) => sum + prize.chance, 0);
    let random = Math.random() * totalChance;
    
    for (const prize of WHEEL_PRIZES) {
        if (random < prize.chance) {
            return prize;
        }
        random -= prize.chance;
    }
    
    return WHEEL_PRIZES[0];
}

// Process spin result
function processSpinResult(prize, isFree) {
    const winAmount = prize.value;
    
    gameData.balance += winAmount;
    gameData.totalWon += winAmount;
    
    if (winAmount > 1) {
        gameData.wins++;
    }
    
    if (winAmount > gameData.maxWin) {
        gameData.maxWin = winAmount;
    }
    
    // Show result
    let message = '';
    
    if (winAmount === 500) {
        message = `🎉 ДЖЕКПОТ! Вы выиграли ${winAmount} G!`;
        playSound('winSound');
        showWinEffect();
    } else if (winAmount >= 100) {
        message = `💰 ОГРОМНЫЙ ВЫИГРЫШ! ${winAmount} G!`;
        playSound('winSound');
        showWinEffect();
    } else if (winAmount >= 50) {
        message = `🎊 Отлично! Выигрыш ${winAmount} G!`;
        playSound('winSound');
    } else if (winAmount >= 10) {
        message = `🎯 Хорошо! Выигрыш ${winAmount} G!`;
        playSound('winSound');
    } else if (winAmount >= 5) {
        message = `👍 Неплохо! Выигрыш ${winAmount} G!`;
        playSound('winSound');
    } else {
        message = `😔 Выигрыш ${winAmount} G`;
        playSound('loseSound');
    }
    
    if (isFree) {
        message += ' (Бесплатный спин!)';
    }
    
    showNotification(message);
    
    // Haptic feedback
    if (window.haptic) {
        if (winAmount >= 100) {
            window.haptic.impactOccurred('heavy');
        } else if (winAmount >= 10) {
            window.haptic.impactOccurred('medium');
        } else {
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
    }, 3000);
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