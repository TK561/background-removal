import os
from flask import Flask, request, jsonify, render_template_string
from PIL import Image
import numpy as np
import cv2
import mediapipe as mp
from io import BytesIO
import base64

app = Flask(__name__)
mp_seg = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=1)

@app.route('/')
def index():
    return '''
<!DOCTYPE html>
<html>
<head>
    <title>AI背景除去</title>
    <style>
        body { font-family: Arial; max-width: 600px; margin: 50px auto; text-align: center; }
        input[type="file"] { margin: 20px; }
        button { background: #4CAF50; color: white; padding: 10px 30px; border: none; 
                border-radius: 5px; font-size: 16px; cursor: pointer; }
        #result { margin-top: 20px; }
        img { max-width: 100%; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>🎨 AI背景除去</h1>
    <input type="file" id="fileInput" accept="image/*">
    <br>
    <button onclick="processImage()">背景を除去</button>
    <div id="result"></div>
    
    <script>
        async function processImage() {
            const fileInput = document.getElementById('fileInput');
            const file = fileInput.files[0];
            if (!file) {
                alert('画像を選択してください');
                return;
            }
            
            const formData = new FormData();
            formData.append('image', file);
            
            document.getElementById('result').innerHTML = '処理中...';
            
            try {
                const response = await fetch('/remove-bg', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    document.getElementById('result').innerHTML = 
                        '<h2>完成！</h2>' +
                        '<img src="' + data.result + '">' +
                        '<br><a href="' + data.result + '" download="no-bg.png">' +
                        '<button>ダウンロード</button></a>';
                } else {
                    document.getElementById('result').innerHTML = 'エラー: ' + data.error;
                }
            } catch (err) {
                document.getElementById('result').innerHTML = 'エラー: ' + err.message;
            }
        }
    </script>
</body>
</html>
'''

@app.route('/remove-bg', methods=['POST'])
def remove_bg():
    try:
        file = request.files['image']
        image = Image.open(file.stream).convert('RGB')
        image_np = np.array(image)
        image_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
        
        results = mp_seg.process(cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB))
        
        if results.segmentation_mask is not None:
            mask = (results.segmentation_mask * 255).astype(np.uint8)
            image_rgba = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2BGRA)
            image_rgba[:, :, 3] = mask
            
            _, buffer = cv2.imencode('.png', image_rgba)
            result_b64 = base64.b64encode(buffer).decode('utf-8')
            
            return jsonify({'success': True, 'result': f'data:image/png;base64,{result_b64}'})
        else:
            return jsonify({'success': False, 'error': '処理失敗'})
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
