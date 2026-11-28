export const smartDropzoneModalHtml = `
  <div id="smart-dropzone-modal" class="glass-panel" style="display: none;">
    <div class="panel-header">
      <div class="panel-title" style="flex-wrap: wrap;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <span>Hộp Thả File Thông Minh</span>
        <span id="sdz-category-badge" class="badge" style="background: rgba(168, 85, 247, 0.2); border-color: rgba(192, 132, 252, 0.5); color: #e9d5ff; font-size: 9.5px;">[ĐA NĂNG]</span>
      </div>
      <button id="btn-close-smart-dropzone" class="icon-btn-tiny" type="button" title="Đóng Hộp Thả File (Esc)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div id="sdz-file-summary" class="sdz-file-summary">
      Chưa có tệp nào được thả vào.
    </div>

    <div id="sdz-param-bar" class="sdz-param-bar" style="display: none;">
      <div id="sdz-img-fmt-wrap" style="display: none; align-items: center; gap: 6px; flex: 1;">
        <span style="font-size: 11px; color: #cbd5e1; white-space: nowrap;">Đuôi ảnh đích:</span>
        <select id="sdz-img-format" class="dash-select" style="flex: 1;">
          <option value="png">.PNG (Giữ nét chuẩn)</option>
          <option value="jpg">.JPG (Nhẹ dung lượng)</option>
          <option value="ico">.ICO (Icon App Windows 128px)</option>
          <option value="bmp">.BMP (Bitmap gốc)</option>
        </select>
      </div>
      <div id="sdz-rename-wrap" style="display: none; align-items: center; gap: 6px; flex: 1;">
        <span style="font-size: 11px; color: #cbd5e1; white-space: nowrap;">Tiền tố đổi tên:</span>
        <input id="sdz-rename-prefix" class="dash-input" type="text" value="duck_item" placeholder="Nhập tiền tố..." style="flex: 1;" />
      </div>
    </div>

    <div class="dash-sub" style="margin-bottom: 7px;">Chọn thao tác bạn muốn Vịt thực hiện với tệp vừa thả:</div>
    <div id="sdz-actions-grid" class="sdz-actions-grid"></div>

    <div id="sdz-status-box" class="sdz-status-box" style="display: none;"></div>
  </div>
`;
