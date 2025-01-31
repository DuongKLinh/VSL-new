import cv2
import mediapipe as mp
import numpy as np
import json
from keras.models import load_model # type: ignore
import os

# Khởi tạo MediaPipe Hands
mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# Load model và labels
model = load_model('../preparation/results/best.keras')  
with open('../dataset/labels.json', 'r', encoding='utf-8') as f:
    labels_json = json.load(f)

def get_label_by_index(index):
    """Lấy nhãn từ index"""
    for key, value in labels_json.items():
        if value["index"] == index:
            return value["label_with_diacritics"]
    return None

def process_frame(frame):
    """Xử lý frame và trích xuất tọa độ bàn tay"""
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = hands.process(frame_rgb)
    coordinates = []

    if results.multi_hand_landmarks:
        # Vẽ các điểm mốc trên frame
        for hand_landmarks in results.multi_hand_landmarks:
            mp_drawing.draw_landmarks(
                frame,
                hand_landmarks,
                mp_hands.HAND_CONNECTIONS,
                mp_drawing_styles.get_default_hand_landmarks_style(),
                mp_drawing_styles.get_default_hand_connections_style()
            )
            
            # Thu thập tọa độ
            for lm in hand_landmarks.landmark:
                coordinates.append([lm.x, lm.y])

    # Đảm bảo luôn có 42 điểm (21 điểm x 2 bàn tay)
    while len(coordinates) < 42:
        coordinates.append([-1, -1])

    return frame, coordinates

def main():
    cap = cv2.VideoCapture(0)
    frame_buffer = []
    prediction_text = "Đang chờ..."
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            print("Không thể đọc frame từ camera")
            break

        # Xử lý frame
        frame, coordinates = process_frame(frame)
        
        # Kiểm tra nếu có bàn tay trong frame
        has_hand = any(coord != [-1, -1] for coord in coordinates)
        
        if has_hand:
            frame_buffer.append(coordinates)
            
            # Khi đủ 60 frames, thực hiện dự đoán
            if len(frame_buffer) >= 60:
                # Chuẩn bị dữ liệu cho model
                data_X = np.array(frame_buffer, dtype=np.float32)
                data_X = data_X.reshape(1, 60, -1)  # Reshape thành (1, 60, 84)
                
                # Dự đoán
                predictions = model.predict(data_X)
                predicted_index = np.argmax(predictions)
                
                # Lấy nhãn
                label = get_label_by_index(predicted_index)
                if label:
                    prediction_text = f"Dự đoán: {label}"
                
                # Reset buffer
                frame_buffer = []
        else:
            prediction_text = "Không phát hiện bàn tay"

        # Hiển thị kết quả lên frame
        cv2.putText(
            frame, 
            prediction_text, 
            (10, 30), 
            cv2.FONT_HERSHEY_SIMPLEX, 
            1, 
            (0, 255, 0), 
            2
        )

        # Hiển thị frame
        cv2.imshow('Demo Nhận Diện Ký Hiệu', frame)

        # Thoát khi nhấn 'q'
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()