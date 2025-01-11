import json
import numpy as np
import tensorflow as tf
from keras.models import Sequential # type: ignore
from keras.layers import Conv1D, MaxPooling1D, Dropout, Reshape, LSTM, Dense # type: ignore
from keras.regularizers import l2 # type: ignore
from keras.optimizers import Adam # type: ignore
from keras.callbacks import EarlyStopping, ModelCheckpoint # type: ignore
import matplotlib.pyplot as plt
import os
from keras.models import load_model # type: ignore
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay
from keras.layers import BatchNormalization, Bidirectional # type: ignore
from keras.callbacks import ReduceLROnPlateau # type: ignore

class CNNLSTMModel:
    def __init__(self, input_shape, num_classes):
        self.input_shape = input_shape
        self.num_classes = num_classes
        self.model = self._build_model()

    def _build_model(self):
        model = Sequential([
            # Block 1: Xử lý đặc trưng thời gian
            Conv1D(32, kernel_size=5, activation='relu', padding='same', input_shape=self.input_shape),
            BatchNormalization(),
            MaxPooling1D(pool_size=2),
            
            # Block 2: Trích xuất đặc trưng chi tiết
            Conv1D(64, kernel_size=3, activation='relu', padding='same'),
            BatchNormalization(),
            MaxPooling1D(pool_size=2),
            
            # Block 3: Xử lý chuỗi thời gian
            Bidirectional(LSTM(64, return_sequences=True)),
            Bidirectional(LSTM(32)),
            
            # Block 4: Phân loại
            Dense(64, activation='relu'),
            BatchNormalization(),
            Dropout(0.3),
            Dense(self.num_classes, activation='softmax')
        ])

        # Sử dụng optimizer với learning rate thấp hơn và gradient clipping
        optimizer = Adam(learning_rate=0.0001, clipnorm=1.0)
        
        model.compile(
            optimizer=optimizer,
            loss='sparse_categorical_crossentropy',
            metrics=['accuracy']
        )
        
        return model

    def train(self, train_dataset, validation_dataset, epochs=100, patience=10, model_path='best.keras', results_dir='results'):
        # Ensure results directory exists
        os.makedirs(results_dir, exist_ok=True)
        model_path = os.path.join(results_dir, model_path)

        # Callbacks for early stopping and model checkpointing
        early_stopping = EarlyStopping(monitor='val_loss', patience=patience, restore_best_weights=True, mode='min')
        model_checkpoint = ModelCheckpoint(model_path, 
                                            monitor='val_loss', 
                                            save_best_only=True, 
                                            mode='min', 
                                            verbose=1)

        reduce_lr = ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=3,
            min_lr=1e-6,
            verbose=1
        )
        
        callbacks = [early_stopping, model_checkpoint, reduce_lr]
        
        # Train the model
        print("Training the model...")
        history = self.model.fit(
            train_dataset,
            validation_data=validation_dataset,
            epochs=epochs,
            verbose=1,
            callbacks=callbacks
        )

        print(f"Training complete. Best model saved as '{model_path}'")

        # Save training history
        history_path = os.path.join(results_dir, 'training_history.npy')
        np.save(history_path, history.history)
        print(f"Training history saved to '{history_path}'")

        # Plot loss and accuracy
        plt.figure()
        plt.plot(history.history['loss'], label='Train Loss')
        plt.plot(history.history['val_loss'], label='Validation Loss')
        plt.plot(history.history['accuracy'], label='Train Accuracy')
        plt.plot(history.history['val_accuracy'], label='Validation Accuracy')
        plt.xlabel('Epochs')
        plt.ylabel('Value')
        plt.legend()
        plt.title('Training and Validation Metrics')
        metrics_path = os.path.join(results_dir, 'training_metrics.png')
        plt.savefig(metrics_path)
        plt.close()
        print(f"Training metrics plot saved to '{metrics_path}'")

        return history

    def evaluate_and_save_confusion_matrix(self, test_dataset, results_dir='results'):
        # Ensure results directory exists
        os.makedirs(results_dir, exist_ok=True)

        # Evaluate model
        predictions = self.model.predict(test_dataset)
        predicted_classes = np.argmax(predictions, axis=1)
        
        true_classes = np.concatenate([y for _, y in test_dataset], axis=0).astype(int)

        # Compute confusion matrix
        cm = confusion_matrix(true_classes, predicted_classes)
        disp = ConfusionMatrixDisplay(confusion_matrix=cm)
        cm_path = os.path.join(results_dir, 'confusion_matrix_1.png')

        # Plot and save confusion matrix
        disp.plot()
        plt.savefig(cm_path)
        plt.close()
        print(f"Confusion matrix saved to '{cm_path}'")

    def calculate_test_accuracy(self, test_dataset, results_dir='results'):
        """
        Tính toán độ chính xác trên tập test
        
        :param test_dataset: Dataset kiểm thử
        :return: Độ chính xác và ma trận nhầm lẫn
        """
        # Đánh giá model
        test_loss, test_accuracy = self.model.evaluate(test_dataset, verbose=1)
        
        # Lấy dự đoán
        predictions = self.model.predict(test_dataset)
        predicted_classes = np.argmax(predictions, axis=1)
        
        # Lấy nhãn thực
        true_classes = np.concatenate([y for _, y in test_dataset], axis=0).astype(int)
        
        # Tính ma trận nhầm lẫn
        cm = confusion_matrix(true_classes, predicted_classes)
        disp = ConfusionMatrixDisplay(confusion_matrix=cm)
        cm_path = os.path.join(results_dir, 'confusion_matrix_2.png')

        # Plot and save confusion matrix
        disp.plot()
        plt.savefig(cm_path)
        plt.close()
        
        return {
            'accuracy': test_accuracy,
            'loss': test_loss,
            'confusion_matrix': cm
        }

    def load_model_from_file(self, model_path):
        """
        Load a trained model from the specified file path.

        :param model_path: Path to the saved model file.
        :return: The loaded Keras model.
        """
        if os.path.exists(model_path):
            self.model = load_model(model_path)
            print(f"Model loaded from {model_path}")
        else:
            print(f"Model file not found at {model_path}")

if __name__ == "__main__":
    from vsldataset import VSLDataset

    with open('../dataset/labels.json', 'r', encoding='utf-8') as file:
        labels_json = json.load(file)
    
    # Load the dataset
    dataset = VSLDataset(numpy_x_file='../dataset/data_X.npy', numpy_y_file='../dataset/data_Y.npy')
    train_dataset, val_dataset, test_dataset = dataset.create_datasets(train_size=0.7, val_size=0.2, batch_size=32)

    # Define input shape and number of classes
    input_shape = (60, 84)  # (timesteps, features)
    num_classes = len(labels_json)

    # Create and train the CNN-LSTM model
    cnn_lstm_model = CNNLSTMModel(input_shape, num_classes)
    history = cnn_lstm_model.train(train_dataset, validation_dataset=val_dataset, epochs=1000, patience=5, model_path='best.keras', results_dir='./results')

    # Evaluate and save confusion matrix
    cnn_lstm_model.evaluate_and_save_confusion_matrix(test_dataset, results_dir='./results_2')

    # Tính độ chính xác trên tập test
    test_results = cnn_lstm_model.calculate_test_accuracy(test_dataset, results_dir='./results_2')
    print("\nKết quả đánh giá trên tập test:")
    print(f"Độ chính xác: {test_results['accuracy']*100:.2f}%")
    print(f"Loss: {test_results['loss']:.4f}")

    # In ma trận nhầm lẫn
    print("\nMa trận nhầm lẫn:")
    print(test_results['confusion_matrix'])