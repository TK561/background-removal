#!/usr/bin/env python3
"""
🎨 AI背景除去 - 履歴機能付き版
- 複数選択対応 ✅
- 柔軟アップロード ✅  
- 処理履歴保存 ✅
- 履歴検索・フィルタ ✅
- 履歴からの再ダウンロード ✅
"""

import os
import time
import json
import hashlib
from datetime import datetime, timedelta
from flask import Flask, request, send_file, render_template, jsonify
from PIL import Image, ImageOps
import numpy as np
import cv2
import mediapipe as mp
import onnxruntime
from io import BytesIO
import sqlite3
from pathlib import Path
import base64

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB

# 履歴データベース設定
DB_PATH = 'history.db'

# グローバル進行状況管理
processing_status = {}
batch_status = {}

# モデル初期化
mp_seg = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=1)
try:
    rvm_sess = onnxruntime.InferenceSession("rvm.onnx", providers=["CPUExecutionProvider"])
    u2_sess = onnxruntime.InferenceSession("u2net.onnx", providers=["CPUExecutionProvider"])
except:
    rvm_sess = None
    u2_sess = None

def init_database():
    """履歴データベースを初期化"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 履歴テーブル作成
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS processing_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT UNIQUE,
            original_filename TEXT,
            file_size INTEGER,
            image_width INTEGER,
            image_height INTEGER,
            processing_time REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            file_hash TEXT,
            result_data BLOB,
            tags TEXT,
            notes TEXT
        )
    ''')
    
    # インデックス作成
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_created_at ON processing_history(created_at)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_filename ON processing_history(original_filename)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_file_hash ON processing_history(file_hash)')
    
    conn.commit()
    conn.close()

def save_to_history(session_id, filename, file_size, img_size, processing_time, file_hash, result_data, tags="", notes=""):
    """処理結果を履歴に保存"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO processing_history 
            (session_id, original_filename, file_size, image_width, image_height, 
             processing_time, file_hash, result_data, tags, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (session_id, filename, file_size, img_size[0], img_size[1], 
              processing_time, file_hash, result_data, tags, notes))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"履歴保存エラー: {e}")
        return False

def get_history(limit=50, search_query="", days_back=30):
    """履歴を取得"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # 基本クエリ
        base_query = '''
            SELECT id, session_id, original_filename, file_size, image_width, image_height,
                   processing_time, created_at, tags, notes
            FROM processing_history 
            WHERE created_at >= datetime('now', '-{} days')
        '''.format(days_back)
        
        params = []
        
        # 検索条件追加
        if search_query:
            base_query += " AND (original_filename LIKE ? OR tags LIKE ? OR notes LIKE ?)"
            search_pattern = f"%{search_query}%"
            params.extend([search_pattern, search_pattern, search_pattern])
        
        # ソート・制限
        base_query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        
        cursor.execute(base_query, params)
        rows = cursor.fetchall()
        
        # 統計情報も取得
        cursor.execute('''
            SELECT COUNT(*) as total_count,
                   SUM(file_size) as total_size,
                   AVG(processing_time) as avg_time
            FROM processing_history 
            WHERE created_at >= datetime('now', '-{} days')
        '''.format(days_back))
        
        stats = cursor.fetchone()
        
        conn.close()
        
        # 結果整形
        history_items = []
        for row in rows:
            history_items.append({
                'id': row[0],
                'session_id': row[1],
                'filename': row[2],
                'file_size': row[3],
                'image_width': row[4],
                'image_height': row[5],
                'processing_time': row[6],
                'created_at': row[7],
                'tags': row[8] or '',
                'notes': row[9] or ''
            })
        
        return {
            'items': history_items,
            'stats': {
                'total_count': stats[0] or 0,
                'total_size': stats[1] or 0,
                'avg_time': stats[2] or 0
            }
        }
        
    except Exception as e:
        print(f"履歴取得エラー: {e}")
        return {'items': [], 'stats': {'total_count': 0, 'total_size': 0, 'avg_time': 0}}

def get_history_result(session_id):
    """履歴から処理結果データを取得"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('SELECT result_data FROM processing_history WHERE session_id = ?', (session_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row and row[0]:
            return row[0]
        return None
        
    except Exception as e:
        print(f"履歴結果取得エラー: {e}")
        return None

def calculate_file_hash(file_data):
    """ファイルのハッシュ値を計算"""
    return hashlib.md5(file_data).hexdigest()

def remove_background_simple(image):
    """シンプルな背景除去（MediaPipe使用）"""
    try:
        # BGRからRGBに変換
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # MediaPipeで処理
        results = mp_seg.process(image_rgb)
        
        if results.segmentation_mask is not None:
            # マスクを取得
            mask = results.segmentation_mask
            mask = (mask * 255).astype(np.uint8)
            
            # マスクを3チャンネルに拡張
            mask_3d = np.stack([mask, mask, mask], axis=-1)
            
            # 背景を除去（アルファチャンネル追加）
            foreground = cv2.bitwise_and(image, image, mask=mask)
            
            # BGRAに変換
            b, g, r = cv2.split(foreground)
            bgra = cv2.merge([b, g, r, mask])
            
            return bgra
        else:
            # 処理失敗時は元画像を返す
            return image
            
    except Exception as e:
        print(f"背景除去エラー: {e}")
        return image

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/process', methods=['POST'])
def process_images():
    """画像処理エンドポイント"""
    try:
        if 'files' not in request.files:
            return jsonify({'error': 'ファイルがありません'}), 400
        
        files = request.files.getlist('files')
        results = []
        
        for file in files:
            if file.filename == '':
                continue
                
            # ファイル読み込み
            file_data = file.read()
            file_hash = calculate_file_hash(file_data)
            
            # 画像処理
            start_time = time.time()
            
            # numpy配列に変換
            nparr = np.frombuffer(file_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if image is None:
                continue
            
            # 背景除去
            result_image = remove_background_simple(image)
            
            # PNGにエンコード
            _, buffer = cv2.imencode('.png', result_image)
            result_data = buffer.tobytes()
            
            processing_time = time.time() - start_time
            
            # 履歴に保存
            session_id = f"{file_hash}_{int(time.time() * 1000)}"
            img_height, img_width = image.shape[:2]
            
            save_to_history(
                session_id=session_id,
                filename=file.filename,
                file_size=len(file_data),
                img_size=(img_width, img_height),
                processing_time=processing_time,
                file_hash=file_hash,
                result_data=result_data
            )
            
            # Base64エンコードして返す
            result_b64 = base64.b64encode(result_data).decode('utf-8')
            
            results.append({
                'filename': file.filename,
                'session_id': session_id,
                'processing_time': processing_time,
                'result_data': f'data:image/png;base64,{result_b64}'
            })
        
        return jsonify({'success': True, 'results': results})
        
    except Exception as e:
        print(f"処理エラー: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/history')
def get_history_api():
    """履歴API"""
    search = request.args.get('search', '')
    days = int(request.args.get('days', 30))
    
    history = get_history(search_query=search, days_back=days)
    return jsonify(history)

@app.route('/download/<session_id>')
def download_result(session_id):
    """履歴から結果をダウンロード"""
    result_data = get_history_result(session_id)
    if result_data:
        return send_file(
            BytesIO(result_data),
            mimetype='image/png',
            as_attachment=True,
            download_name=f'nobg_{session_id}.png'
        )
    else:
        return jsonify({'error': '結果が見つかりません'}), 404

if __name__ == '__main__':
    # テンプレートフォルダを作成
    os.makedirs('templates', exist_ok=True)
    
    # index.htmlが存在しない場合は作成
    if not os.path.exists('templates/index.html'):
        with open('templates/index.html', 'w', encoding='utf-8') as f:
            f.write("""<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI背景除去（履歴付き）</title>
    <link rel="stylesheet" href="{{ url_for('static', filename='css/style.css') }}">
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎨 AI背景除去</h1>
            <p class="subtitle">複数写真対応 | 処理履歴付き | 完全無料</p>
        </div>
        
        <!-- タブナビゲーション -->
        <div class="tab-nav">
            <button class="tab-button active" onclick="showTab('upload')">📸 新規処理</button>
            <button class="tab-button" onclick="showTab('history')">📚 履歴</button>
        </div>
        
        <!-- コンテンツはJavaScriptで動的に追加 -->
        <div id="content"></div>
    </div>
    
    <script src="{{ url_for('static', filename='js/main.js') }}"></script>
</body>
</html>""")
    
    init_database()
    app.run(debug=True, host='0.0.0.0', port=5000)