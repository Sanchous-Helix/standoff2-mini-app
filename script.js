// Инициализация Telegram Web App
let tg = window.Telegram?.WebApp;
let gameData = {
    coins: 1000,
    gems: 50,
    inventory: [],
    openedCases: 0,
    wheelSpins: 0,
    dailyBonus: {},
    selectedCase: null,
    achievements: []
};

// Конфигурация колеса фортуны
const WHEEL_PRIZES = [
    { type: 'coins', value: 100, rarity: 'common', color: '#5d6d7e', chance: 30 },
    { type: 'coins', value: 500, rarity: 'uncommon', color: '#2ecc71', chance: 20 },
    { type: 'gems', value: 10, rarity: 'rare', color: '#3498db', chance: 15 },
    { type: 'gems', value: 25, rarity: 'epic', color: '#9b59b6', chance: 10 },
    { type: 'skin', value: 'common_skin', rarity: 'common', color: '#5d6d7e', chance: 10 },
    { type: 'skin', value: 'rare_skin', rarity: 'rare', color: '#3498db', chance: 8 },
    { type: 'skin', value: 'epic_skin', rarity: 'epic', color: '#9b59b6', chance: 5 },
    { type: 'skin', value: 'legendary_skin', rarity: 'legendary', color: '#f39c12', chance: 2 }
];

// Конфигурация кейсов
const CASES = [
    {
        id: 'basic_case',
        name: 'Базовый кейс',
        description: 'Обычные скины и оружие',
        price: 100,
        rarity: 'common',
        rewards: [
            { type: 'skin', name: 'AK-47 | Стандарт', rarity: 'common', chance: 40 },
            { type: 'skin', name: 'M4 | Стандарт', rarity: 'common', chance: 30 },
            { type: 'skin', name: 'AWP | Стандарт', rarity: 'uncommon', chance: 15 },
            { type: 'knife', name: 'Нож | Стандарт', rarity: 'rare', chance: 10 },
            { type: 'gloves', name: 'Перчатки | Стандарт', rarity: 'epic', chance: 5 }
        ]
    },
    {
        id: 'rare_case',
        name: 'Редкий кейс',
        description: 'Шанс получить редкие предметы',
        price: 500,
        rarity: 'rare',
        rewards: [
            { type: 'skin', name: 'AK-47 | Красный тигр', rarity: 'uncommon', chance: 30 },
            { type: 'skin', name: 'M4 | Дракон', rarity: 'rare', chance: 25 },
            { type: 'skin', name: 'AWP | Азимов', rarity: 'rare', chance: 20 },
            { type: 'knife', name: 'Нож | Бабочка', rarity: 'epic', chance: 15 },
            { type: 'gloves', name: 'Перчатки | Спектр', rarity: 'legendary', chance: 10 }
        ]
    },
    {
        id: 'epic_case',
        name: 'Эпический кейс',
        description: 'Эпические и легендарные предметы',
        price: 1000,
        rarity: 'epic',
        rewards: [
            { type: 'skin', name: 'AK-47 | Огненный змей', rarity: 'rare', chance: 25 },
            { type: 'skin', name: 'M4 | Небесный дракон', rarity: 'epic', chance: 20 },
            { type: 'skin', name: 'AWP | Громовержец', rarity: 'epic', chance: 20 },
            { type: 'knife', name: 'Нож | Коготь', rarity: 'legendary', chance: 15 },
            { type: 'gloves', name: 'Перчатки | Дракон', rarity: 'ancient', chance: 10 },
            { type: 'skin', name: 'Золотой AK-47', rarity: 'ancient', chance: 10 }
        ]
    },
    {
        id: 'legendary_case',
        name: 'Легендарный кейс',
        description: 'Только лучшие предметы',
        price: 2500,
        rarity: 'legendary',
        rewards: [
            { type: 'skin', name: 'AK-47 | Золотой феникс', rarity: 'epic', chance: 20 },
            { type: 'skin', name: 'M4 | Небесный владыка', rarity: 'legendary', chance: 20 },
            { type: 'skin', name: 'AWP | Повелитель драконов', rarity: 'legendary', chance: 15 },
            { type: 'knife', name: 'Нож | Карамбит', rarity: 'ancient', chance: 15 },
            { type: 'knife', name: 'Нож | Сапфир', rarity: 'ancient', chance: 10 },
            { type: 'gloves', name: 'Перчатки | Повелитель', rarity: 'ancient', chance: 10 },
            { type: 'skin', name: 'Золотой AWP', rarity: 'ancient', chance: 10 }
        ]
    }
];

// Конфигурация магазина
const SHOP_ITEMS = [
    { type: 'coins', amount: 1000, price: 10, gemPrice: 10 },
    { type: 'coins', amount: 5000, price: 45, gemPrice: 45 },
    { type: 'coins', amount: 10000, price: 80, gemPrice: 80 },
    { type: 'gems', amount: 100, price: 99, gemPrice: 99 },
    { type: 'gems', amount: 500, price: 399, gemPrice: 399 },
    { type: 'gems', amount: 1000, price: 699, gemPrice: 699 }
];

// Инициализация игры
function initGame() {
    console.log('🎮 Standoff 2 Mini App инициализация...');
    
    if (tg) {
        tg.expand();
        tg.MainButton.setText("💾 Сохранить и выйти");
        tg.MainButton.onClick(saveAndExit);
        tg.MainButton.show();
        
        // Показываем информацию пользователя
        const user = tg.initDataUnsafe?.user;
        if (user) {
            document.getElementById('username').textContent = 
                user.first_name || user.username || 'SO2 Agent';
        }
    }
    
    // Загружаем сохраненную игру
    loadGame();
    
    // Инициализируем колесо
    initWheel();
    
    // Инициализируем кейсы
    initCases();
    
    // Инициализируем магазин
    initShop();
    
    // Инициализируем инвентарь
    updateInventory();
    
    // Обновляем UI
    updateUI();
    
    // Запускаем таймер бесплатного спина
    startFreeSpinTimer();
    
    console.log('✅ Игра инициализирована!');
}

// Загрузка игры
function loadGame() {
    try {
        const saved = localStorage.getItem('standoff2_save');
        if (saved) {
            const parsed = JSON.parse(saved);
            gameData = { ...gameData, ...parsed };
            console.log('🎮 Игра загружена');
        }
    } catch (e) {
        console.error('❌ Ошибка загрузки:', e);
    }
}

// Сохранение игры
function saveGame() {
    try {
        localStorage.setItem('standoff2_save', JSON.stringify(gameData));
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

// Обновление UI
function updateUI() {
    document.getElementById('coins').textContent = gameData.coins;
    document.getElementById('gems').textContent = gameData.gems;
    document.getElementById('shopCoins').textContent = gameData.coins + ' GC';
    document.getElementById('shopGems').textContent = gameData.gems + ' 💎';
    
    // Обновляем кнопку спина
    const spinBtn = document.getElementById('spinBtn');
    spinBtn.disabled = gameData.coins < 100;
    
    // Обновляем кнопку открытия кейса
    const openCaseBtn = document.getElementById('openCaseBtn');
    if (gameData.selectedCase) {
        const selectedCase = CASES.find(c => c.id === gameData.selectedCase);
        openCaseBtn.disabled = gameData.coins < selectedCase.price;
    }
}

// Инициализация колеса
function initWheel() {
    const wheel = document.getElementById('wheel');
    wheel.innerHTML = '';
    
    const sectorAngle = 360 / WHEEL_PRIZES.length;
    
    WHEEL_PRIZES.forEach((prize, index) => {
        const sector = document.createElement('div');
        sector.className = 'wheel-sector';
        sector.style.transform = `rotate(${index * sectorAngle}deg)`;
        sector.style.background = prize.color;
        
        const span = document.createElement('span');
        if (prize.type === 'coins') {
            span.innerHTML = `💰 ${prize.value}`;
        } else if (prize.type === 'gems') {
            span.innerHTML = `💎 ${prize.value}`;
        } else {
            span.innerHTML = `🎁 ${prize.rarity}`;
        }
        
        sector.appendChild(span);
        wheel.appendChild(sector);
    });
    
    // Инициализируем призы
    initPrizes();
}

// Инициализация призов
function initPrizes() {
    const prizesGrid = document.getElementById('prizesGrid');
    prizesGrid.innerHTML = '';
    
    WHEEL_PRIZES.forEach(prize => {
        const prizeItem = document.createElement('div');
        prizeItem.className = 'prize-item';
        
        let icon, name;
        if (prize.type === 'coins') {
            icon = '💰';
            name = `${prize.value} GC`;
        } else if (prize.type === 'gems') {
            icon = '💎';
            name = `${prize.value} Гемов`;
        } else {
            icon = '🎁';
            name = `${prize.rarity} Скин`;
        }
        
        prizeItem.innerHTML = `
            <div class="prize-icon">${icon}</div>
            <div class="prize-name">${name}</div>
            <div class="prize-chance">${prize.chance}%</div>
        `;
        
        prizesGrid.appendChild(prizeItem);
    });
}

// Вращение колеса
let isSpinning = false;

function spinWheel() {
    if (isSpinning || gameData.coins < 100) return;
    
    isSpinning = true;
    gameData.coins -= 100;
    gameData.wheelSpins++;
    
    updateUI();
    
    // Воспроизводим звук
    playSound('spinSound');
    
    // Анимация вращения
    const wheel = document.getElementById('wheel');
    const spinBtn = document.getElementById('spinBtn');
    spinBtn.disabled = true;
    
    // Случайный приз
    const randomPrize = getRandomPrize();
    const prizeIndex = WHEEL_PRIZES.indexOf(randomPrize);
    const sectorAngle = 360 / WHEEL_PRIZES.length;
    
    // Вычисляем угол остановки
    const fullRotations = 5;
    const stopAngle = fullRotations * 360 + (prizeIndex * sectorAngle) + (sectorAngle / 2);
    
    // Анимация
    wheel.style.transition = 'transform 4s cubic-bezier(0.33, 0, 0.67, 1)';
    wheel.style.transform = `rotate(${stopAngle}deg)`;
    
    // Показываем результат через 4 секунды
    setTimeout(() => {
        givePrize(randomPrize);
        isSpinning = false;
        spinBtn.disabled = gameData.coins < 100;
        saveGame();
    }, 4000);
}

// Получение случайного приза
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

// Выдача приза
function givePrize(prize) {
    let message = '';
    
    if (prize.type === 'coins') {
        gameData.coins += prize.value;
        message = `💰 Вы выиграли ${prize.value} GC!`;
    } else if (prize.type === 'gems') {
        gameData.gems += prize.value;
        message = `💎 Вы выиграли ${prize.value} гемов!`;
    } else {
        const skin = {
            id: Date.now(),
            name: `${prize.rarity} Скин`,
            type: 'skin',
            rarity: prize.rarity,
            value: getSkinValue(prize.rarity)
        };
        gameData.inventory.push(skin);
        message = `🎁 Вы выиграли ${prize.rarity} скин!`;
    }
    
    updateUI();
    updateInventory();
    playSound('winSound');
    showRewardModal('🎉 Поздравляем!', message);
    
    // Проверяем достижения
    checkAchievements();
}

// Инициализация кейсов
function initCases() {
    const casesGrid = document.getElementById('casesGrid');
    casesGrid.innerHTML = '';
    
    CASES.forEach(caseItem => {
        const caseElement = document.createElement('div');
        caseElement.className = `case-item ${caseItem.rarity}`;
        caseElement.dataset.id = caseItem.id;
        
        caseElement.innerHTML = `
            <div class="case-image">
                <i class="fas fa-box"></i>
            </div>
            <div class="case-name">${caseItem.name}</div>
            <div class="case-rarity ${caseItem.rarity}">${getRarityName(caseItem.rarity)}</div>
            <div class="case-price">
                <i class="fas fa-coins"></i>
                <span class="price">${caseItem.price}</span> GC
            </div>
        `;
        
        caseElement.addEventListener('click', () => selectCase(caseItem.id));
        casesGrid.appendChild(caseElement);
    });
    
    // Инициализируем награды для первого кейса
    updateCaseRewards(CASES[0].id);
}

// Выбор кейса
function selectCase(caseId) {
    gameData.selectedCase = caseId;
    
    // Убираем выделение со всех кейсов
    document.querySelectorAll('.case-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Выделяем выбранный кейс
    const selectedElement = document.querySelector(`.case-item[data-id="${caseId}"]`);
    if (selectedElement) {
        selectedElement.classList.add('active');
    }
    
    // Обновляем превью кейса
    updateCasePreview(caseId);
    
    // Обновляем награды
    updateCaseRewards(caseId);
}

// Обновление превью кейса
function updateCasePreview(caseId) {
    const caseItem = CASES.find(c => c.id === caseId);
    if (!caseItem) return;
    
    const preview = document.getElementById('casePreview');
    const openBtn = document.getElementById('openCaseBtn');
    
    preview.querySelector('.case-name').textContent = caseItem.name;
    preview.querySelector('.case-description').textContent = caseItem.description;
    preview.querySelector('.price').textContent = caseItem.price;
    
    openBtn.disabled = gameData.coins < caseItem.price;
    openBtn.onclick = () => openCase(caseId);
}

// Обновление наград кейса
function updateCaseRewards(caseId) {
    const caseItem = CASES.find(c => c.id === caseId);
    if (!caseItem) return;
    
    const rewardsList = document.getElementById('rewardsList');
    rewardsList.innerHTML = '';
    
    caseItem.rewards.forEach(reward => {
        const rewardItem = document.createElement('div');
        rewardItem.className = `reward-item ${reward.rarity}`;
        
        let icon = '🎁';
        if (reward.type === 'knife') icon = '🔪';
        if (reward.type === 'gloves') icon = '🧤';
        
        rewardItem.innerHTML = `
            <div>${icon}</div>
            <div>${reward.name}</div>
            <div class="reward-chance">${reward.chance}%</div>
        `;
        
        rewardsList.appendChild(rewardItem);
    });
}

// Открытие кейса
function openCase(caseId) {
    const caseItem = CASES.find(c => c.id === caseId);
    if (!caseItem || gameData.coins < caseItem.price) return;
    
    gameData.coins -= caseItem.price;
    gameData.openedCases++;
    
    updateUI();
    
    // Воспроизводим звук
    playSound('caseOpenSound');
    
    // Получаем случайную награду
    const reward = getRandomCaseReward(caseItem.rewards);
    
    // Добавляем в инвентарь
    const inventoryItem = {
        id: Date.now(),
        name: reward.name,
        type: reward.type,
        rarity: reward.rarity,
        value: getItemValue(reward.rarity, reward.type),
        case: caseItem.name
    };
    
    gameData.inventory.push(inventoryItem);
    
    // Показываем результат
    updateInventory();
    saveGame();
    
    let rewardIcon = '🎁';
    if (reward.type === 'knife') rewardIcon = '🔪';
    if (reward.type === 'gloves') rewardIcon = '🧤';
    
    showRewardModal(
        '🎊 Кейс открыт!',
        `${rewardIcon} Вы получили: <br><strong>${reward.name}</strong><br><span class="${reward.rarity}">${getRarityName(reward.rarity)}</span>`
    );
    
    // Проверяем достижения
    checkAchievements();
}

// Получение случайной награды из кейса
function getRandomCaseReward(rewards) {
    const totalChance = rewards.reduce((sum, reward) => sum + reward.chance, 0);
    let random = Math.random() * totalChance;
    
    for (const reward of rewards) {
        if (random < reward.chance) {
            return reward;
        }
        random -= reward.chance;
    }
    
    return rewards[0];
}

// Инициализация магазина
function initShop() {
    const shopGrid = document.getElementById('shopGrid');
    shopGrid.innerHTML = '';
    
    SHOP_ITEMS.forEach(item => {
        const shopItem = document.createElement('div');
        shopItem.className = 'case-item';
        
        let icon = item.type === 'coins' ? '💰' : '💎';
        let name = item.type === 'coins' ? `${item.amount} GC` : `${item.amount} Гемов`;
        
        shopItem.innerHTML = `
            <div class="case-image">
                <i class="fas ${item.type === 'coins' ? 'fa-coins' : 'fa-gem'}"></i>
            </div>
            <div class="case-name">${name}</div>
            <div class="case-price">
                <i class="fas fa-gem"></i>
                <span class="price">${item.gemPrice}</span> 💎
            </div>
            <button class="btn-open-case" style="margin-top: 10px;" onclick="buyShopItem(${item.amount}, '${item.type}', ${item.gemPrice})">
                Купить
            </button>
        `;
        
        shopGrid.appendChild(shopItem);
    });
}

// Покупка в магазине
function buyShopItem(amount, type, price) {
    if (gameData.gems < price) {
        showNotification('❌ Недостаточно гемов!');
        return;
    }
    
    gameData.gems -= price;
    
    if (type === 'coins') {
        gameData.coins += amount;
        showNotification(`✅ Куплено ${amount} GC!`);
    } else {
        gameData.gems += amount;
        showNotification(`✅ Куплено ${amount} гемов!`);
    }
    
    updateUI();
    saveGame();
}

// Покупка гемов
function showGemsShop() {
    const modal = document.getElementById('gemsShopModal');
    const packages = modal.querySelector('.gems-packages');
    
    packages.innerHTML = `
        <div class="gems-package" onclick="buyGems(100, 99)">
            <h3>100 💎</h3>
            <p>99 ₽</p>
        </div>
        <div class="gems-package" onclick="buyGems(500, 399)">
            <h3>500 💎</h3>
            <p>399 ₽</p>
        </div>
        <div class="gems-package" onclick="buyGems(1000, 699)">
            <h3>1000 💎</h3>
            <p>699 ₽</p>
        </div>
        <div class="gems-package" onclick="buyGems(5000, 2999)">
            <h3>5000 💎</h3>
            <p>2999 ₽</p>
        </div>
    `;
    
    modal.classList.add('active');
}

function buyGems(amount, price) {
    showNotification(`💎 +${amount} гемов добавлено! (Демо-версия)`);
    gameData.gems += amount;
    updateUI();
    saveGame();
    closeGemsShop();
}

function closeGemsShop() {
    document.getElementById('gemsShopModal').classList.remove('active');
}

// Обновление инвентаря
function updateInventory() {
    const inventoryGrid = document.getElementById('inventoryGrid');
    const totalItems = document.getElementById('totalItems');
    const totalValue = document.getElementById('totalValue');
    
    // Подсчитываем статистику
    const rarityCount = {
        common: 0,
        uncommon: 0,
        rare: 0,
        epic: 0,
        legendary: 0,
        ancient: 0
    };
    
    let totalWorth = 0;
    
    gameData.inventory.forEach(item => {
        rarityCount[item.rarity]++;
        totalWorth += item.value || 0;
    });
    
    // Обновляем статистику
    totalItems.textContent = gameData.inventory.length;
    totalValue.textContent = totalWorth + ' GC';
    
    document.getElementById('rarityCount').innerHTML = `
        <div>Обычные: ${rarityCount.common}</div>
        <div>Редкие: ${rarityCount.rare}</div>
        <div>Эпические: ${rarityCount.epic}</div>
    `;
    
    // Обновляем сетку инвентаря
    if (gameData.inventory.length === 0) {
        inventoryGrid.innerHTML = `
            <div class="empty-inventory">
                <i class="fas fa-box-open"></i>
                <p>Инвентарь пуст</p>
                <p>Откройте кейсы или крутите колесо!</p>
            </div>
        `;
        return;
    }
    
    inventoryGrid.innerHTML = '';
    
    gameData.inventory.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'inventory-item';
        
        let icon = '🎁';
        if (item.type === 'knife') icon = '🔪';
        if (item.type === 'gloves') icon = '🧤';
        if (item.type === 'skin') icon = '🔫';
        
        itemElement.innerHTML = `
            <div class="item-rarity ${item.rarity}">${getRarityShort(item.rarity)}</div>
            <div style="font-size: 2em; margin-bottom: 10px;">${icon}</div>
            <div style="font-weight: bold; margin-bottom: 5px;">${item.name}</div>
            <div class="${item.rarity}" style="font-size: 0.9em; margin-bottom: 5px;">${getRarityName(item.rarity)}</div>
            <div style="font-size: 0.8em; opacity: 0.8;">${item.value || 0} GC</div>
        `;
        
        inventoryGrid.appendChild(itemElement);
    });
}

// Проверка достижений
function checkAchievements() {
    const achievements = [
        { id: 'first_spin', condition: gameData.wheelSpins >= 1, name: 'Первое вращение' },
        { id: 'spin_master', condition: gameData.wheelSpins >= 10, name: 'Мастер колеса' },
        { id: 'first_case', condition: gameData.openedCases >= 1, name: 'Первый кейс' },
        { id: 'case_opener', condition: gameData.openedCases >= 5, name: 'Коллекционер' },
        { id: 'rich_player', condition: gameData.coins >= 10000, name: 'Богатый игрок' },
        { id: 'gem_king', condition: gameData.gems >= 1000, name: 'Король гемов' }
    ];
    
    achievements.forEach(ach => {
        if (ach.condition && !gameData.achievements.includes(ach.id)) {
            gameData.achievements.push(ach.id);
            showNotification(`🏆 Достижение: ${ach.name}!`);
            
            if (tg?.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('success');
            }
        }
    });
}

// Таймер бесплатного спина
let freeSpinTimer = null;

function startFreeSpinTimer() {
    clearInterval(freeSpinTimer);
    
    function updateTimer() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const diff = tomorrow - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        document.getElementById('timer').textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    updateTimer();
    freeSpinTimer = setInterval(updateTimer, 1000);
}

// Показ модального окна с наградой
function showRewardModal(title, message) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = message;
    document.getElementById('rewardModal').classList.add('active');
    
    // Автозакрытие через 5 секунд
    setTimeout(() => {
        if (document.getElementById('rewardModal').classList.contains('active')) {
            closeModal();
        }
    }, 5000);
}

function closeModal() {
    document.getElementById('rewardModal').classList.remove('active');
}

// Показать уведомление
function showNotification(message) {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
        border-left: 4px solid var(--so2-highlight);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
    `;
    
    notification.innerHTML = message;
    document.body.appendChild(notification);
    
    // Удаляем через 3 секунды
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Воспроизведение звука
function playSound(soundId) {
    try {
        const sound = document.getElementById(soundId);
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => console.log('Звук не воспроизведен:', e));
        }
    } catch (e) {
        // Игнорируем ошибки звука
    }
}

// Вспомогательные функции
function getRarityName(rarity) {
    const names = {
        common: 'Обычный',
        uncommon: 'Необычный',
        rare: 'Редкий',
        epic: 'Эпический',
        legendary: 'Легендарный',
        ancient: 'Древний'
    };
    return names[rarity] || rarity;
}

function getRarityShort(rarity) {
    const shorts = {
        common: 'C',
        uncommon: 'U',
        rare: 'R',
        epic: 'E',
        legendary: 'L',
        ancient: 'A'
    };
    return shorts[rarity] || rarity[0].toUpperCase();
}

function getSkinValue(rarity) {
    const values = {
        common: 100,
        uncommon: 500,
        rare: 2000,
        epic: 5000,
        legendary: 10000,
        ancient: 25000
    };
    return values[rarity] || 0;
}

function getItemValue(rarity, type) {
    let value = getSkinValue(rarity);
    if (type === 'knife') value *= 10;
    if (type === 'gloves') value *= 5;
    return value;
}

// Поделиться игрой
function shareGame() {
    const shareText = `🎮 Я играю в Standoff 2 Mini App! Уже ${gameData.coins} GC и ${gameData.inventory.length} предметов!`;
    
    if (tg?.shareMessage) {
        tg.shareMessage(shareText);
    } else if (navigator.share) {
        navigator.share({
            title: 'Standoff 2 Mini App',
            text: shareText,
            url: window.location.href
        });
    } else {
        navigator.clipboard.writeText(shareText).then(() => {
            showNotification('📋 Текст скопирован в буфер обмена!');
        });
    }
}

// Показать статистику
function showStats() {
    const stats = `
        📊 <b>Статистика игрока:</b><br><br>
        💰 Game Coins: ${gameData.coins}<br>
        💎 Гемов: ${gameData.gems}<br>
        🎁 Предметов: ${gameData.inventory.length}<br>
        🎯 Колесо: ${gameData.wheelSpins} раз<br>
        📦 Кейсов: ${gameData.openedCases} открыто<br>
        🏆 Достижений: ${gameData.achievements.length}<br><br>
        <small>Продолжайте в том же духе!</small>
    `;
    
    showRewardModal('📊 Статистика', stats);
}

// Навигация по вкладкам
document.addEventListener('DOMContentLoaded', function() {
    // Переключение вкладок
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            
            // Убираем активный класс у всех кнопок
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            // Добавляем активный класс текущей кнопке
            this.classList.add('active');
            
            // Скрываем все вкладки
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Показываем выбранную вкладку
            document.getElementById(`${tab}-tab`).classList.add('active');
        });
    });
    
    // Назначаем обработчик кнопки спина
    document.getElementById('spinBtn').addEventListener('click', spinWheel);
    
    // Инициализируем игру
    initGame();
    
    // Добавляем стили для анимаций
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
});