'use strict';

/**
 * Trộn object tuỳ chọn của người dùng lên trên bộ mặc định, đệ quy.
 *
 * v14 đã bỏ hàm này khỏi `util/Util`; stack voice kế thừa từ v12 nên vẫn cần.
 * @param {Object} def Giá trị mặc định
 * @param {Object} given Giá trị người dùng truyền
 * @returns {Object} Chính object `given`, đã được bổ sung tại chỗ
 *
 * <warn>Hàm này SỬA TRỰC TIẾP `given`, đúng như bản v13. Giữ nguyên hành vi vì
 * stack voice bám vào nó và không có cách kiểm chứng nào ngoài voice channel
 * thật — đổi ngữ nghĩa ở đây là sửa mù.</warn>
 */
function mergeDefault(def, given) {
  if (!given) return def;
  for (const key in def) {
    if (!Object.hasOwn(given, key) || given[key] === undefined) {
      given[key] = def[key];
    } else if (given[key] === Object(given[key])) {
      given[key] = mergeDefault(def[key], given[key]);
    }
  }

  return given;
}

module.exports = { mergeDefault };
