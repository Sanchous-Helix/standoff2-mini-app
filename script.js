// Инициализация Telegram Web App
let tg = window.Telegram?.WebApp;

// Игровые данные
let gameData = {
    balance: 1000, // GC
    totalSpins: 0,
    totalWon: 0,
    maxWin: 0,
    currentBet: 100,
    wins: 0
};

// Призы на рулетке (только GC)
const WHEEL_PRIZES = [
    { value: 1, color: '#5d6d7e', chance: 30, text: '50 GC' },    // Обычный
    { value: 5, color: '#2ecc71', chance: 25, text: '100 GC' },   // Необычный
    { value: 10, color: '#3498db', chance: 20, text: '200 GC' },   // Редкий
    { value: 50, color: '#9b59b6', chance: 15, text: '500 GC' },   // Эпический
    { value: 100, color: '#f39c12', chance: 8, text: '1000 GC' },  // Легендарный
    { value: 500, color: '#e74c3c', chance: 2, text: '2000 GC' }   // Джеко-пот
];

// Инициализация игры
function initGame() {
    console.log('🎡 Инициализация Golden Roulette...');
    
    if (tg) {
        // Разворачиваем на весь экран
        tg.expand();
        
        // Настраиваем кнопку сохранения
        tg.MainButton.setText("💾 Сохранить и выйти");
        tg.MainButton.onClick(saveAndExit);
        tg.MainButton.show();
        
        // Получаем данные пользователя из Telegram
        loadTelegramUserData();
    }
    
    // Загружаем сохраненную игру
    loadSavedGame();
    
    // Инициализируем рулетку
    initWheel();
    
    // Настраиваем кнопки ставок
    initBetButtons();
    
    // Настраиваем кнопку спина
    document.getElementById('spinBtn').addEventListener('click', spinWheel);
    
    // Обновляем UI
    updateUI();
    
    console.log('✅ Игра готова!');
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
        showNotification('💾 Игра сохранена!');
        
        if (tg?.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('light');
        }
        
        return true;
    } catch (e) {
        showNotification('❌ Ошибка сохранения');
        return false;
    }
}

// Сохранение и выход
function saveAndExit() {
    if (saveGame() && tg) {
        tg.showAlert('Игра сохранена! Возвращайтесь!');
        setTimeout(() => tg.close(), 1000);
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
        
        // Устанавливаем позицию и цвет
        const rotateAngle = index * sectorAngle;
        sector.style.transform = `rotate(${rotateAngle}deg)`;
        sector.style.background = prize.color;
        
        // Добавляем градиент для красоты
        sector.style.background = `linear-gradient(${rotateAngle + 90}deg, 
            ${prize.color} 0%, 
            ${darkenColor(prize.color, 20)} 100%)`;
        
        // Добавляем текст
        const span = document.createElement('span');
        span.innerHTML = prize.text;
        span.style.color = getContrastColor(prize.color);
        sector.appendChild(span);
        
        wheel.appendChild(sector);
    });
}

// Инициализация кнопок ставок
function initBetButtons() {
    const betButtons = document.querySelectorAll('.bet-btn');
    
    betButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Убираем активный класс у всех кнопок
            betButtons.forEach(b => b.classList.remove('active'));
            
            // Добавляем активный класс выбранной кнопке
            this.classList.add('active');
            
            // Устанавливаем ставку
            gameData.currentBet = parseInt(this.dataset.bet);
            
            // Обновляем состояние кнопки спина
            updateSpinButton();
        });
    });
}

// Обновление кнопки спина
function updateSpinButton() {
    const spinBtn = document.getElementById('spinBtn');
    const canSpin = gameData.balance >= gameData.currentBet;
    
    spinBtn.disabled = !canSpin;
    
    if (canSpin) {
        spinBtn.innerHTML = `
            <i class="fas fa-play"></i>
            Крутить за ${gameData.currentBet} GC
        `;
    } else {
        spinBtn.innerHTML = `
            <i class="fas fa-lock"></i>
            Недостаточно GC
        `;
    }
}

// Вращение рулетки
let isSpinning = false;

function spinWheel() {
    if (isSpinning || gameData.balance < gameData.currentBet) return;
    
    isSpinning = true;
    
    // Снимаем ставку
    gameData.balance -= gameData.currentBet;
    gameData.totalSpins++;
    
    // Обновляем UI
    updateUI();
    updateSpinButton();
    
    // Воспроизводим звук вращения
    playSound('spinSound');
    
    // Получаем случайный приз
    const prize = getRandomPrize();
    
    // Анимация вращения рулетки
    const wheel = document.getElementById('wheel');
    const spinBtn = document.getElementById('spinBtn');
    
    // Вычисляем угол остановки
    const prizeIndex = WHEEL_PRIZES.indexOf(prize);
    const sectorAngle = 360 / WHEEL_PRIZES.length;
    
    // Рулетка вращается по часовой стрелке
    // Делаем 10 полных оборотов + останавливаемся на призе
    const fullRotations = 10; // 10 полных оборотов
    const stopAngle = fullRotations * 360 + (prizeIndex * sectorAngle) + (sectorAngle / 2);
    
    // Сбрасываем трансформацию
    wheel.style.transition = 'none';
    wheel.style.transform = 'rotate(0deg)';
    
    // Ждем кадр для сброса
    requestAnimationFrame(() => {
        // Запускаем анимацию с плавным замедлением
        wheel.style.transition = 'transform 5s cubic-bezier(0.2, 0.8, 0.3, 1)';
        wheel.style.transform = `rotate(${stopAngle}deg)`;
        
        // Показываем результат через 5 секунд
        setTimeout(() => {
            processSpinResult(prize);
            isSpinning = false;
            updateSpinButton();
            saveGame();
        }, 5000);
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
function processSpinResult(prize) {
    const winAmount = prize.value;
    const multiplier = winAmount / gameData.currentBet;
    
    // Добавляем выигрыш
    gameData.balance += winAmount;
    gameData.totalWon += winAmount;
    gameData.wins += multiplier > 1 ? 1 : 0;
    
    // Обновляем максимальный выигрыш
    if (winAmount > gameData.maxWin) {
        gameData.maxWin = winAmount;
    }
    
    // Показываем результат
    if (multiplier > 1) {
        // Выигрыш
        playSound('winSound');
        showWinEffect();
        
        let message = '';
        if (multiplier >= 20) {
            message = `🎉 ДЖЕКПОТ! Вы выиграли ${winAmount} GC!`;
        } else if (multiplier >= 5) {
            message = `🎊 ОГРОМНЫЙ ВЫИГРЫШ! ${winAmount} GC!`;
        } else if (multiplier >= 2) {
            message = `💰 Отлично! Выигрыш ${winAmount} GC!`;
        } else {
            message = `🎯 Вы выиграли ${winAmount} GC!`;
        }
        
        showNotification(message);
        
        // Вибрация для больших выигрышей
        if (tg?.HapticFeedback) {
            if (multiplier >= 20) {
                tg.HapticFeedback.notificationOccurred('success');
            } else if (multiplier >= 5) {
                tg.HapticFeedback.impactOccurred('heavy');
            } else {
                tg.HapticFeedback.impactOccurred('medium');
            }
        }
    } else {
        // Проигрыш
        playSound('loseSound');
        showNotification(`😔 Не повезло... Выигрыш ${winAmount} GC`);
        
        if (tg?.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('light');
        }
    }
    
    // Обновляем UI
    updateUI();
    
    // Проверяем достижения
    checkAchievements();
}

// Показать эффект выигрыша
function showWinEffect() {
    const effect = document.createElement('div');
    effect.className = 'win-effect';
    document.body.appendChild(effect);
    
    setTimeout(() => {
        effect.remove();
    }, 1000);
}

// Обновление UI
function updateUI() {
    // Баланс
    document.getElementById('balance').textContent = gameData.balance;
    
    // Статистика
    document.getElementById('totalSpins').textContent = gameData.totalSpins;
    document.getElementById('totalWon').textContent = gameData.totalWon + ' GC';
    document.getElementById('maxWin').textContent = gameData.maxWin + ' GC';
    
    // Расчет удачи (% выигрышных спинов)
    const luck = gameData.totalSpins > 0 
        ? Math.round((gameData.wins / gameData.totalSpins) * 100) 
        : 0;
    document.getElementById('luck').textContent = luck + '%';
    
    // Обновляем кнопку спина
    updateSpinButton();
}

// Проверка достижений
function checkAchievements() {
    // Простая система достижений
    const achievements = [
        { condition: gameData.totalSpins >= 10, message: '🎯 Первые 10 спинов!' },
        { condition: gameData.totalSpins >= 50, message: '🎯 50 спинов! Вы опытный игрок!' },
        { condition: gameData.maxWin >= 1000, message: '💰 Крупный выигрыш!' },
        { condition: gameData.maxWin >= 2000, message: '💰 ДЖЕКПОТ достижение!' },
        { condition: gameData.balance >= 5000, message: '🏦 Богатый игрок!' }
    ];
    
    achievements.forEach(ach => {
        if (ach.condition) {
            // Можно добавить систему флагов, чтобы не показывать повторно
            showNotification(ach.message);
        }
    });
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