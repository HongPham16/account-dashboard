# Account Dashboard v3

## Chạy dự án

```bat
copy .env.example .env
npm install
node app.js
```

Mở: http://localhost:3000

## Các điểm chính

- Mặc định KHÔNG yêu cầu đăng nhập hay mật khẩu.
- Trong `Cài đặt hệ thống` có công tắc `Bật bảo vệ bằng mật khẩu`.
- Chỉ khi bật công tắc này website mới chuyển người dùng sang `/unlock`.
- Nếu chưa thay đổi, mật khẩu mặc định là `123456`.
- `Thêm tài khoản` đưa tài khoản vào **kho cấp** (`status=available`).
- `Lấy tài khoản` dùng transaction SQLite để tránh cấp trùng khi nhiều thiết bị bấm đồng thời.
- `Yêu cầu đưa vào kho lưu trữ` chuyển tài khoản vừa lấy sang **kho lưu trữ riêng** (`status=archived`). Tài khoản archived không được cấp lại tự động.
- Trang `/accounts/storage` dùng để xem kho lưu trữ. Chỉ khi bấm `Khôi phục về kho cấp`, tài khoản mới quay về luồng cấp.
- Email rút tiền nhanh dùng alias kiểu `email+random@gmail.com` và đổi mỗi lần tải lại trang.
- iCloud có 4 trường: tài khoản, mật khẩu và 2 trường tùy chỉnh.


## V7
- Nút Lấy tài khoản có thể bấm liên tiếp; mỗi lần lấy tài khoản khả dụng tiếp theo.
- Nút đưa vào kho lưu trữ luôn áp dụng cho tài khoản đang hiển thị (tài khoản vừa lấy gần nhất).
