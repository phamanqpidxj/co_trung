
# Web Game Nhiều Người Chơi Thời Gian Thực

Chào mừng bạn đến với dự án game nhiều người chơi! Trò chơi này cho phép người dùng đăng nhập, tạo nhân vật, và tương tác với nhau trong một thế giới ảo. Một người dùng đặc biệt với vai trò "admin" có thể chỉnh sửa bản đồ trong thời gian thực.

## Tổng Quan về Kiến Trúc

Dự án này là một ứng dụng full-stack, nghĩa là nó bao gồm cả hai phần: **frontend** (giao diện người dùng) và **backend** (máy chủ).

1.  **Frontend (Giao diện người dùng):**
    *   Được xây dựng bằng HTML, CSS, và JavaScript thuần.
    *   Bao gồm các tệp: `index.html` (đăng nhập), `create-character.html` (tạo nhân vật), `game.html` (trang game chính), `style.css` (định dạng), và `script.js` (logic phía người dùng).
    *   Phần này chạy trực tiếp trong trình duyệt của người chơi.

2.  **Backend (Máy chủ):**
    *   Được xây dựng bằng Node.js, Express, và Socket.IO.
    *   Bao gồm các tệp: `server.js` (logic máy chủ), `package.json` (quản lý thư viện), và `map.json` (lưu trữ dữ liệu bản đồ).
    *   Máy chủ có nhiệm vụ kết nối tất cả người chơi, đồng bộ hóa vị trí của họ, quản lý trò chuyện, và lưu trữ bản đồ.

**Quan trọng:** Để các tính năng nhiều người chơi và trò chuyện hoạt động, **máy chủ backend phải đang chạy**. Nếu frontend không thể kết nối đến máy chủ, nó sẽ tự động chuyển sang **"Chế độ ngoại tuyến"**, nơi chỉ có các chức năng cơ bản hoạt động.

---

## Yêu Cầu Hệ Thống

Để chạy được dự án này, bạn cần cài đặt các phần mềm sau trên máy tính của mình:

*   **Node.js:** Một môi trường để chạy JavaScript phía máy chủ. Bạn có thể tải nó từ [https://nodejs.org/](https://nodejs.org/). Việc cài đặt Node.js cũng sẽ tự động cài đặt `npm`.
*   **npm (Node Package Manager):** Một công cụ để quản lý các thư viện cần thiết cho máy chủ.

---

## Hướng Dẫn Cài Đặt và Chạy Tại Chỗ (Local)

Thực hiện các bước sau để chạy trò chơi trên máy tính của bạn.

### Bước 1: Tải và Giải Nén Mã Nguồn

Đảm bảo bạn đã có tất cả các tệp của dự án trong một thư mục trên máy tính.

### Bước 2: Cài Đặt Các Thư Viện Cần Thiết

1.  Mở một cửa sổ dòng lệnh (Terminal, Command Prompt, hoặc PowerShell).
2.  Di chuyển đến thư mục gốc của dự án (thư mục chứa tệp `server.js`).
3.  Chạy lệnh sau để cài đặt các thư viện mà máy chủ cần (Express và Socket.IO):
    ```bash
    npm install
    ```
    Lệnh này sẽ tạo một thư mục `node_modules` chứa các thư viện đã được tải về.

### Bước 3: Khởi Động Máy Chủ

1.  Trong cùng cửa sổ dòng lệnh, chạy lệnh sau:
    ```bash
    node server.js
    ```
2.  Nếu thành công, bạn sẽ thấy thông báo: `Server is running on port 3000`.
3.  **Để máy chủ chạy.** Không đóng cửa sổ dòng lệnh này.

### Bước 4: Chơi Game

1.  Mở trình duyệt web của bạn (Chrome, Firefox, v.v.).
2.  Truy cập vào địa chỉ sau:
    ```
    http://localhost:3000
    ```
3.  Trò chơi sẽ tải lên, và bạn sẽ thấy trạng thái là **"Trực tuyến"**. Bây giờ bạn có thể đăng nhập, tạo nhân vật và trải nghiệm đầy đủ các tính năng.

---

## Hướng Dẫn Đăng Nhập

*   **Người chơi thường:** Nhập bất kỳ tên người dùng nào và nhấn "Đăng nhập".
*   **Quản trị viên (Admin):**
    *   Tên đăng nhập: `admin`
    *   Mật khẩu: `123456`

Chỉ quản trị viên mới có thể thấy "Công cụ Admin" để chỉnh sửa bản đồ.

---

## Hướng Dẫn Triển Khai Lên Mạng (Deployment)

Việc chỉ tải các tệp HTML/CSS/JS lên một dịch vụ lưu trữ tĩnh (static hosting) như GitHub Pages hoặc Netlify sẽ **không hoạt động** cho các tính năng nhiều người chơi, vì các dịch vụ đó không chạy được máy chủ Node.js.

Để triển khai ứng dụng này lên mạng, bạn cần một nhà cung cấp dịch vụ lưu trữ hỗ trợ các ứng dụng Node.js, chẳng hạn như:

*   Heroku
*   Render
*   Glitch
*   Một máy chủ ảo (VPS) riêng

Quá trình triển khai thường bao gồm việc tải mã nguồn của bạn lên dịch vụ, và dịch vụ đó sẽ tự động chạy các lệnh `npm install` và `node server.js` để khởi động ứng dụng của bạn. Bạn sẽ cần cấu hình để đảm bảo cả frontend và backend đều có thể truy cập được từ cùng một địa chỉ.
