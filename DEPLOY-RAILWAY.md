# Deploy account-dashboard lên Railway

## 1. GitHub
Đưa toàn bộ thư mục này lên một repository GitHub. Không commit `.env` hoặc database local.

## 2. Railway
- New Project -> Deploy from GitHub repo.
- Chọn repository.
- Railway build bằng `npm install` và chạy `npm start`.

## 3. Variables
Trong service -> Variables, tạo:

```text
NODE_ENV=production
SESSION_SECRET=<chuỗi ngẫu nhiên dài, riêng của bạn>
```

Không cần tạo `PORT`; Railway tự cung cấp.

## 4. Volume cho SQLite (BẮT BUỘC)
Trong service -> Volumes -> Add Volume.

Mount path đề xuất:

```text
/data
```

Ứng dụng tự nhận `RAILWAY_VOLUME_MOUNT_PATH` do Railway cung cấp và lưu database tại:

```text
/data/app.db
```

Nếu không gắn Volume, SQLite có thể mất sau deploy/redeploy.

## 5. Kiểm tra
Trong Networking -> Generate Domain, mở URL Railway. Kiểm tra:

```text
/healthz
```

phải trả về:

```json
{"ok":true}
```

Sau đó thử trang chính, thêm tài khoản, lấy tài khoản, reload và redeploy để chắc chắn dữ liệu vẫn còn.

## 6. Tên miền pvh6.site
Sau khi URL Railway chạy ổn:
- Service -> Settings/Networking -> Custom Domain.
- Thêm `pvh6.site` hoặc trước tiên `app.pvh6.site`.
- Railway sẽ hiển thị các DNS record cần tạo.
- Vào DNS của TENTEN và tạo đúng các record Railway cung cấp.
- Không tự đoán CNAME/TXT; dùng đúng giá trị Railway hiển thị tại thời điểm cấu hình.

## Lưu ý SQLite
Dự án này nên chạy 1 replica/service instance khi dùng SQLite. Không scale ngang nhiều replica cùng ghi một file SQLite.
