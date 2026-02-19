#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
🔥 STANDOFF2 РУЛЕТКА - СЕРВЕР НА FLASK + SQLite
Все данные хранятся в database.db
"""

import os
import sqlite3
import json
import hashlib
import hmac
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS

# ============ НАСТРОЙКИ ============
DB_FILE = "database.db"
SECRET_KEY = "ваш-секретный-ключ-для-telegram"  # Измените на свой!
BOT_TOKEN = "7499247525:AAGxVMerXFep1ty4AtQ3uOihrnLc9xgersQ"
SPIN_COST = 10
FREE_COOLDOWN = 24  # часов

app = Flask(__name__)
CORS(app)  # Разрешаем запросы с других доменов

# ============ ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ============
def init_database():
    """Создаёт базу данных и таблицы если их нет"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Таблица пользователей
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            balance INTEGER DEFAULT 100,
            last_free_spin TIMESTAMP,
            referrer_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_admin INTEGER DEFAULT 0
        )
    ''')
    
    # Таблица спинов
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS spins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            spin_type TEXT,
            bet_amount INTEGER,
            win_amount INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Таблица рефералов
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS referrals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            referrer_id INTEGER,
            referral_id INTEGER,
            rewarded INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()
    print("✅ База данных инициализирована")

# ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============
def get_db_connection():
    """Возвращает соединение с БД"""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def validate_telegram_data(init_data):
    """Проверяет подпись данных от Telegram"""
    try:
        if not init_data:
            return False, {}
        
        # Для теста пропускаем без проверки
        # В продакшене нужно реализовать полную проверку
        return True, {'user': init_data}
    except Exception as e:
        print(f"Ошибка валидации: {e}")
        return False, {}

# ============ API ЭНДПОИНТЫ ============
@app.route('/', methods=['GET'])
def home():
    return jsonify({
        'status': 'online',
        'service': 'Standoff2 Roulette API',
        'database': DB_FILE,
        'time': datetime.now().isoformat()
    })

@app.route('/api/user', methods=['POST'])
def get_user():
    """Получить или создать пользователя"""
    data = request.json
    user_id = data.get('userId')
    init_data = data.get('initData')
    
    if not user_id:
        return jsonify({'error': 'No user ID'}), 400
    
    # Для теста создаём тестовые данные
    username = f"user_{user_id}"
    first_name = f"Player {user_id}"
    
    conn = get_db_connection()
    
    # Проверяем, существует ли пользователь
    user = conn.execute('SELECT * FROM users WHERE user_id = ?', (user_id,)).fetchone()
    
    if not user:
        # Создаём нового пользователя
        conn.execute('''
            INSERT INTO users (user_id, username, first_name, balance)
            VALUES (?, ?, ?, 100)
        ''', (user_id, username, first_name))
        conn.commit()
        
        user = conn.execute('SELECT * FROM users WHERE user_id = ?', (user_id,)).fetchone()
        print(f"✅ Новый пользователь: {user_id}")
    
    conn.close()
    
    return jsonify({
        'user_id': user['user_id'],
        'balance': user['balance'],
        'lastFreeSpin': user['last_free_spin'],
        'username': user['username']
    })

@app.route('/api/spin', methods=['POST'])
def process_spin():
    """Обработка спина"""
    data = request.json
    user_id = data.get('userId')
    spin_type = data.get('spinType')  # 'free' или 'paid'
    win_amount = data.get('winAmount', 0)
    
    if not user_id or not spin_type:
        return jsonify({'error': 'Missing data'}), 400
    
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE user_id = ?', (user_id,)).fetchone()
    
    if not user:
        conn.close()
        return jsonify({'error': 'User not found'}), 404
    
    bet_amount = 0
    now = datetime.now()
    
    if spin_type == 'paid':
        # Проверяем баланс
        if user['balance'] < SPIN_COST:
            conn.close()
            return jsonify({'error': 'Insufficient balance'}), 400
        
        bet_amount = SPIN_COST
        new_balance = user['balance'] - SPIN_COST + win_amount
        
    elif spin_type == 'free':
        # Проверяем время
        if user['last_free_spin']:
            last = datetime.fromisoformat(user['last_free_spin'])
            hours_passed = (now - last).total_seconds() / 3600
            if hours_passed < FREE_COOLDOWN:
                conn.close()
                return jsonify({'error': 'Free spin not available'}), 400
        
        new_balance = user['balance'] + win_amount
        
        # Обновляем время бесплатного спина
        conn.execute('''
            UPDATE users SET last_free_spin = ? WHERE user_id = ?
        ''', (now.isoformat(), user_id))
    else:
        conn.close()
        return jsonify({'error': 'Invalid spin type'}), 400
    
    # Обновляем баланс
    conn.execute('''
        UPDATE users SET balance = ? WHERE user_id = ?
    ''', (new_balance, user_id))
    
    # Записываем спин в историю
    conn.execute('''
        INSERT INTO spins (user_id, spin_type, bet_amount, win_amount)
        VALUES (?, ?, ?, ?)
    ''', (user_id, spin_type, bet_amount, win_amount))
    
    conn.commit()
    
    # Получаем обновлённые данные
    updated_user = conn.execute('SELECT * FROM users WHERE user_id = ?', (user_id,)).fetchone()
    conn.close()
    
    return jsonify({
        'newBalance': updated_user['balance'],
        'lastFreeSpin': updated_user['last_free_spin'],
        'winAmount': win_amount
    })

@app.route('/api/referral', methods=['POST'])
def process_referral():
    """Обработка реферальной ссылки"""
    data = request.json
    user_id = data.get('userId')
    referrer_id = data.get('referrerId')
    
    if not user_id or not referrer_id:
        return jsonify({'error': 'Missing data'}), 400
    
    # Не даём рефернуть самого себя
    if user_id == referrer_id:
        return jsonify({'error': 'Cannot refer yourself'}), 400
    
    conn = get_db_connection()
    
    # Проверяем, не был ли уже этот реферал
    existing = conn.execute(
        'SELECT * FROM referrals WHERE referral_id = ?', 
        (user_id,)
    ).fetchone()
    
    if existing:
        conn.close()
        return jsonify({'success': False, 'message': 'Already referred'})
    
    # Проверяем, что реферер существует
    referrer = conn.execute(
        'SELECT * FROM users WHERE user_id = ?', 
        (referrer_id,)
    ).fetchone()
    
    if not referrer:
        conn.close()
        return jsonify({'error': 'Referrer not found'}), 404
    
    # Записываем реферала
    conn.execute('''
        INSERT INTO referrals (referrer_id, referral_id, rewarded)
        VALUES (?, ?, 0)
    ''', (referrer_id, user_id))
    
    # Начисляем бонус рефереру (50G)
    conn.execute('''
        UPDATE users SET balance = balance + 50 WHERE user_id = ?
    ''', (referrer_id,))
    
    conn.commit()
    conn.close()
    
    print(f"🎁 Реферал! {referrer_id} привел {user_id}")
    return jsonify({'success': True, 'bonus': 50})

@app.route('/api/stats/<int:user_id>', methods=['GET'])
def get_stats(user_id):
    """Получить статистику пользователя"""
    conn = get_db_connection()
    
    # Общая статистика
    total_spins = conn.execute(
        'SELECT COUNT(*) FROM spins WHERE user_id = ?', 
        (user_id,)
    ).fetchone()[0]
    
    total_wins = conn.execute(
        'SELECT SUM(win_amount) FROM spins WHERE user_id = ?', 
        (user_id,)
    ).fetchone()[0] or 0
    
    max_win = conn.execute(
        'SELECT MAX(win_amount) FROM spins WHERE user_id = ?', 
        (user_id,)
    ).fetchone()[0] or 0
    
    free_spins = conn.execute(
        'SELECT COUNT(*) FROM spins WHERE user_id = ? AND spin_type = "free"', 
        (user_id,)
    ).fetchone()[0]
    
    paid_spins = conn.execute(
        'SELECT COUNT(*) FROM spins WHERE user_id = ? AND spin_type = "paid"', 
        (user_id,)
    ).fetchone()[0]
    
    # Рефералы
    referrals = conn.execute(
        'SELECT COUNT(*) FROM referrals WHERE referrer_id = ?', 
        (user_id,)
    ).fetchone()[0]
    
    conn.close()
    
    return jsonify({
        'total_spins': total_spins,
        'total_wins': total_wins,
        'max_win': max_win,
        'free_spins': free_spins,
        'paid_spins': paid_spins,
        'referrals': referrals
    })

@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    """Топ игроков по балансу"""
    conn = get_db_connection()
    
    leaders = conn.execute('''
        SELECT user_id, username, balance 
        FROM users 
        ORDER BY balance DESC 
        LIMIT 10
    ''').fetchall()
    
    conn.close()
    
    return jsonify([dict(row) for row in leaders])

# ============ ЗАПУСК ============
if __name__ == '__main__':
    init_database()
    print("=" * 60)
    print("🔥 STANDOFF2 РУЛЕТКА - СЕРВЕР ЗАПУЩЕН")
    print("=" * 60)
    print(f"📁 База данных: {DB_FILE}")
    print(f"🌐 API: http://localhost:5000")
    print(f"📊 Статистика: http://localhost:5000/api/leaderboard")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=True)