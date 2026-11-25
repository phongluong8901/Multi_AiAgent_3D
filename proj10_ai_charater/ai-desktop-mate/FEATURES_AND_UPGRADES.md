# AI Desktop Mate - Tong Hop Tinh Nang & Lich Su Nang Cap Toan Dien

Tai lieu nay ghi nhan day du kien truc ky thuat, danh sach toan bo tinh nang, he thong tuong tac 3D va cac ban nang cap moi nhat cua ung dung **AI Desktop Mate** (Tauri v2 + Rust + Three.js + NVIDIA MicroDuck 3D Rig + VRM Manager + Local LLM Ollama + SQLite Thuan).

---

## 1. Kien Truc Thu Muc & Cac Module Ma Nguon

### A. Frontend & Engine 3D (`src/`)
- **[src/core/state.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/core/state.ts)**: Quan ly trang thai tap trung (App State), toa do nhan vat, physics state, weatherMode, activeCharacterType, TTS sound toggle, Territory Defense state.
- **[src/core/scene.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/core/scene.ts)**: Khoi tao Three.js Scene, Camera goc nhin thuan voi man hinh desktop, Renderer trong suot hoan toan khong che chan man hinh Windows.
- **[src/core/particles.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/core/particles.ts)**:
  - He thong hat 3D thoi tiet theo thoi gian thuc (mua, tuyet roi, nang gat, loc xoay, sao dem).
  - Vat the dao cu thoi tiet 3D tren troi dong bo o do cao chuan (`skyY = 232 * s`): 1 dam may giong sam set, 1 mat troi quay tia sang, 1 dam may tuyet + nguoi tuyet 3D duoi dat, 1 loc xoay gio 3D, 1 trang khuyet va sao lap lanh.
- **[src/core/rhythmAndGoose.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/core/rhythmAndGoose.ts)**:
  - Che do **Bao Ve Lanh Tho (Territory Defense Mode)**:
    - Nhan vat xam chiem (Intruder Duck): Clone 3D chinh xac cua MicroDuck voi mau sac Dark Cyber doc quyen, khong co phu kien hoac hao quang hero.
    - Kich ban 1 - Dau Kiem Duoi Dat (Ground Sword Duel): Hero Duck rut Kiem Cyber Katana 3D phat sang, luyen kiem 3 nhip kem tia lua va knockback, danh duoi ke xam pham chay khoi man hinh.
    - Kich ban 2 - Ban Sung Dia Bay UFO (Sky UFO Blaster): Ke xam pham bay den tren Dia Bay UFO 3D; Hero Duck trang bi Sung Plasma Blaster 3D, ban 3 vien dan laser huong len tieu diet UFO.
    - Hieu ung Chien Thang (Victory Banner): Hien thi thanh huy hieu ngan gon chu `WINNER`, ket hop phao hoa chuc mung va dieu nhay an mung.
- **[src/core/p2pArena.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/core/p2pArena.ts)**:
  - Engine dau truong **P2P PK, Nhay Xuyen Man Hinh (Cross-Screen Migration) & Dieu Khien Tu Xa 60s**:
    - Quan ly mo hinh 3D Peer Duck (clone MicroDuck theo mau cua may doi thu), thanh mau (HP) noi tren dau hai vit, ky nang chien dau (Kiem Cyber, Laser UFO, Sam Set, Khien hoi HP).
    - Dong bo toa do `state_sync` qua kenh TCP va tu dong an/hien nhan vat khi vit nhay xuyen mep man hinh sang may khac.
    - Giao dien Touchpad dieu khien chuot & ban phim may thua trong dung 60 giay kem nut `[Thoat Khan Cap (Alt+Q)]`.
- **[src/characters/microduck/microduckModel.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/characters/microduck/microduckModel.ts)**:
  - Mo hinh 3D robot NVIDIA MicroDuck ti mi gom: Kinh bao ho Cyber Visor mau cam, mat Camera Eye phat sang, khop co Servo kep co the lac lu xoay dau, khop hong va bo giay truot patin banh xe kep.
  - Ho tro ham `buildMicroDuckHierarchy` va `createCloneMicroDuckMesh` cho phep tao clone cho ke xam chiem voi mau tuy bien ma khong lam loan Rig nhan vat chinh.
- **[src/characters/accessories.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/characters/accessories.ts)**:
  - Phu kien 3D tu dong gan vao dau va than vit theo thoi tiet:
    - Kiem Cyber Katana va Sung Plasma Blaster trong che do chien dau.
    - Kinh ram the thao khi troi nang gat.
    - Non Noel / Len do am ap khi troi tuyet lanh.
    - Du che mua bay lo lung tren dau khi troi mua.
- **[src/backend/assistant.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/backend/assistant.ts)**:
  - Cau noi giao tiep Tro ly AI (Ollama Local LLM + Fast-Path Commands).
  - Tich hop bo doc giong noi Tieng Viet TTS (Web Speech API) co the bat/tat am thanh ngay tren HUD.
  - Tich hop bo doc tin tuc bao dien tu (Znews, CafeF, Tuoi Tre, VNExpress, VnEconomy) co the cau hinh nguon RSS thuc.
  - Tich hop bo hoc tieng Anh vo tan lay du lieu tu Open API tu vung thuc (Wordnik, Datamuse, Free Dictionary API).
  - Bo dieu phoi chay ngau nhien cac tinh nang: thoi tiet, tin tuc, hoc tieng Anh, nhay mua, bao ve lanh tho.
- **[src/backend/fileProcessor.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/backend/fileProcessor.ts)**:
  - Xu ly file keo tha (PDF, CSV, XLSX, XLS, TXT, Markdown, Anh).
  - Trinh tom tat van ban day du, khong cat cut hay mat chu.
  - Trinh tao Dashboard du lieu dang cot (Column / Bar Chart) truc quan tu cac cot phan loai va chi so so hoc cua file.
- **[src/frontend/ui.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/frontend/ui.ts)**:
  - Giao dien HUD bam theo vit, bong bong chat chu go typewriter, modal studio 3D.
  - Nut tat/bat am thanh TTS doc tieng Viet ngay canh nut an bang.
  - Hieu ung Ha Mieng Nuot File (Mouth Absorbing HUD) hien dai, cho phep chon ngay [Xem Dashboard Dang Cot] hoac [Tom Tat Chi Tiet].

### B. Backend Rust Thuan (`src-tauri/src/`)
- **`src-tauri/src/core/hitbox.rs`**: Theo doi chuot he thong toan cuc voi `GetCursorPos` cua Windows API, tu dong bat tat click-through khong che man hinh.
- **`src-tauri/src/core/windows.rs`**: Quet va xac dinh cua so dang lam viec (Foreground Active Window), tuong thich ca Chrome, VS Code, File Explorer khi dang phong to toan man hinh.
- **`src-tauri/src/backend/window_control.rs`**: Dieu khien cua so Windows: dich chuyen, co dan, thu nho, phong to theo luc day/keo cua vit.
- **`src-tauri/src/backend/telemetry.rs`**: Do thong so phan cung (CPU, RAM, GPU, Disk), Internet, Ollama, gia Bitcoin tu API.
- **`src-tauri/src/backend/p2p.rs`**: May chu TCP Socket P2P (port `39282..=39290`), giao thuc bat tay dong thuan (Handshake + 6-so Room Code), quet LAN, che do gia lap may B (Sim Peer), va Remote Control Win32 (`SetCursorPos`, `mouse_event`, `keybd_event`, `BlockInput` co watchdog bao ve <= 10s).
- **`src-tauri/src/backend/memory.rs`**: Co so du lieu SQLite noi tuyen su dung truc tiep `winsqlite3.dll` co san tren Windows, luu lich su chat, thoi quen va ho so nguoi dung.

---

## 2. Danh Sach Tinh Nang & Nang Cap Chi Tiet

### A. Tinh Nang Bao Ve Lanh Tho (3D Territory Defense)
- **Co che kich hoat**: Tu dong qua bo chay ngau nhien, nut bam `#btn-act-defend` tren bang hanh dong phai, hoac chat nhanh ("bao ve lanh tho", "dau kiem", "ban ufo", "duoi vit").
- **Ke xam chiem (Intruder)**:
  - La clone 3D nguyen ban cua MicroDuck voi tone mau Dark Cyber (xam kim loai, do/tim toi), khong duoc huong cac hieu ung phu kien hay hao quang anh sang.
  - Xam nhap vao man hinh tu mep trai hoac mep phai.
- **Kich ban 1 - Chien dau Duoi Dat voi Kiem 3D (Ground Sword Duel)**:
  - Hero Duck tu dong rut Kiem Cyber Katana 3D phat sang.
  - Lao nhanh ve phia ke xam chiem, thi trien don danh combo 3 nhip kem tia lua va hieu ung day lui (Knockback).
  - Ke xam chiem bi chong vang va quay cuong thao chay khoi man hinh.
- **Kich ban 2 - Tac chien Tren Khong ban Dia Bay UFO (Sky UFO Blaster)**:
  - Ke xam chiem lai Dia Bay UFO 3D bay lo lung o do cao tren khong.
  - Hero Duck rut Sung Plasma Blaster 3D, huong mui sung len tren va ban lien tuc 3 tia dan Laser sang ruc.
  - Tia laser trung dia bay gay no, UFO boc khoi va quay cuong bay bien khoi goc man hinh.
- **Hieu ung Chien Thang (Winner)**:
  - Hien thi bang huy hieu gon gang chu `WINNER` tren dau vit.
  - Kich hoat phao hoa hat sang nhieu mau va dieu nhay an mung chien thang.

### B. He Thong Thoi Tiet & Dao Cu 3D Dong Bo Chieu Cao
- **Chuan hoa do cao bau troi**:
  - Toan bo dao cu thoi tiet duoc dua ve mot do cao chuan duy nhat `skyY = 232 * s` cach dau vit khoang khong gian hop ly, khong bi de len nguoi hoac qua xa tam mat.
  - Moi che do thoi tiet chi xuat hien 1 vat the dai dien truc quan ro rang:
    - **Troi mua (Rain)**: 1 dam may giong mau xam xanh phat tia chop kem hat mua roi doc tu tren may xuong.
    - **Troi nang (Hot/Clear)**: 1 mat troi 3D loi cam ruc ro voi 8 tia sang quay tron va vong hao quang nhiet.
    - **Troi tuyet (Cold)**: 1 dam may tuyet trang roi hoa tuyet xuong, kem 1 Nguoi Tuyet 3D dung ngay tren mat dat canh vit (co non phot, khan quang do, mui ca rot, cuc than).
    - **Troi gio (Wind)**: 1 con loc xoay gio 3D quay tron xung quanh truc.
    - **Ban dem (Night)**: 1 vang trang khuyet 3D va chum sao dem lap lanh.
- **Phu kien thoi tiet 3D tren vit**:
  - Kinh ram phong cach ngau khi nang.
  - Non Noel am ap khi lanh/tuyet.
  - Du che mua bay che tren dau khi troi mua.

### C. Keo Tha File & Giao Dien Ha Mieng Nuot File (Mouth Absorbing HUD)
- **Hieu ung ha mieng**: Khi nguoi dung keo tha file (PDF, CSV, Excel, TXT, Image) vao khu vuc man hinh cua vit, giao dien chuyen sang trang thai HUD Ha Mieng Nuot File truc quan voi mo vit mo rong hap thu du lieu.
- **Lua chon hanh dong sau khi hap thu**:
  - **[Xem Dashboard Phan Tich Cot]**: Tu dong quet cac cot du lieu cua CSV/Excel/PDF de ve Bieu do Dang Cot (Bar Chart / Column Chart) the hien ty le phan bo, cac muc cao nhat va tong chi so.
  - **[Tom Tat Chi Tiet]**: Doc toan bo van ban, tom tat y chinh day du khong bi ngat quang hay cat ngon cau chu.

### D. Cau Hinh He Thong Toan Dien, Lich Trinh & Cua So Chat Dich Trai/Phai
- **Tab Cau Hinh He Thong (`#studio-tab-system`) trong Bang Studio (`#dock-btn-studio`)**:
  - **Chuyen toan bo An/Hien giao dien, Am thanh (Voice TTS + Sound FX + Am luong) va Notification vao ben trong Cau hinh**: Giam gon thanh nut nhanh ngoai man hinh, chi giu cac nut nhanh can thiet va dua nut **Nep Mep Man Hinh (`#dock-btn-edge-peek`)** ra ngoai thanh Dock.
  - **Cau hinh Chu ky Tu dong (don vi Phut, nhap `0` de tat)**: Tuy chinh thoi gian bao lau hien 1 lan cho **Hoc Tieng Anh**, **Doc Tin Moi**, va **Thoi Tiet & Do Am**.
  - **Thoi Tiet & Do Am (API Live hoac Custom Thu Cong)**: Cho phep chon dong bo tu dong theo API (`check_weather`) hoac tu nhap che do 3D, nhiet do, do am %, khu vuc va mo ta theo y muon va luu vao SQLite.
- **Vi tri Cua so Chat Dich Trai / Phai (`chatDockSide`)**: Cua so thoai va chat (`#speech-bubble`) luon neo gon o canh Trai hoac canh Phai man hinh (khong nam giua man hinh), co nut doi ben ngay tren thanh tieu de chat va trong Cau hinh He thong.

### E. Doc Tin Tuc Trinh Báo Mới & Hoc Tieng Anh Vo Tan
- **Tin tuc tu dong (Live News)**:
  - Lay du lieu tu nguon RSS that: VNExpress, Tuoi Tre, Znews, CafeF, VnEconomy.
  - Hien thi tieu de, tom tat ngan va nut mo doc bai viet truc tiep tren trinh duyet.
  - Cho phep cau hinh them nguon bao yeu thich trong bang dieu khien.
- **Hoc Tieng Anh Vo Tan (Real English Engine)**:
  - Ket noi truc tiep cac Open API tu dien thuc te (Wordnik, Datamuse, Free Dictionary API).
  - Khong su dung du lieu gia: Moi tu vung deu co phien am IPA, dinh nghia chuan, cau vi du thuc te, tu dong nghia va nut nghe phat am chuan.
  - Ho tro lua chon theo chu de: Business, IELTS, Tech, Daily Life, Startups, Negotiation.

### F. Bo Chay Ngau Nhien (Random Feature Loop)
- **Co che hoat dong**: Hoat dong theo co che tu dong chay ngau nhien dinh ky hoac chay theo yeu cau.
- **Noi dung xoay tua ngau nhien**:
  - Tu dong thay doi thoi tiet va cap nhat phu kien 3D tuong ung.
  - Thong bao tin tuc nong moi nhat tu cac dau bao.
  - Day 1 tu vung tieng Anh moi kem vi du.
  - Kich hoat tran chien Bao ve lanh tho (Dau kiem hoac Ban dia bay UFO).
  - Bieu dien dieu nhay 3D vui nhon hoac tuong tac dap cua so man hinh.

### G. Tuong Tac Vat Ly & Day Keo Cua So Active
- Nhan dien ngay lap tuc cua so nguoi dung vua click chuot (Chrome, VS Code, Notion, File Explorer...).
- Vit co the chay den tan ria cua so va thuc hien hanh dong day (Pushing) hoac keo (Pulling) cua so voi luc co dan vat ly that.
- Tuong tac chuot: Nam keo nem vit, xoa dau, choc vit, cho an vat ly.

### H. Dau Truong P2P PK, Nhay Xuyen May & Dieu Khien Tu Xa 60s
- **Nut mo nhanh ngay tren Dock**: Nut P2P (`#dock-btn-p2p` hinh song kiem) va nut Nep Mep Man Hinh (`#dock-btn-edge-peek`) dat ngay ngoai thanh Dock nhanh (con An/Hien, Sound va Notification duoc gom vao trong Cau hinh).
- **Bao mat & Handshake Dong Thuan (Consent Flow)**:
  - Moi may khoi dong san TCP server (`IP:39282`) kem **Ma Phong 6 so ngau nhien**.
  - Khi may kia gui yeu cau ket noi dung ma phong, may nhan bat buoc phai bam **Dong Y Cho Phep Ket Noi** (qua popup thoai hoac bang P2P Arena) moi mo kenh dong bo va cho phep PK/dieu khien.
  - Co nut **Quet LAN** va nut **Gia Lap May B (Test 1 May)** de kiem thu ngay quy trinh bat tay, PK va Remote Control tren 1 may duy nhat.
- **Nhan vat nhay sang man hinh may khac (Cross-Screen State Migration)**:
  - Khi vit di cham mep trai/phai (hoac bam `Nhay Sang Man Doi Thu`), vit o may gui an di va truyen goi tin JSON `migrate_enter` + `state_sync` sang may nhan de dung lai mo hinh 3D dung mau sac o mep man hinh doi dien. Co san nut `Goi Vit Ve`.
- **Dau doi khang PK Arena & Thuong 60s Remote Control**:
  - Ky nang & Bo dieu khien PK chi kich hoat trong che do P2P (`#p2p-pk-controller`):
    - Di chuyen `A`/`D` (hoac Mui ten Trai/Phai), Nhay `W`/`Space`/`Mui ten Len`, Roi xuong khoi cua so `S`/`Mui ten Xuong`.
    - **Ten lua Jetpack (`Shift + Mui ten Len`)**: Kich hoat ten lua sau lung bay cao va dap len cac cua so desktop cua may chu phong.
    - **Truot nhanh (`Shift + Mui ten Trai/Phai`)**: Luot patin toc do cao kem khoi drift de ne don & tranh dan.
    - **Khien chan dan 3D (`Giu Ctrl`)**: Dung vong khien nang luong 3D bao ve vit, chan 100% sat thuong dan/laser ban toi (`0 DMG`).
    - **Ho Den An (`Phim B`)**: Mo ho den khong gian de an nap vao ben trong cua so cua may chu phong va dot kich bat ngo.
    - **Ban theo huong chuot (`Click chuot` / Phim `2`)**: Tam ngam crosshair theo con tro chuot ban dan ve dung huong chi (9-11 DMG, sat thuong thap hon Chem Kiem Cyber 22-26 DMG va Sam Set 25-29 DMG).
  - **Ban do Cua so Chu phong (Host Desktop Window Map)**: He thong dong bo toa do cac cua so dang mo cua Host (`map_windows`) cho may khach va Mobile Web, cho phep nhay, dung ten lua hoac dung ho den an ngay tren cac cua so do.
  - **Tam dung hieu ung tu dong khi P2P**: Trong phien P2P, toan bo hieu ung thoi tiet, nhay theo nhac, tuong tac ngau nhien va thong bao chu dong duoc tam tat de tap trung chien dau.
  - **May Thang (60 giay)**: Mo khoa bang Touchpad dieu khien chuot tu xa theo thoi gian thuc (`SetCursorPos` + `mouse_event` trai/phai), hop thoai go phim sang may thua, mo Notepad treu choc, xoay chuot 4s, thu nho cua so (`Win+D`), hoac khoa cung thao tac chuot/phim tam thoi (`BlockInput` toi da 8s).
  - **May Thua**: Hien thi banner dem nguoc 60s va luon co nut **Thoat Khan Cap (Alt+Q)** cung bo tu nha an toan tren Rust backend.
- **Ho Tro Dien Thoai Qua Trinh Duyet Web (Mobile Web Arena - Khong Can Cai App)**:
  - Cong TCP `39282` hoat dong o che do kep (Dual-Mode TCP + HTTP Server), phuc vu giao dien Web Arena tu [mobile_web.html](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src-tauri/src/backend/mobile_web.html).
  - Dien thoai cung Wi-Fi chi can mo link `http://<IP_May_Tinh>:<Port>` (co nut `Copy Link Mobile` san trong modal), nhap ma phong 6 so va cho chu may tinh bam **Dong Y**.
  - Mobile xem duoc arena va ban do cua so PC truc tiep tren canvas, dung D-Pad / Ten Lua / Truot Nhanh / Khien Chan Dan / Ho Den An, cham canvas de ban theo huong chi, va neu Mobile thang se mo Touchpad vuot cham dieu khien chuot + ban phim PC trong 60 giay!

### I. Dong Goi & Phan Phoi Offline Hoan Toan
- **Build doc lap `custom-protocol`**: [Cargo.toml](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src-tauri/Cargo.toml) da kich hoat feature `custom-protocol` de nhung truc tiep `../dist` vao file `.exe` release ma khong can dev server `localhost:1420`.
- **File thuc thi Release**: `src-tauri/target/release/Duck ai Manager.exe`.
- **Goi phan phoi doc lap**: `dist-package/Duck_ai_Manager_v1.0.0/` chua day du tap tin va file nen `Duck_ai_Manager_v1.0.0.zip`.

### J. Cau Hinh He Thong Toan Dien, Dock Toi Gian & Chat Di Theo Nhan Vat
- **Tab Cau Hinh He Thong (`#studio-tab-system`)**: Tap trung toan bo thiet lap An/Hien giao dien (`F2`), Thong bao & Dashboard (`Notification`), Am thanh (`Voice TTS` + `Sound FX` + am luong), va vi tri khung Chat (`Theo nhan vat ben Trai / ben Phai` voi tu dong lat phia khi cham mep man hinh + nut dao nhanh `#btn-toggle-chat-side`).
- **Lap lich Quet Radar 3D Tu Dong theo phut (0 = Tat)**: Ho tro 5 bo hen doc lap kem hieu ung Radar 3D (`RADAR` + `show3DRadar` + `spawnScanEffect`) truoc khi hien thi du lieu: **Hoc Tieng Anh**, **Doc Tin Tuc Moi**, **Thoi Tiet / Do Am**, **Hieu Nang App (CPU/RAM)**, va **Gia Bitcoin (BTC)** (`src-tauri/src/backend/memory.rs` luu SQLite + [assistant.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/backend/assistant.ts)).
- **Thoi tiet & Do am API / Custom**: Cho phep dong bo Live qua API thoi tiet hoac tu set gia tri Custom (Che do `Nang / Mua / Lanh / Gio / Ban dem / Quang dang`, Nhiet do C, Do am %, Dia diem, Mo ta) dong bo truc tiep vao hieu ung 3D.
- **Quick Dock gon gang**: Dua nut **Nep Mep Man Hinh (`#dock-btn-edge-peek`)** ra ngoai thanh Dock nhanh canh Chat / P2P / Studio.

### K. Dong Bo Ty Le Mo Hinh (`modelScale`), Du Cua So & Nang Luong PK P2P
- **Map 100% theo `appState.modelScale`**: Toan bo hieu ung thoi tiet 3D (may, mua, tuyet, set, gio xoai, mat troi, trang sao + scale khoi tao tuc thi), nhay du (`parachute`), ten lua Jetpack, Radar 3D, can cau app, thuc an, ho den khong gian, thang leo, song xung kich, hat va cham, ho boi 3D (`waterPool.ts`), khien chan dan & vit P2P (`p2pArena.ts`), cung hieu ung random (`particles.ts`) deu co dan dong bo theo ty le nhan vat (`microduck`, `idol`, `VRM`, `GLB`).
- **Thu gon bang P2P khi PK & He thong Nang luong + Do an PK**:
  - Khi tran dau PK (`pk_duel`) bat dau, hop thoai `#p2p-arena-panel` tu dong thu gon (`#btn-minimize-p2p` / `#btn-p2p-expand-modal`) de khoi vuong tam nhin; thanh dieu khien noi `#p2p-pk-controller` tich hop san thanh Nang luong & nut mo lai bang P2P, va tu dong mo lai bang WINNER 60s khi chien thang.
  - Bo sung **Thanh Nang Luong PK (`0-100 EN`)** hien thi tren HUD noi tren dau 2 vit, bang PK va Web Mobile: Ban (`-14 EN`), Truot nhanh `Shift+Trai/Phai` (`-20 EN`), Ten lua `Shift+Len` (`-8 EN` kich hoat va `-28 EN/s` khi bay).
  - Tu dong roi **Do an 3D (+40 EN)** tren san va tren cac cua so desktop cua chu phong (dong bo 2 chieu voi may khach va Mobile Web) de 2 ben nhat hoi nang luong trong khi chien dau.
- **Du cua so (`SWINGING_WINDOW`) & Vat ly nga dap mong (`BUTT_PLANT`)** ([windowSwing.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/physics/windowSwing.ts)):
  - Nhan vat moc ra hai canh tay cyber keo dai linh hoat tu hai vai, bam chat vao mep tren cua so dang mo (hoac tu tao thanh xa khong trung neu khong co cua so), va du qua lai kieu con lac giua 4 diem bam tu mep nay sang mep kia.
  - Khi ra sat mep ngoai, tay tuot khoi thanh tua khien nhan vat xoay nguoi roi tu do xuong san, dap mong manh (`BUTT_PLANT`) voi hieu ung nen/gian vat ly (`squash/stretch`), khoi bui, song xung kich va vong sao chong mat quay tren dau truoc khi bat day tiep tuc hoat dong.
  - Ho tro kich hoat qua nut **Du Cua So & Dap Mong (`#btn-act-swing`)**, hieu ung ngau nhien (`triggerRandomFeatureOrEffect`), auto-roam khi co cua so noi, hoac lenh chat nhanh (`du cua so`, `dap mong`).

### L. Cong Cu Cat Vung OCR & Dich Thuat, Dashboard Bieu Do Chuyen Gia, Hop Thoai Dieu Khien May Tinh & Ma Tran Hanh Vi Tu Dong
- **Tool OCR Cat Vung & Dich Thuat Da Ngon Ngu** ([ocrTranslateModal.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/frontend/components/ocrTranslateModal.ts), `ocr_screen_region` & `translate_text_quick` trong [pc_control.rs](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src-tauri/src/backend/pc_control.rs)):
  - Gom gon ngay ben trong hop thoai Dieu khien May tinh (`#pc-control-modal` -> nut `#btn-pc-ocr-region`, khong de thua nut ben ngoai Dock) va ho tro goi nhanh qua chat (`cat vung ocr`, `dich vung man hinh`).
  - Keo chuot khoanh vung bat ky tren man hinh Windows (DPI-aware, tu phong to 2x bicubic cho chu nho) -> Windows OCR trich xuat van ban -> tu dong dich sang Tieng Viet, English, Tieng Nhat, Tieng Han, Tieng Trung, Tieng Phap kem du phong dich AI Hybrid (`translateTextWithAi`). Ho tro sua text goc, Copy Goc/Ban Dich, Doc To TTS, va dua vao Chat.
- **Dashboard Phan Tich File Chuyen Gia So Lieu** ([dataChartEngine.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/frontend/components/dataChartEngine.ts)):
  - Khi keo tha PDF, CSV, Excel, JSON, TXT vao vit, Dashboard tu dong phan tich kieu du lieu tung cot, de xuat bieu do toi uu (`[De xuat]`) va tinh **Expert Insights** (Xu huong tang/giam, Trung binh, Trung vi, Do lech chuan, Diem ngoai lai `+/-2 SD`, va cap cot tuong quan Pearson `r` manh nhat).
  - Ho tro chuyen doi 6 loai bieu do SVG tuong tac co hover tooltip: **Cot**, **Duong (Xu huong)**, **Tron / Donut (Ty trong)**, **Radar (Da chieu)**, **Phan tan Scatter + Duong hoi quy (Chon truc X/Y)**, va **Phan phoi Histogram**.
- **Tach Rieng Hop Thoai Dieu Khien May Tinh, Google & OCR** ([pcControlModal.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/frontend/components/pcControlModal.ts)):
  - Tach toan bo nhom Dieu khien May tinh ra khoi [rightActionPanel.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/frontend/components/rightActionPanel.ts) thanh hop thoai rieng `#pc-control-modal` mo tu nut `#dock-btn-pc-control` ngoai thanh Dock nhanh.
  - Bo sung khung **Tim kiem Google nhanh (`#input-pc-google-query`)**, nut **Mo Google (`#btn-pc-google`)**, **Cat Vung OCR & Dich (`#btn-pc-ocr-region`)**, cung day du cong cu chup anh, Don RAM, Port, Git, Clipboard, Media, Do sang.
- **Ma Tran Hanh Vi Tu Dong (21 Tuong Tac Nhan Vat) & Chu Ky 15 Giay/Hanh Dong** ([types.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/core/types.ts), [physics.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/physics/physics.ts), [studioModal.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/frontend/components/studioModal.ts)):
  - Khai bao day du 21 tuong tac nhan vat cho phep **Bat / Tat tung hanh vi doc lap** trong `Studio 3D -> Vat Ly 3D -> Hanh Vi Tu Dong`: Di dao, Gap nguoi luot banh xe, Vay tay chao, Nhay Idol, Lon nhao 360, Xoay tit Turbo, Quet Radar 3D, Ngu dong, Tha do an, Doi phu kien 3D, Hieu ung 3D, Rocket & Nhay du, Ho Den, Nhay cua so, Du cua so & Dap mong, Day & Co gian cua so, Ho Boi 3D, Bao ve lanh tho, Vit tinh nghich Goose Mode, Nhay theo nhac/go phim, Keo Icon Desktop.
  - Bo sung cau hinh **Thoi gian giua moi hanh dong (mac dinh `15s/lan`, tinh chinh `5-300s`)** kem cac nut chon nhanh `10s / 15s / 30s / 60s`, luu ben vung vao SQLite (`AvatarStudioConfig`) va `localStorage`.
- **Ket Noi Mobile Web P2P Da Luong Khong Chan & Mo Firewall LAN** ([p2p.rs](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src-tauri/src/backend/p2p.rs), [mobile_web.html](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src-tauri/src/backend/mobile_web.html), [p2pArenaModal.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/frontend/components/p2pArenaModal.ts)):
  - May chu HTTP/TCP P2P (cong `39282..=39290`) xu ly tung ket noi tren luong rieng biet (`handle_incoming_tcp_connection`), khong bi nghen boi socket preconnect hoac HTTPS/TLS probe tu trinh duyet dien thoai, ho tro them `/api/ping`, `HEAD /`, `GET /favicon.ico`, va bo loc IPv4 LAN uu tien card mang vat ly (tranh lay nham WSL/Hyper-V).
  - Giao dien Mobile Web (`http://<IP_PC>:39282/?room=<MA_PHONG>`) bo sung canh bao neu mo nham bang `file://`, tu dong phuc hoi phien khi F5, va polyfill `drawRoundRect` tuong thich Safari iOS / WebView Android. Bang P2P tren PC them nut **Test Web PC (`#btn-p2p-test-local-web`)** va **Mo Firewall LAN (`#btn-p2p-open-firewall` -> `p2p_open_firewall_port`)**.
- **Tach API Key Ra File `.env` Bao Mat Cho Git** ([.env.example](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/.env.example), [.gitignore](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/.gitignore), [llm.rs](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src-tauri/src/backend/llm.rs), [memory.rs](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src-tauri/src/backend/memory.rs)):
  - `GEMINI_API_KEY` duoc doc/ghi truc tiep tu `.env` (hoac bien moi truong) thong qua `read_env_value` / `write_env_value` / `save_gemini_api_key_env`; khong con luu plain text vao SQLite (`mate_memory.db`) hay `localStorage`.
  - `.gitignore` chan `.env`, `.env.*` (tru `.env.example`), thu muc `data/` va toan bo file `.db/.db-wal/.db-shm` de an toan khi push len Git.
- **Xuong Skill AI, Sandbox Kiem Nghiem & Tu Va Tool (Self-Healing)** ([tool_forge.rs](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src-tauri/src/backend/tool_forge.rs), [toolForge.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/backend/toolForge.ts), [toolForgeModal.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/frontend/components/toolForgeModal.ts)):
  - **Phan cong Local LLM -> Gemini + Sandbox**: Khi nguoi dung yeu cau tao tool moi ma app chua co (vd: kiem tra & dong tien trinh chiem port), Local LLM nhan dien thieu tool/kha nang viet code -> chuyen sang Gemini Architect thiet ke va viet script PowerShell/Python -> Rust chay kiem nghiem trong thu muc Sandbox co lap (`%TEMP%/duck_skill_sandbox`, xoa bien moi truong `GEMINI_API_KEY`, quet an toan tinh & khoa timeout 15s).
  - **Chi dong goi khi co kiem chung**: Nut Xac Nhan & Dong Goi Skill va command backend `tool_forge_save_skill` chi cho phep luu vao bang SQLite `custom_skills` + thu muc `data/skills/<id>/` khi hash ma nguon khop voi bien nhan `SandboxRunResult` da dat (`verified == true`).
  - **Local LLM tai su dung & Tu va khi gay (Self-Healing)**: Lan sau khi nguoi dung goi (vd: `Port 3000 dang bi ket, don giup`), Local LLM tu dong khop skill da luu, trich xuat tham so (`port: 3000, action: "kill"`) va thuc thi; neu skill bi loi luc chay, he thong tu dong gui log sang Gemini de va loi, kiem nghiem lai tren Sandbox roi moi cap nhat phien ban (`version + 1`) va chay lai cho nguoi dung.
- **Tarot & Tu Vi Van Menh 6 Gio + Hieu Ung Lat The 3D** ([tarot.rs](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src-tauri/src/backend/tarot.rs), [tarotModal.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/frontend/components/tarotModal.ts), [particles.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/core/particles.ts)):
  - **Nguon du lieu Tarot Live + Tu Vi Can Chi**: Lay la bai ngau nhien qua API cong khai `https://tarotapi.dev/api/v1/cards/random?n=1` (kem du phong 22 la Major Arcana Tieng Viet khi offline) ket hop thuat toan Julian Day tinh ngay **Can Chi & Ngu Hanh (Kim/Moc/Thuy/Hoa/Tho)**, gio Hoang dao, mau hop menh & con so may man.
  - **Phan loai 5 cap van menh**: **DAI CAT / TIEU CAT / BINH HOA / TIEU HUNG / DAI HUNG**, kem diem may man `12-98/100` va loi khuyen Cong viec, Tai loc, Tinh cam, Hoa giai bang Tieng Viet.
  - **Chu ky 6 gio / que & Hieu ung 3D**: Moi chu ky 6 gio duoc boc 1 que luu ben vung trong bang SQLite `tarot_readings` (co dong ho dem nguoc & cham sang trang thai san sang tren nut ngoai cung canh nut PK `#dock-btn-tarot`); khi boc se kich hoat 3 la bai 3D xoay tu linh va lat 180 do ngay tren dau Vit cung am thanh celestial & phan ung cam xuc 3D. Ho tro them nut **Luan Giai Sau AI (Tu Vi x Tarot)**.
- **Man Hinh Mini (Mini Screen PiP — YouTube/Web Always-on-Top & Xem An App/Tab Live)** ([mini_screen.rs](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src-tauri/src/backend/mini_screen.rs), [miniScreenPanel.ts](file:///d:/A_Self_Proj/learn_mlflow/proj10_ai_charater/ai-desktop-mate/src/frontend/components/miniScreenPanel.ts)):
  - **YouTube & Web Mini On-Demand (`duck_mini_web`, 0 MB RAM khi tat)**: Chi khoi tao WebView2 con khi nguoi dung bam Mo Mini Web (tuyet doi khong chay an luc khoi dong), ho tro YouTube/Lo-fi/YT Music/TikTok/Google/ChatGPT khong bi chan nhung, va khi dong se dieu huong `about:blank` + `destroy()` de giai phong ngay WebView2 renderer process ve 0 MB RAM.
  - **Chieu App Nền Khong Active & Che Do Xem An (`PrintWindow` + `WS_EX_LAYERED alpha=1`)**: Quet toan bo cua so app/trinh duyet ke ca cua so dang bi che khuat hoac thu nho (`[Thu nho]`), cho phep an cua so xuong nen xuyen chuot (`An App (Van Chieu)`) ma DWM/Chromium van render khung hinh live len Mini Screen, tu dong khoi phuc nguyen trang khi dung chieu / dong bang / `Alt+Q` / thoat app. Kem WebRTC 60 FPS va thanh Media Controls.
- **Che Do Sieu Nhe (Eco Mode - Mac Dinh Bat) & Giam Tai WebView2**:
  - Diep nhip FPS WebGL thong minh (`20 FPS` khi dung yen, `36 FPS` khi di chuyen/bay nhay, `0 FPS` khi an man hinh), DPR = `1`, GPU `powerPreference: 'low-power'`, va tat hieu ung `backdrop-filter: blur` gay nang DWM (`Studio 3D -> He thong -> Che do Sieu Nhe`).
  - Cat giam 85% luu luong IPC `get_desktop_state` (`380ms` o trang thai nghi), kiem tra phan cung WMI moi `90s` thay vi `15s`, bo qua cap nhat Hitbox IPC/DOM style khi vi tri Vit khong doi.

---

## 3. Huong Dan Phim Tat & Thao Tac Nhanh

- **F1**: Chup anh man hinh nhanh va luu vao thu muc Pictures.
- **F2**: An/Hien toan bo giao dien Tro ly (Boss Key / Stealth Mode).
- **F3**: Kich hoat tran chien Bao Ve Lanh Tho (Dau kiem hoac Ban UFO ngau nhien).
- **F4**: Mo cua so chon mo hinh 3D / VRM tu may tinh.
- **Keo Tha File**: Tha bat ky file PDF, CSV, Excel, TXT vao man hinh de vit nuot va phan tich.
