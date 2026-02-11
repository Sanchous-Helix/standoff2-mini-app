// Telegram Web App
let tg = window.Telegram?.WebApp;

// Данные игры
let gameData = {
    balance: 100,
    totalSpins: 0,
    totalWon: 0,
    maxWin: 0,
    wins: 0,
    lastFreeSpin: null,
    freeSpinAvailable: true
};

// 8 СЕКТОРОВ НА КОЛЕСЕ - ТОЛЬКО ЭТИ ЗНАЧЕНИЯ!
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

// Шансы для бесплатной крутки - ТОЧНО ПО ЗАДАНИЮ
const FREE_CHANCES = [
    { value: 0, chance: 70.89 },
    { value: 5, chance: 15 },
    { value: 10, chance: 7.5 },
    { value: 15, chance: 4 },
    { value: 25, chance: 1.8 },
    { value: 50, chance: 0.7 },
    { value: 100, chance: 0.1 },
    { value: 250, chance: 0.01 }
];

// Шансы для платной крутки - ТОЧНО ПО ЗАДАНИЮ
const PAID_CHANCES = [
    { value: 0, chance: 50 },
    { value: 5, chance: 17.4 },
    { value: 10, chance: 15 },
    { value: 15, chance: 10 },
    { value: 25, chance: 5 },
    { value: 50, chance: 2 },
    { value: 100, chance: 0.5 },
    { value: 250, chance: 0.1 }
];

const SPIN_COST = 10;
const COOLDOWN = 4 * 60 * 60 * 1000;

// Запуск игры
function initGame() {
    console.log('🎡 GoldBank Roulette');
    
    if (tg) {
        tg.expand();
        try { tg.backgroundColor = '#0a0c10'; } catch(e) {}
    }
    
    loadGame();
    createWheel();
    setupListeners();
    updateUI();
    startTimer();
}

// Создание колеса с 8 секторами
function createWheel() {
    const wheel = document.getElementById('wheel');
    wheel.innerHTML = '';
    
    const angle = 360 / 8; // 45 градусов
    
    WHEEL_PRIZES.forEach((prize, i) => {
        const sector = document.createElement('div');
        sector.className = `wheel-sector ${prize.class}`;
        sector.style.transform = `rotate(${i * angle}deg)`;
        
        const span = document.createElement('span');
        span.textContent = prize.text;
        span.style.color = '#ffffff';
        
        sector.appendChild(span);
        wheel.appendChild(sector);
    });
    
    console.log('✅ Колесо с 8 секторами готово');
}

// Слушатели
function setupListeners() {
    document.getElementById('spinBtn').onclick = () => spin(false);
    document.getElementById('freeSpinBtn').onclick = () => spin(true);
}

// Обновление интерфейса
function updateUI() {
    document.getElementById('balance').textContent = gameData.balance;
    document.getElementById('goldAmount').textContent = gameData.balance + ' G';
    document.getElementById('totalSpins').textContent = gameData.totalSpins;
    document.getElementById('totalWon').textContent = gameData.totalWon + ' G';
    document.getElementById('maxWin').textContent = gameData.maxWin + ' G';
    
    const luck = gameData.totalSpins ? Math.round((gameData.wins / gameData.totalSpins) * 100) : 0;
    document.getElementById('luckRate').textContent = luck + '%';
    
    document.getElementById('spinBtn').disabled = gameData.balance < SPIN_COST;
    document.getElementById('freeSpinBtn').disabled = !gameData.freeSpinAvailable;
}

// Загрузка сохранения
function loadGame() {
    try {
        const save = localStorage.getItem('goldbank');
        if (save) {
            const data = JSON.parse(save);
            gameData = { ...gameData, ...data };
            
            if (gameData.lastFreeSpin) {
                const diff = Date.now() - gameData.lastFreeSpin;
                gameData.freeSpinAvailable = diff >= COOLDOWN;
            }
        }
    } catch(e) {}
}

// Сохранение
function saveGame() {
    try {
        localStorage.setItem('goldbank', JSON.stringify(gameData));
    } catch(e) {}
}

// Таймер бесплатного спина
function startTimer() {
    updateTimer();
    setInterval(updateTimer, 1000);
}

function updateTimer() {
    const timer = document.getElementById('freeSpinTimer');
    
    if (!gameData.lastFreeSpin || gameData.freeSpinAvailable) {
        timer.textContent = '🎁 Доступно сейчас';
        timer.style.color = '#2ecc71';
        return;
    }
    
    const left = COOLDOWN - (Date.now() - gameData.lastFreeSpin);
    
    if (left <= 0) {
        gameData.freeSpinAvailable = true;
        document.getElementById('freeSpinBtn').disabled = false;
        timer.textContent = '🎁 Доступно сейчас';
        timer.style.color = '#2ecc71';
        showMessage('🎁 Бесплатный спин доступен!');
        return;
    }
    
    const h = Math.floor(left / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    const s = Math.floor((left % 60000) / 1000);
    
    timer.textContent = `⏳ ${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    timer.style.color = '#ff4444';
}

// Случайный приз
function getPrize(chances) {
    const total = chances.reduce((s, p) => s + p.chance, 0);
    let rand = Math.random() * total;
    
    for (const p of chances) {
        if (rand < p.chance) return p.value;
        rand -= p.chance;
    }
    return 0;
}

// Вращение
let spinning = false;

function spin(isFree) {
    if (spinning) return;
    
    const chances = isFree ? FREE_CHANCES : PAID_CHANCES;
    
    // Проверки
    if (!isFree && gameData.balance < SPIN_COST) {
        showMessage('❌ Недостаточно G!');
        return;
    }
    
    if (isFree && !gameData.freeSpinAvailable) {
        showMessage('⏳ Еще не доступно!');
        return;
    }
    
    spinning = true;
    
    // Списание
    if (!isFree) {
        gameData.balance -= SPIN_COST;
    } else {
        gameData.lastFreeSpin = Date.now();
        gameData.freeSpinAvailable = false;
    }
    
    gameData.totalSpins++;
    updateUI();
    
    // Звук
    play('spinSound');
    
    // Выигрыш
    const win = getPrize(chances);
    console.log(`🎯 Выпало: ${win} G`);
    
    // Индекс на колесе
    const index = WHEEL_PRIZES.findIndex(p => p.value === win);
    console.log(`🎡 Сектор ${index}: ${WHEEL_PRIZES[index].text}`);
    
    // Вращаем колесо
    const wheel = document.getElementById('wheel');
    
    // ФОРМУЛА: 5 оборотов (1800°) + сектор * 45° + половина сектора (22.5°)
    const rotate = 1800 + (index * 45) + 22.5;
    
    wheel.style.transition = 'transform 3s cubic-bezier(0.2, 0.8, 0.3, 1)';
    wheel.style.transform = `rotate(${rotate}deg)`;
    
    // Результат
    setTimeout(() => {
        if (win > 0) {
            gameData.balance += win;
            gameData.totalWon += win;
            gameData.wins++;
            if (win > gameData.maxWin) gameData.maxWin = win;
        }
        
        // Сообщение
        let msg = '';
        if (win === 250) msg = '🏆 СУПЕР ДЖЕКПОТ! +250 G!';
        else if (win === 100) msg = '🎉 МЕГА ВЫИГРЫШ! +100 G!';
        else if (win === 50) msg = '💰 БОЛЬШОЙ ВЫИГРЫШ! +50 G!';
        else if (win === 25) msg = '🎊 ОТЛИЧНО! +25 G!';
        else if (win === 15) msg = '🎯 ХОРОШО! +15 G!';
        else if (win === 10) msg = '👍 НЕПЛОХО! +10 G!';
        else if (win === 5) msg = '👌 +5 G!';
        else msg = '😔 ПРОИГРЫШ';
        
        if (isFree) msg += ' (Бесплатно)';
        
        showMessage(msg);
        
        if (win >= 50) {
            showWinEffect();
            play('winSound');
        } else if (win > 0) {
            play('winSound');
        } else {
            play('loseSound');
        }
        
        updateUI();
        saveGame();
        spinning = false;
    }, 3000);
}

// Сообщение
function showMessage(text) {
    const el = document.getElementById('notification');
    el.textContent = text;
    el.style.display = 'block';
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = 'slideIn 0.3s ease';
    
    setTimeout(() => {
        el.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            el.style.display = 'none';
        }, 300);
    }, 3000);
}

// Эффект выигрыша
function showWinEffect() {
    const el = document.getElementById('winEffect');
    el.style.display = 'block';
    setTimeout(() => {
        el.style.display = 'none';
    }, 1000);
}

// Звук
function play(id) {
    try {
        const sound = document.getElementById(id);
        if (sound) {
            sound.currentTime = 0;
            sound.volume = 0.3;
            sound.play();
        }
    } catch(e) {}
}

// Старт
document.addEventListener('DOMContentLoaded', initGame);