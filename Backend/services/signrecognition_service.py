import numpy as np
import tensorflow as tf
from keras.models import load_model # type: ignore
import json

class SignRecognition:
    def __init__(self, cnn_lstm_model, input_shape=(60, 42, 2), num_classes=3):
        self.model = cnn_lstm_model.model
        self.input_shape = input_shape
        self.num_classes = num_classes

    def predict(self, data_X):
        """
        Takes the processed hand coordinates and predicts the label using the model.
        Returns None if there's not enough valid data.
        
        :param data_X: List of hand coordinates
        :return: Predicted label index (integer) or None if invalid data
        """
        # Kiểm tra xem có đủ dữ liệu không
        if not data_X or len(data_X) < self.input_shape[0]:
            return None
            
        data_X = np.array(data_X)
        # Chuyển đổi dữ liệu sang float32 và reshape cho CNN-LSTM
        data_X = np.array(data_X, dtype=np.float32).reshape(data_X.shape[0], -1)

        # Thêm chiều batch
        data_X = np.expand_dims(data_X, axis=0)
        
        # Dự đoán
        predictions = self.model.predict(data_X)
        predicted_index = np.argmax(predictions)
        
        return predicted_index
    
if __name__ == "__main__":
    from videoprocess_service import VideoProcessor
    from preparation.modeling import CNNLSTMModel # test

    with open('../dataset/labels.json', 'r', encoding='utf-8') as file:
        labels_json = json.load(file)

    num_classes = len(labels_json)
    # Path to the pre-trained model
    model_path = '../preparation/results/best.keras'
    cnn_lstm_model = CNNLSTMModel(input_shape=(60, 84), num_classes=num_classes)
    cnn_lstm_model.load_model_from_file(model_path)

    # Initialize the VideoProcessor and SignRecognition
    video_processor = VideoProcessor()
    data_X, frames = video_processor.process_video_from_path('../test.mp4')

    # Initialize the SignRecognition class with the model path
    sign_recognition = SignRecognition(cnn_lstm_model)
    # Predict the sign label from the processed coordinates
    predicted_index = sign_recognition.predict(data_X)

    print(predicted_index)
