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

    def train(self, train_dataset, validation_dataset=None, epochs=100, patience=10, model_path='best.keras', results_dir='results'):
        # Ensure results directory exists
        os.makedirs(results_dir, exist_ok=True)
        model_path = os.path.join(results_dir, model_path)

        # Callbacks for early stopping and model checkpointing
        
        early_stopping = EarlyStopping(monitor='loss', patience=patience, restore_best_weights=True, mode='min')
        model_checkpoint = ModelCheckpoint(model_path, 
                                            monitor='loss', 
                                            save_best_only=True, 
                                            mode='min', 
                                            verbose=1)

        reduce_lr = ReduceLROnPlateau(
            monitor='val_loss' if validation_dataset else 'loss',
            factor=0.5,
            patience=3,
            min_lr=1e-6,
            verbose=1
        )
        
        # Thêm reduce_lr vào danh sách callbacks
        callbacks = [early_stopping, model_checkpoint, reduce_lr]
        
        # Train the model
        print("Training the model...")
        history = self.model.fit(
            train_dataset,
            epochs=epochs,
            validation_data=validation_dataset,
            verbose=1,
            callbacks=callbacks
        )

        print(f"Training complete. Best model saved as '{model_path}'")

        # Save training history
        history_path = os.path.join(results_dir, 'training_history.npy')
        np.save(history_path, history.history)
        print(f"Training history saved to '{history_path}'")

        # Plot loss and accuracy
        import matplotlib.pyplot as plt
        plt.figure()
        plt.plot(history.history['loss'], label='Loss')
        plt.plot(history.history['accuracy'], label='Accuracy')
        plt.xlabel('Epochs')
        plt.ylabel('Value')
        plt.legend()
        plt.title('Training Metrics')
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
        from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay
        cm = confusion_matrix(true_classes, predicted_classes)
        disp = ConfusionMatrixDisplay(confusion_matrix=cm)
        cm_path = os.path.join(results_dir, 'confusion_matrix.png')

        # Plot and save confusion matrix
        disp.plot()
        plt.savefig(cm_path)
        plt.close()
        print(f"Confusion matrix saved to '{cm_path}'")

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
    train_dataset, test_dataset = dataset.create_datasets(test_size=0.2, batch_size=32)

    # Define input shape and number of classes
    input_shape = (60, 84)  # (timesteps, features)
    num_classes = len(labels_json)

    # Create and train the CNN-LSTM model
    cnn_lstm_model = CNNLSTMModel(input_shape, num_classes)
    history = cnn_lstm_model.train(train_dataset, epochs=50, patience=5, model_path='best.keras', results_dir='./results')

    # Evaluate and save confusion matrix
    cnn_lstm_model.evaluate_and_save_confusion_matrix(test_dataset, results_dir='./results')
