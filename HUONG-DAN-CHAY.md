# LIA + Qwen: chat tiếng Việt, chạy trên máy của bạn

## 1. Chuẩn bị

- Cài Node.js 24 trở lên và pnpm theo `packageManager` trong package.json.
- Cài Ollama: https://ollama.com/download/windows (Windows); macOS/Linux có trên cùng trang Download.
- Mở Ollama, sau đó mở PowerShell:

```powershell
ollama pull qwen3:8b
```

Bản model Ollama này tải khoảng 5,2 GB. Cần thêm bộ nhớ cho context và phần mềm; dung lượng file không phải tổng RAM cần dùng. Tốc độ tùy CPU/GPU/RAM. Nếu máy chạy chậm hoặc hết bộ nhớ, dùng `ollama pull qwen3:4b` và đổi OLLAMA_MODEL thành `qwen3:4b` trong `.dev.vars`.

Qwen3 có giấy phép Apache 2.0 và hỗ trợ tiếng Việt. Chạy bằng Ollama trên máy cá nhân không cần API key hay phí theo token; vẫn dùng tài nguyên và điện của máy. Sau khi đã tải model và dependencies, không cần dịch vụ LLM trả phí.

## 2. Chạy app

Giải nén ZIP. Mở PowerShell ở thư mục chứa package.json:

```powershell
pnpm install
pnpm setup:local
pnpm dev
```

`setup:local` tạo cấu hình local nếu chưa có, build app và áp dụng các migration còn thiếu vào database local. Không cần tài khoản Cloudflare và không gửi database lên cloud. Nếu bạn đã từng tự áp dụng SQL trước đây, không chạy lại migrations trùng; đây là hướng dẫn cho bản giải nén mới.

Mở bằng trình duyệt:

http://localhost:5173/

Trang đầu cho phép **Đăng nhập**, **Đăng ký** hoặc **Tiếp tục với tư cách khách**. Bản local lưu tài khoản trong D1 local, kiểm tra email trùng, băm mật khẩu bằng PBKDF2 và dùng cookie phiên HttpOnly. Đây là hệ thống tài khoản dành cho prototype; bản production vẫn nên tích hợp identity/OAuth chính thức của Vietnam Airlines.

## 3. Tài khoản local

- **Đăng ký:** email được chuẩn hóa chữ thường và phải duy nhất. Nếu email đã tồn tại, app yêu cầu đăng nhập hoặc dùng email khác.
- **Đăng nhập:** email + mật khẩu phải khớp tài khoản trong D1 local.
- **Guest:** mỗi lần bắt đầu Guest mới có một `GuestSessionID` riêng và workspace riêng.
- **Account:** mỗi user có `UserID` riêng. Trip Threads, chat, preferences, uploads và giới hạn LLM đều gắn với owner của session đó.
- Mật khẩu không được lưu plaintext. Session cookie là `HttpOnly`, `SameSite=Lax`; database chỉ lưu hash của token session.
- Sau khi thêm migration auth vào một project cũ, chạy lại `pnpm setup:local` **một lần** để tạo bảng `auth_users` và `auth_sessions`.

## 4. Cấu hình Ollama

Script tạo `.dev.vars` từ `.dev.vars.example`:

```dotenv
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b
OLLAMA_API_KEY=
```

Ollama local không cần key. Không dùng OpenAI API trong bản này. `.env.example` có cùng tên biến để tham khảo; runtime Worker local dùng `.dev.vars`. Khởi động lại `pnpm dev` sau khi đổi cấu hình.

Nếu Ollama chưa chạy, mở ứng dụng Ollama. Trên môi trường cài bằng CLI có thể dùng `ollama serve`; không chạy thêm nếu ứng dụng đã phục vụ cổng 11434.

## 5. Thử chat tiếng Việt

1. Mở My trips → một trip thread, hoặc Create a trip để tạo mới.
2. Kiểm tra Service status → Kiểm tra Ollama. `ready` chỉ xác nhận server có model; lần chat đầu có thể phải nạp model vào bộ nhớ.
3. Gõ: `Mình muốn giảm ngân sách xuống 1.100 AUD cho cả chuyến đi.`
4. LIA trả lời và tạo thẻ đề xuất. Xem các giá trị cũ/mới rồi bấm **Xác nhận cập nhật**.
5. Thử: `Tôi muốn ghế cửa sổ`, `Hành lý 23 kg mỗi người`, `Tôi muốn đi cuối năm nhưng chưa rõ ngày`.
6. Với ngày hay tiền tệ chưa rõ, LIA được hướng dẫn hỏi lại; không tự đổi VND sang AUD.

Chỉ hội thoại gần đây của trip đang mở, intent và giá mẫu được gửi tới Ollama. Sở thích hồ sơ chỉ được gửi khi bật cá nhân hóa. Model không có công cụ ghi database hay đặt vé; chỉ trả về lời nói và đề xuất được backend kiểm tra. Người dùng phải xác nhận trước khi intent thay đổi.

## 6. Kiểm tra / lỗi thường gặp

```powershell
ollama list
pnpm test:api
pnpm build
```

- `Chưa kết nối`: kiểm tra Ollama, model đã tải, `.dev.vars` và khởi động lại app.
- `model-not-installed`: chạy `ollama pull qwen3:8b` hoặc dùng đúng model name trong cấu hình.
- Chờ lâu / hết RAM: đổi sang `qwen3:4b`, đóng ứng dụng nặng; timeout chat hiện là 120 giây.
- Phản hồi JSON không hợp lệ: LIA giữ nguyên intent, hiển thị lỗi và giữ nội dung gõ để thử lại. Không chuyển âm thầm sang chatbot theo từ khóa.
- Mỗi người tối đa 6 lượt/phút và 100 lượt/ngày theo UTC. Giới hạn này bảo vệ tài nguyên demo, không phải giá hay hạn mức của Qwen. Lượt gửi lỗi sau khi gọi model vẫn tính một lượt.
- `no such table`: kiểm tra `pnpm setup:local` đã hoàn tất.

## 7. Bản online khác bản local thế nào?

Website online hiện tại không truy cập được `localhost` của máy bạn. Mã nguồn đã tích hợp Ollama, nhưng để bật chat online cần máy chủ Ollama riêng mà backend truy cập được, có kiểm soát truy cập, rồi cấu hình OLLAMA_BASE_URL trên môi trường hosted. Không mở trực tiếp Ollama không xác thực ra Internet. Không có tuyên bố hosting GPU online miễn phí.

Bản ZIP này không tự cập nhật website đã publish. Các API VNA về vé thật, OCR, Lotusmiles, theo dõi nền và thanh toán vẫn chưa kết nối. Giá và chuyến bay trong app còn là demo.

## 8. Tệp quan trọng

- `lib/llm.ts`: Ollama client, prompt tiếng Việt, JSON Schema, kiểm tra output, timeout/lỗi.
- `lib/intent-schema.ts`: kiểm tra sân bay, ngày và ngân sách.
- `app/api/state/route.ts`: lưu chat, giới hạn lượt gọi, tạo và xác nhận đề xuất.
- `app/api/llm-health/route.ts`: kiểm tra Ollama/model.
- `app/page.tsx`: giao diện chat và thẻ xác nhận.
- `drizzle/0001_previous_mercury.sql`: bảng giới hạn lượt gọi LLM.
- `tests/api-smoke.mjs`: kiểm thử route bằng SQLite và phản hồi Ollama giả lập. Không phải đánh giá chất lượng model thật.

Tại môi trường tạo bản ZIP không có Ollama/model nên chưa chạy được kiểm thử sinh câu trả lời thật. Cần thực hiện bước 4 trên máy của bạn để kiểm tra tốc độ và chất lượng tiếng Việt.

## Nguồn chính thức

- Qwen3, giấy phép và ngôn ngữ: https://qwenlm.github.io/blog/qwen3/
- Model: https://ollama.com/library/qwen3:8b
- API chat: https://docs.ollama.com/api/chat

## Cập nhật Travel Profile bảo mật

Sau khi áp dụng bản cập nhật này vào project cũ, chạy `pnpm setup:local` **một lần**. Lệnh này áp dụng migration `0004_user_profile.sql` và tự tạo `PROFILE_ENCRYPTION_KEY` trong `.dev.vars` nếu chưa có. Sau đó chạy `pnpm dev` như bình thường.

Tài khoản đăng ký phải hoàn thành Personal information trước khi dùng workspace. Ngày sinh, địa chỉ và Passport/CCCD được mã hóa AES-GCM trong D1 local; email/số điện thoại vẫn nằm trong bảng tài khoản vì chúng được dùng để đăng nhập. Không chia sẻ `.dev.vars`, không xóa `PROFILE_ENCRYPTION_KEY`, và không gửi file này lên Git.
