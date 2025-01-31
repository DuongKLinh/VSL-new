import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import KFold
from sklearn.metrics import confusion_matrix
import json
import os
from vsldataset import VSLDataset
from modeling import CNNLSTMModel
import tensorflow as tf

class DataAnalyzer:
    def __init__(self, data_path='../dataset/'):
        self.data_path = data_path
        # Load labels
        with open(os.path.join(data_path, 'labels.json'), 'r', encoding='utf-8') as f:
            self.labels = json.load(f)
        
        # Load dataset
        self.dataset = VSLDataset(
            numpy_x_file=os.path.join(data_path, 'data_X.npy'),
            numpy_y_file=os.path.join(data_path, 'data_Y.npy')
        )
        
        # Load data
        self.data_X = np.load(os.path.join(data_path, 'data_X.npy'), allow_pickle=True)
        self.data_Y = np.load(os.path.join(data_path, 'data_Y.npy'))

    def analyze_data_distribution(self):
        """Phân tích phân bố dữ liệu"""
        plt.figure(figsize=(12, 6))
        
        # Đếm số lượng mẫu cho mỗi nhãn
        unique_labels, counts = np.unique(self.data_Y, return_counts=True)
        
        # Tạo danh sách tên nhãn
        label_names = []
        for idx in unique_labels:
            for key, value in self.labels.items():
                if value['index'] == idx:
                    label_names.append(f"{key}\n({value['label_with_diacritics']})")
                    break
        
        # Vẽ biểu đồ
        sns.barplot(x=label_names, y=counts)
        plt.title('Phân bố số lượng mẫu cho mỗi nhãn')
        plt.xlabel('Nhãn')
        plt.ylabel('Số lượng mẫu')
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        
        # Lưu biểu đồ
        os.makedirs('analysis_results', exist_ok=True)
        plt.savefig('analysis_results/data_distribution.png')
        plt.close()
        
        # In thống kê
        print("\nThống kê số lượng mẫu:")
        for label, count in zip(label_names, counts):
            print(f"{label}: {count} mẫu")
        
        return counts

    def perform_cross_validation(self, k=5, epochs=50):
        """Thực hiện k-fold cross validation"""
        kf = KFold(n_splits=k, shuffle=True, random_state=42)
        
        # Reshape data
        X = np.array(self.data_X, dtype=np.float32).reshape(self.data_X.shape[0], self.data_X.shape[1], -1)
        y = np.array(self.data_Y, dtype=np.float32)
        
        accuracies = []
        histories = []
        confusion_matrices = []
        
        for fold, (train_idx, val_idx) in enumerate(kf.split(X)):
            print(f"\nFold {fold + 1}/{k}")
            
            # Split data
            X_train, X_val = X[train_idx], X[val_idx]
            y_train, y_val = y[train_idx], y[val_idx]
            
            # Create and train model
            model = CNNLSTMModel(
                input_shape=(X.shape[1], X.shape[2]), 
                num_classes=len(self.labels)
            )
            
            # Convert to TF dataset
            train_dataset = tf.data.Dataset.from_tensor_slices((X_train, y_train)).batch(32)
            val_dataset = tf.data.Dataset.from_tensor_slices((X_val, y_val)).batch(32)
            
            # Train
            history = model.model.fit(
                train_dataset,
                validation_data=val_dataset,
                epochs=epochs,
                verbose=1
            )
            
            # Evaluate
            val_pred = np.argmax(model.model.predict(X_val), axis=1)
            cm = confusion_matrix(y_val, val_pred)
            
            accuracies.append(history.history['val_accuracy'][-1])
            histories.append(history.history)
            confusion_matrices.append(cm)
            
            # Plot confusion matrix for this fold
            plt.figure(figsize=(10, 8))
            sns.heatmap(cm, annot=True, fmt='d')
            plt.title(f'Confusion Matrix - Fold {fold + 1}')
            plt.xlabel('Predicted')
            plt.ylabel('True')
            plt.savefig(f'analysis_results/confusion_matrix_fold_{fold+1}.png')
            plt.close()

        # Plot average learning curves
        self._plot_average_learning_curves(histories)
        
        # Print results
        print("\nKết quả Cross-validation:")
        print(f"Độ chính xác trung bình: {np.mean(accuracies):.4f} ± {np.std(accuracies):.4f}")
        
        return accuracies, histories, confusion_matrices

    def _plot_average_learning_curves(self, histories):
        """Vẽ đường cong học tập trung bình"""
        plt.figure(figsize=(12, 4))
        
        # Plot training & validation accuracy
        plt.subplot(1, 2, 1)
        self._plot_learning_curve(histories, 'accuracy', 'val_accuracy')
        plt.title('Model Accuracy')
        plt.ylabel('Accuracy')
        plt.xlabel('Epoch')
        plt.legend(['Train', 'Validation'], loc='lower right')
        
        # Plot training & validation loss
        plt.subplot(1, 2, 2)
        self._plot_learning_curve(histories, 'loss', 'val_loss')
        plt.title('Model Loss')
        plt.ylabel('Loss')
        plt.xlabel('Epoch')
        plt.legend(['Train', 'Validation'], loc='upper right')
        
        plt.tight_layout()
        plt.savefig('analysis_results/learning_curves.png')
        plt.close()

    def _plot_learning_curve(self, histories, train_key, val_key):
        """Vẽ đường cong học tập với độ lệch chuẩn"""
        # Calculate mean and std
        train_values = np.array([h[train_key] for h in histories])
        val_values = np.array([h[val_key] for h in histories])
        
        epochs = range(1, len(histories[0][train_key]) + 1)
        train_mean = np.mean(train_values, axis=0)
        train_std = np.std(train_values, axis=0)
        val_mean = np.mean(val_values, axis=0)
        val_std = np.std(val_values, axis=0)
        
        # Plot mean
        plt.plot(epochs, train_mean, '-')
        plt.plot(epochs, val_mean, '-')
        
        # Plot standard deviation
        plt.fill_between(epochs, train_mean - train_std, train_mean + train_std, alpha=0.1)
        plt.fill_between(epochs, val_mean - val_std, val_mean + val_std, alpha=0.1)

if __name__ == "__main__":
    analyzer = DataAnalyzer()
    
    # Phân tích phân bố dữ liệu
    print("Đang phân tích phân bố dữ liệu...")
    counts = analyzer.analyze_data_distribution()
    
    # Thực hiện cross-validation
    print("\nĐang thực hiện cross-validation...")
    accuracies, histories, cms = analyzer.perform_cross_validation(k=5, epochs=50)