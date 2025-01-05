import numpy as np
import tensorflow as tf
from keras.models import load_model # type: ignore
import json

class SignRecognition:
    def __init__(self, cnn_lstm_model, input_shape=(60, 42, 2), num_classes=3):
        """
        Initializes the SignRecognition class by loading the pre-trained CNN-LSTM model.
        
        :param model_path: Path to the saved model (e.g., .keras file)
        :param input_shape: Shape of the input data, typically (60, 42, 2)
        :param num_classes: Number of output classes for the model
        """
        
        self.model = cnn_lstm_model.model
        self.input_shape = input_shape
        self.num_classes = num_classes

    def predict(self, data_X):
        """
        Takes the processed hand coordinates, reshapes them, and predicts the label using the model.
        
        :param data_X: List of hand coordinates for 60 frames
        :return: Predicted label index (integer)
        """
        data_X = np.array(data_X)
        # Convert data_X to np.float32 and reshape it for the CNN-LSTM model
        data_X = np.array(data_X, dtype=np.float32).reshape(data_X.shape[0], -1)


        # Add an extra dimension to match the model input (batch_size, 60, 42, 2)
        data_X = np.expand_dims(data_X, axis=0)
        
        # Make prediction
        predictions = self.model.predict(data_X)

        # Assuming the model returns probabilities, use np.argmax() to get the predicted label index
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
