import matplotlib.pyplot as plt

# Dữ liệu mô phỏng cho biểu đồ Softmax
labels = ["Xin chào", "Cảm ơn", "Tôi yêu bạn"]
probabilities = [0.7, 0.2, 0.1]

# Tạo màu sắc
colors = ["#4CAF50", "#FF9800", "#F44336"]

# Vẽ biểu đồ
plt.figure(figsize=(6, 4))
bars = plt.bar(labels, probabilities, color=colors, alpha=0.8)

# Hiển thị giá trị trên từng cột
for bar, prob in zip(bars, probabilities):
    plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.02, 
             f"{prob*100:.0f}%", ha='center', fontsize=14, fontweight='bold')  # Cỡ chữ lớn hơn

# Thiết lập tiêu đề và trục với cỡ chữ
plt.ylim(0, 1)
plt.ylabel("Xác suất", fontsize=14)
plt.title("Biểu đồ Softmax - Phân loại cử chỉ tay", fontsize=16, fontweight='bold')  # Tiêu đề lớn hơn

# Chỉnh cỡ chữ của nhãn trục x
plt.xticks(fontsize=14)  
plt.yticks(fontsize=12)

# Hiển thị đường lưới nhẹ
plt.grid(axis='y', linestyle='--', alpha=0.7)

# Hiển thị biểu đồ
plt.show()
