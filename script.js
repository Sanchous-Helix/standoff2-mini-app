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

// 8 СЕКТОРОВ - СТРОГО ПО ПОРЯДКУ ПО ЧАСОВОЙ СТРЕЛКЕ
const WHEEL_SECTORS = [
    { value: 0, text: '0 G', class: 'sector-0' },      // 1-й сектор (0°)
    { value: 5, text: '5 G', class: 'sector-5' },      // 2-й сектор (45°)
    { value: 10, text: '10 G', class: 'sector-10' },   // 3-й сектор (90°)
    { value: 15, text: '15 G', class: 'sector-15' },   // 4-й сектор (135°)
    { value: 25, text: '25 G', class: 'sector-25' },   // 5-й сектор (180°)
    { value: 50, text: '50 G', class: 'sector-50' },   // 6-й сектор (225°)
    { value: 100, text: '100 G', class: 'sector-100' }, // 7-й сектор (270°)
    { value: 250, text: '250 G', class: 'sector-250' }  // 8-й сектор (315°)
];

// Шансы для бесплатной крутки
const FREE_SPIN = [
    { value: 0, chance: 70.89 },
    { value: 5, chance: 15 },
    { value: 10, chance: 7.5 },
    { value: 15, chance: 4 },
    { value: 25, chance: 1.8 },
    { value: 50, chance: 0.7 },
    { value: 100, chance: 0.1 },
    { value: 250, chance: 0.01 }
];

// Шансы для платной крутки
const PAID_SPIN = [
    { value: 0, chance: 50 },
    { value: 5, chance: 17.4 },
    { value: 10, chance: 15 },
    { value: 15, chance: 10 },
    { value: 25, chance: 5 },
    { value: 50, chance: 2 },
    { value: 100, chance: 0.5 },
    { value: 250, chance: 0.1 }
];

// Создание колеса
function createWheel() {
    const wheel = document.getElementById('wheel');
    wheel.innerHTML = '';
    
    // 8 секторов по 45 градусов
    WHEEL_SECTORS.forEach((sector, index) => {
        const div = document.createElement('div');
        div.className = `wheel-sector ${sector.class}`;
        div.style.transform = `rotate(${index * 45}deg)`;
        
        const span = document.createElement('span');
        span.textContent = sector.text;
        div.appendChild(span);
        
        wheel.appendChild(div);
    });
    
    console.log('✅ Колесо создано. Секторов:', WHEEL_SECTORS.length);
    console.log('📌 Сектора по порядку:', WHEEL_SECTORS.map(s => s.text).join(' → '));
}

// Запуск игры
function initGame() {
    createWheel();
    setupListeners();
    updateUI();
    startTimer();
    
    // Тестовый поворот к каждому сектору
    console.log('🧪 Тест поворотов:');
    setTimeout(() => testWheel(), 1000);
}

// Тест колеса
function testWheel() {
    console.log('🔧 Тестирование колеса...');
    const wheel = document.getElementById('wheel');
    
    // По очереди поворачиваем к каждому сектору
    WHEEL_SECTORS.forEach((sector, index) => {
        setTimeout(() => {
            const angle = 720 + (index * 45) + 22.5;
            wheel.style.transition = 'transform 1s';
            wheel.style.transform = `rotate(${angle}deg)`;
            console.log(`  ${index}: ${sector.text} (${sector.value} G) - поворот ${angle}°`);
        }, index * 1200);
    });
}

// Слушатели
function setupListeners() {
    document.getElementById('spinBtn').onclick = () => spin(false);
    document.getElementById('freeSpinBtn').onclick = () => spin(true);
}

// Обновление интерфейса
function updateUI() {
    document.getElementById('balance').textContent = gameData.balance;
    document.getElementById('totalSpins').textContent = gameData.totalSpins;
    document.getElementById('totalWon').textContent = gameData.totalWon;
    document.getElementById('maxWin').textContent = gameData.maxWin;
    
    document.getElementById('spinBtn').disabled = gameData.balance < 10;
    document.getElementById('freeSpinBtn').disabled = !gameData.freeSpinAvailable;
}

// Таймер
function startTimer() {
    updateTimer();
    setInterval(updateTimer, 1000);
}

function updateTimer() {
    const timer = document.getElementById('freeSpinTimer');
    
    if (!gameData.lastFreeSpin || gameData.freeSpinAvailable) {
        timer.textContent = '✅ Доступно сейчас';
        timer.style.color = '#2ecc71';
        return;
    }
    
    const left = 4 * 60 * 60 * 1000 - (Date.now() - gameData.lastFreeSpin);
    
    if (left <= 0) {
        gameData.freeSpinAvailable = true;
        document.getElementById('freeSpinBtn').disabled = false;
        timer.textContent = '✅ Доступно сейчас';
        timer.style.color = '#2ecc71';
        return;
    }
    
    const h = Math.floor(left / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    const s = Math.floor((left % 60000) / 1000);
    
    timer.textContent = `⏳ ${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    timer.style.color = '#ff4444';
}

// Выбор случайного приза
function getRandomPrize(chances) {
    const total = chances.reduce((sum, p) => sum + p.chance, 0);
    let rand = Math.random() * total;
    
    for (const p of chances) {
        if (rand < p.chance) return p.value;
        rand -= p.chance;
    }
    return 0;
}

// Вращение
let isSpinning = false;

function spin(isFree) {
    if (isSpinning) {
        console.log('⏳ Уже крутится...');
        return;
    }
    
    const chances = isFree ? FREE_SPIN : PAID_SPIN;
    
    // Проверки
    if (!isFree && gameData.balance < 10) {
        showMessage('❌ Недостаточно G!');
        return;
    }
    
    if (isFree && !gameData.freeSpinAvailable) {
        showMessage('⏳ Подождите!');
        return;
    }
    
    isSpinning = true;
    
    // Списание
    if (!isFree) {
        gameData.balance -= 10;
    } else {
        gameData.lastFreeSpin = Date.now();
        gameData.freeSpinAvailable = false;
    }
    
    gameData.totalSpins++;
    updateUI();
    
    // Получаем выигрыш
    const winValue = getRandomPrize(chances);
    console.log(`🎯 ВЫПАЛО: ${winValue} G (${isFree ? 'бесплатно' : 'платно'})`);
    
    // Находим индекс сектора
    const sectorIndex = WHEEL_SECTORS.findIndex(s => s.value === winValue);
    console.log(`🎡 СЕКТОР ${sectorIndex}: ${WHEEL_SECTORS[sectorIndex].text}`);
    
    // Вращаем колесо
    const wheel = document.getElementById('wheel');
    
    // ФОРМУЛА: 3 полных оборота (1080°) + позиция сектора
    const angle = 1080 + (sectorIndex * 45) + 22.5;
    console.log(`🔄 Поворот: ${angle}°`);
    
    wheel.style.transition = 'transform 3s cubic-bezier(0.2, 0.8, 0.3, 1)';
    wheel.style.transform = `rotate(${angle}deg)`;
    
    // Результат
    setTimeout(() => {
        if (winValue > 0) {
            gameData.balance += winValue;
            gameData.totalWon += winValue;
            gameData.wins++;
            
            if (winValue > gameData.maxWin) {
                gameData.maxWin = winValue;
            }
        }
        
        let message = '';
        if (winValue === 250) message = '🏆 ДЖЕКПОТ! +250 G!';
        else if (winValue === 100) message = '🎉 +100 G!';
        else if (winValue === 50) message = '💰 +50 G!';
        else if (winValue === 25) message = '🎊 +25 G!';
        else if (winValue === 15) message = '🎯 +15 G!';
        else if (winValue === 10) message = '👍 +10 G!';
        else if (winValue === 5) message = '👌 +5 G!';
        else message = '😔 0 G';
        
        if (isFree) message += ' (бесплатно)';
        
        showMessage(message);
        updateUI();
        
        isSpinning = false;
    }, 3000);
}

// Уведомление
function showMessage(text) {
    const el = document.getElementById('notification');
    el.textContent = text;
    el.style.display = 'block';
    
    setTimeout(() => {
        el.style.display = 'none';
    }, 2000);
}

// Запуск
document.addEventListener('DOMContentLoaded', initGame);