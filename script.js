// Инициализация Telegram Web App
let tg = window.Telegram?.WebApp;

// Игровые данные
let gameData = {
    balance: 0, // Начальный баланс 0 G
    totalSpins: 0,
    totalWon: 0,
    maxWin: 0,
    wins: 0,
    lastFreeSpin: null, // Время последнего бесплатного спина
    freeSpinAvailable: true // Бесплатный спин доступен
};

// Призы на рулетке (только G)
const WHEEL_PRIZES = [
    { value: 1, chance: 40, text: '1 G', color: '#5d6d7e' },       // Обычный
    { value: 5, chance: 25, text: '5 G', color: '#2ecc71' },       // Необычный
    { value: 10, chance: 15, text: '10 G', color: '#3498db' },     // Редкий
    { value: 50, chance: 10, text: '50 G', color: '#9b59b6' },     // Эпический
    { value: 100, chance: 7, text: '100 G', color: '#f39c12' },    // Легендарный
    { value: 500, chance: 3, text: '500 G', color: '#e74c3c' }     // Джеко-пот
];

// Стоимость обычного спина
const SPIN_COST = 5;

// Время ожидания бесплатного спина (4 часа в миллисекундах)
const FREE_SPIN_COOLDOWN = 4 * 60 * 60 * 1000; // 4 часа

// Инициализация игры
function initGame() {
    console.log('🎡 Инициализация Golden Roulette...');
    
    if (tg) {
        // Разворачиваем на весь экран
        tg.expand();
        
        // Получаем данные пользователя из Telegram
        loadTelegramUserData();
        
        // Настраиваем haptic feedback
        if (tg.HapticFeedback) {
            window.haptic = tg.HapticFeedback;
        }
    }
    
    // Загружаем сохраненную игру
    loadSavedGame();
    
    // Инициализируем рулетку
    initWheel();
    
    // Инициализируем отображение шансов
    initChancesDisplay();
    
    // Настраиваем кнопки
    document.getElementById('spinBtn').addEventListener('click', () => spinWheel(false));
    document.getElementById('freeSpinBtn').addEventListener('click', () => spinWheel(true));
    
    // Обновляем UI
    updateUI();
    
    // Запускаем таймер бесплатного спина
    updateFreeSpinTimer();
    setInterval(updateFreeSpinTimer, 1000);
    
    console.log('✅ Игра готова! Баланс:', gameData.balance + ' G');
}

// Загрузка данных пользователя из Telegram
function loadTelegramUserData() {
    if (!tg || !tg.initDataUnsafe?.user) return;
    
    const user = tg.initDataUnsafe.user;
    
    // Устанавливаем имя пользователя
    document.getElementById('username').textContent = 
        user.first_name || user.username || 'Игрок';
    
    // Получаем аватарку пользователя
    if (user.photo_url) {
        const avatar = document.getElementById('userAvatar');
        avatar.innerHTML = `<img src="${user.photo_url}" alt="Avatar">`;
    }
}

// Загрузка сохраненной игры
function loadSavedGame() {
    try {
        const saved = localStorage.getItem('goldenRouletteSave');
        if (saved) {
            const parsed = JSON.parse(saved);
            gameData = { ...gameData, ...parsed };
            
            // Проверяем доступность бесплатного спина
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

// Сохранение игры
function saveGame() {
    try {
        localStorage.setItem('goldenRouletteSave', JSON.stringify(gameData));
        return true;
    } catch (e) {
        showNotification('❌ Ошибка сохранения');
        return false;
    }
}

// Инициализация рулетки
function initWheel() {
    const wheel = document.getElementById('wheel');
    wheel.innerHTML = '';
    
    const totalSectors = WHEEL_PRIZES.length;
    const sectorAngle = 360 / totalSectors;
    
    // Создаем секторы рулетки
    WHEEL_PRIZES.forEach((prize, index) => {
        const sector = document.createElement('div');
        sector.className = 'wheel-sector';
        sector.dataset.prize = prize.value;
        
        // Устанавливаем позицию и цвет
        const rotateAngle = index * sectorAngle;
        sector.style.transform = `rotate(${rotateAngle}deg)`;
        
        // Градиент для сектора
        const hue = index * (360 / totalSectors);
        sector.style.background = `linear-gradient(${rotateAngle + 90}deg, 
            ${prize.color} 0%, 
            ${darkenColor(prize.color, 30)} 100%)`;
        
        // Добавляем текст
        const span = document.createElement('span');
        span.innerHTML = prize.text;
        span.style.color = getContrastColor(prize.color);
        sector.appendChild(span);
        
        wheel.appendChild(sector);
    });
}

// Инициализация отображения шансов
function initChancesDisplay() {
    const chancesList = document.getElementById('chancesList');
    chancesList.innerHTML = '';
    
    WHEEL_PRIZES.forEach(prize => {
        const chanceItem = document.createElement('div');
        chanceItem.className = 'chance-item';
        chanceItem.innerHTML = `
            <span>${prize.text}</span>
            <span style="color: gold;">${prize.chance}%</span>
        `;
        chancesList.appendChild(chanceItem);
    });
}

// Обновление UI
function updateUI() {
    // Баланс
    document.getElementById('balance').textContent = gameData.balance;
    
    // Статистика
    document.getElementById('totalSpins').textContent = gameData.totalSpins;
    document.getElementById('totalWon').textContent = gameData.totalWon + ' G';
    document.getElementById('maxWin').textContent = gameData.maxWin + ' G';
    
    // Расчет удачи (% выигрышных спинов)
    const luck = gameData.totalSpins > 0 
        ? Math.round((gameData.wins / gameData.totalSpins) * 100) 
        : 0;
    document.getElementById('luck').textContent = luck + '%';
    
    // Обновляем кнопку спина
    updateSpinButton();
    
    // Обновляем кнопку бесплатного спина
    updateFreeSpinButton();
}

// Обновление кнопки спина
function updateSpinButton() {
    const spinBtn = document.getElementById('spinBtn');
    const canSpin = gameData.balance >= SPIN_COST;
    
    spinBtn.disabled = !canSpin;
    
    if (!canSpin) {
        spinBtn.innerHTML = `
            <i class="fas fa-lock"></i>
            НЕДОСТАТОЧНО G
        `;
    }
}

// Обновление кнопки бесплатного спина
function updateFreeSpinButton() {
    const freeSpinBtn = document.getElementById('freeSpinBtn');
    const timerElement = document.getElementById('freeSpinTimer');
    
    if (gameData.freeSpinAvailable) {
        freeSpinBtn.disabled = false;
        freeSpinBtn.innerHTML = `
            <i class="fas fa-play"></i>
            КРУТИТЬ БЕСПЛАТНО
        `;
        timerElement.textContent = 'Доступно сейчас';
        timerElement.style.color = 'gold';
    } else {
        freeSpinBtn.disabled = true;
        freeSpinBtn.innerHTML = `
            <i class="fas fa-clock"></i>
            ОЖИДАНИЕ...
        `;
    }
}

// Обновление таймера бесплатного спина
function updateFreeSpinTimer() {
    if (!gameData.lastFreeSpin || gameData.freeSpinAvailable) return;
    
    const now = Date.now();
    const timeSinceLastFreeSpin = now - gameData.lastFreeSpin;
    const timeLeft = FREE_SPIN_COOLDOWN - timeSinceLastFreeSpin;
    
    if (timeLeft <= 0) {
        gameData.freeSpinAvailable = true;
        updateFreeSpinButton();
        showNotification('🎁 Бесплатный спин снова доступен!');
        return;
    }
    
    // Форматируем оставшееся время
    const hours = Math.floor(timeLeft / (60 * 60 * 1000));
    const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
    
    const timerElement = document.getElementById('freeSpinTimer');
    timerElement.textContent = `Доступно через: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    timerElement.style.color = '#ff4444';
}

// Вращение рулетки
let isSpinning = false;

function spinWheel(isFree) {
    if (isSpinning) return;
    
    // Проверяем условия
    if (!isFree && gameData.balance < SPIN_COST) {
        showNotification('❌ Недостаточно G для спина!');
        return;
    }
    
    if (isFree && !gameData.freeSpinAvailable) {
        showNotification('⏳ Бесплатный спин еще не доступен!');
        return;
    }
    
    isSpinning = true;
    
    // Снимаем стоимость спина (если не бесплатный)
    if (!isFree) {
        gameData.balance -= SPIN_COST;
    } else {
        // Обновляем время последнего бесплатного спина
        gameData.lastFreeSpin = Date.now();
        gameData.freeSpinAvailable = false;
    }
    
    gameData.totalSpins++;
    
    // Обновляем UI
    updateUI();
    
    // Воспроизводим звук вращения
    playSound('spinSound');
    
    // Получаем случайный приз
    const prize = getRandomPrize();
    
    // Анимация вращения рулетки
    const wheel = document.getElementById('wheel');
    const spinBtn = document.getElementById('spinBtn');
    const freeSpinBtn = document.getElementById('freeSpinBtn');
    
    // Вычисляем угол остановки
    const prizeIndex = WHEEL_PRIZES.indexOf(prize);
    const sectorAngle = 360 / WHEEL_PRIZES.length;
    
    // Рулетка вращается по часовой стрелке
    // Делаем 5 полных оборотов + останавливаемся на призе
    const fullRotations = 5;
    const stopAngle = fullRotations * 360 + (prizeIndex * sectorAngle) + Math.random() * sectorAngle;
    
    // Сбрасываем трансформацию
    wheel.style.transition = 'none';
    wheel.style.transform = 'rotate(0deg)';
    
    // Ждем кадр для сброса
    requestAnimationFrame(() => {
        // Запускаем анимацию с плавным замедлением
        wheel.style.transition = 'transform 4s cubic-bezier(0.2, 0.8, 0.3, 1)';
        wheel.style.transform = `rotate(${stopAngle}deg)`;
        
        // Показываем результат через 4 секунды
        setTimeout(() => {
            processSpinResult(prize, isFree);
            isSpinning = false;
            updateUI();
            saveGame();
        }, 4000);
    });
}

// Получение случайного приза по шансам
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

// Обработка результата спина
function processSpinResult(prize, isFree) {
    const winAmount = prize.value;
    
    // Добавляем выигрыш
    gameData.balance += winAmount;
    gameData.totalWon += winAmount;
    
    // Считаем как выигрышный спин, если выиграли больше 1 G
    if (winAmount > 1) {
        gameData.wins++;
    }
    
    // Обновляем максимальный выигрыш
    if (winAmount > gameData.maxWin) {
        gameData.maxWin = winAmount;
    }
    
    // Показываем результат
    if (winAmount >= 100) {
        // Большой выигрыш
        playSound('winSound');
        showWinEffect();
        
        let message = '';
        if (winAmount === 500) {
            message = `🎉 ДЖЕКПОТ! Вы выиграли ${winAmount} G!`;
        } else if (winAmount === 100) {
            message = `💰 ОГРОМНЫЙ ВЫИГРЫШ! ${winAmount} G!`;
        } else {
            message = `🎊 Отлично! Выигрыш ${winAmount} G!`;
        }
        
        showNotification(message + (isFree ? ' (Бесплатный спин!)' : ''));
        
        // Вибрация для больших выигрышей
        if (window.haptic) {
            if (winAmount === 500) {
                window.haptic.notificationOccurred('success');
            } else {
                window.haptic.impactOccurred('heavy');
            }
        }
    } else if (winAmount > 5) {
        // Средний выигрыш
        playSound('winSound');
        showNotification(`🎯 Вы выиграли ${winAmount} G!` + (isFree ? ' (Бесплатный спин!)' : ''));
        
        if (window.haptic) {
            window.haptic.impactOccurred('medium');
        }
    } else {
        // Маленький выигрыш или проигрыш
        if (winAmount > 1) {
            playSound('winSound');
            showNotification(`👍 Выигрыш ${winAmount} G` + (isFree ? ' (Бесплатный спин!)' : ''));
        } else {
            playSound('loseSound');
            showNotification(`😔 Всего ${winAmount} G` + (isFree ? ' (Бесплатный спин!)' : ''));
        }
        
        if (window.haptic) {
            window.haptic.impactOccurred('light');
        }
    }
}

// Показать эффект выигрыша
function showWinEffect() {
    const effect = document.getElementById('winEffect');
    effect.style.display = 'block';
    
    setTimeout(() => {
        effect.style.display = 'none';
    }, 1000);
}

// Показать уведомление
function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.display = 'block';
    notification.style.animation = 'slideIn 0.3s ease';
    
    // Автоскрытие через 3 секунды
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 300);
    }, 3000);
}

// Воспроизведение звука
function playSound(soundId) {
    try {
        const sound = document.getElementById(soundId);
        if (sound) {
            sound.currentTime = 0;
            sound.volume = 0.5;
            sound.play().catch(e => console.log('Звук не воспроизведен:', e));
        }
    } catch (e) {
        // Игнорируем ошибки звука
    }
}

// Вспомогательные функции
function darkenColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    
    return "#" + (
        0x1000000 +
        (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)
    ).toString(16).slice(1);
}

function getContrastColor(hexcolor) {
    hexcolor = hexcolor.replace("#", "");
    const r = parseInt(hexcolor.substr(0, 2), 16);
    const g = parseInt(hexcolor.substr(2, 2), 16);
    const b = parseInt(hexcolor.substr(4, 2), 16);
    
    // Формула яркости
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    return brightness > 128 ? '#000000' : '#FFFFFF';
}

// Запуск игры при загрузке страницы
document.addEventListener('DOMContentLoaded', initGame);