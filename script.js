let balance = 100;
const SPIN_COST = 10;

// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Элементы DOM
const balanceEl = document.getElementById('balance');
const resultDisplay = document.getElementById('resultDisplay');
const spinBtn = document.getElementById('spinButton');
const lastWinText = document.getElementById('lastWinText');

// Функция кручения рулетки
function spinWheel() {
    const rand = Math.random() * 100;
    
    // Шансы:
    // 0-25G - 70%
    // 50G - 20%
    // 100G - 10%
    
    if (rand < 10) {        // 10% - ДЖЕКПОТ 100G
        return 100;
    } else if (rand < 30) { // 20% - 50G
        return 50;
    } else if (rand < 60) { // 30% - 25G
        return 25;
    } else if (rand < 90) { // 30% - 10G
        return 10;
    } else if (rand < 97) { // 7% - 5G
        return 5;
    } else {                // 3% - 0G
        return 0;
    }
}

// Анимация кручения
async function spinAnimation() {
    const frames = ['🎲', '⚡', '💎', '🔫', '🎯', '💰', '🏆', '🔥'];
    for (let i = 0; i < 15; i++) {
        resultDisplay.textContent = frames[Math.floor(Math.random() * frames.length)];
        resultDisplay.classList.add('spinning');
        await new Promise(resolve => setTimeout(resolve, 50));
        resultDisplay.classList.remove('spinning');
    }
}

// Обновление баланса
function updateBalanceUI() {
    balanceEl.textContent = balance;
}

// Проверка на бомжей
function checkBalance() {
    if (balance < SPIN_COST) {
        spinBtn.disabled = true;
        lastWinText.textContent = '❌ Недостаточно G! ❌';
        lastWinText.style.color = '#ff4757';
    } else {
        spinBtn.disabled = false;
    }
}

// Основная функция крутки
async function spin() {
    if (balance < SPIN_COST) {
        tg.showAlert('❌ Недостаточно G! ❌');
        return;
    }

    // Блокируем кнопку
    spinBtn.disabled = true;
    
    // Снимаем плату
    balance -= SPIN_COST;
    updateBalanceUI();
    
    // Анимация
    await spinAnimation();
    
    // Получаем выигрыш
    const winAmount = spinWheel();
    balance += winAmount;
    updateBalanceUI();
    
    // Отображаем результат
    if (winAmount === 100) {
        resultDisplay.textContent = '🔥 100 🔥';
        lastWinText.innerHTML = '🎉 ДЖЕКПОТ! +100G 🎉';
        lastWinText.style.color = '#ffd700';
        tg.HapticFeedback.impactOccurred('heavy');
    } else if (winAmount === 50) {
        resultDisplay.textContent = '⚡ 50 ⚡';
        lastWinText.innerHTML = '🎯 +50G!';
        lastWinText.style.color = '#e67e22';
        tg.HapticFeedback.impactOccurred('medium');
    } else if (winAmount === 25) {
        resultDisplay.textContent = '💰 25 💰';
        lastWinText.innerHTML = '👍 +25G';
        lastWinText.style.color = '#a4b0be';
        tg.HapticFeedback.impactOccurred('light');
    } else if (winAmount === 10) {
        resultDisplay.textContent = '🎲 10 🎲';
        lastWinText.innerHTML = '🍃 +10G';
        lastWinText.style.color = '#a4b0be';
    } else if (winAmount === 5) {
        resultDisplay.textContent = '🍃 5 🍃';
        lastWinText.innerHTML = '😕 +5G';
        lastWinText.style.color = '#747d8c';
    } else {
        resultDisplay.textContent = '💔 0 💔';
        lastWinText.innerHTML = '💔 В этот раз не повезло...';
        lastWinText.style.color = '#747d8c';
    }
    
    // Разблокируем кнопку
    spinBtn.disabled = false;
    checkBalance();
    
    // Сохраняем баланс
    tg.MainButton.setText(`Баланс: ${balance}G`);
}

// Обработчик кнопки
spinBtn.addEventListener('click', spin);

// Стартовая проверка
checkBalance();
updateBalanceUI();

// Отправляем данные в Telegram при закрытии
window.addEventListener('beforeunload', () => {
    tg.sendData(JSON.stringify({
        balance: balance
    }));
});