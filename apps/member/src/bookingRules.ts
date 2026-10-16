/** 15 分鐘為單位的時間選項，06:00 起，'00:00' 代表午夜 24:00 */
export const TIME_OPTIONS = (() => {
  const options = [];
  for (let h = 6; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  options.push('00:00'); // Represents midnight 24:00
  return options;
})();

/** 可選的借用日期範圍：一般使用者需 7 天前；婚禮與重要活動可預約兩年內，其餘只開放當月（15 號起含下個月） */
export const getMinMaxDates = (isAdmin: boolean, bookingType?: string) => {
  const today = new Date();
  const minDate = new Date();
  if (!isAdmin) minDate.setDate(today.getDate() + 7);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  let maxDate: Date;
  if (bookingType === '婚禮' || bookingType === '重要') {
    maxDate = new Date(today.getFullYear() + 2, today.getMonth(), today.getDate());
  } else {
    if (today.getDate() < 15) {
      maxDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else {
      maxDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    }
  }
  return { minDateStr: fmt(minDate), maxDateStr: fmt(maxDate) };
};
