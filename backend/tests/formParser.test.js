const { parseIntake, _internals } = require('../intake/formParser');

const ROOMS = [
  { id: 1, name: 'B2-第五教室', branch: '仁愛堂' },
  { id: 2, name: 'B1-互動區第4區塊', branch: '仁愛堂' },
  { id: 3, name: 'B1-副堂', branch: '仁愛堂' },
  { id: 4, name: 'B1-互動區-一', branch: '仁愛堂' },
  { id: 9, name: '💒 由教會分配', branch: '仁愛堂' },
  { id: 10, name: '💒 由教會分配', branch: '士林堂' },
];

const byName = (r) => (r && r.name) || null;

describe('formParser _internals', () => {
  const { parseTimeRange, parseWeekdayField, parseWeekLabelRange, dateForWeekdayInRange } = _internals;

  test('parseTimeRange 各種寫法', () => {
    expect(parseTimeRange('1500-1730')).toEqual({ start: '15:00:00', end: '17:30:00' });
    expect(parseTimeRange('15:00~17:30')).toEqual({ start: '15:00:00', end: '17:30:00' });
    expect(parseTimeRange('9:30-11:00')).toEqual({ start: '09:30:00', end: '11:00:00' });
    expect(parseTimeRange('19：30-21：30')).toEqual({ start: '19:30:00', end: '21:30:00' });
    expect(parseTimeRange('1730-1500')).toBeNull();
    expect(parseTimeRange('小組')).toBeNull();
  });

  test('parseWeekdayField', () => {
    expect(parseWeekdayField('週日')).toEqual([6]);
    expect(parseWeekdayField('三')).toEqual([2]);
    expect(parseWeekdayField('星期六')).toEqual([5]);
    expect(parseWeekdayField('週六日')).toEqual([5, 6]);
    expect(parseWeekdayField('1500')).toBeNull();
  });

  test('parseWeekLabelRange + dateForWeekdayInRange', () => {
    const r = parseWeekLabelRange('九-3(9/14-9/20) -借士林堂請在位置寫士林', 2026);
    expect(dateForWeekdayInRange(6, r)).toBe('2026-09-20'); // 週日
    expect(dateForWeekdayInRange(2, r)).toBe('2026-09-16'); // 週三

    const cross = parseWeekLabelRange('九-1(8/31-9/06)週三四特會', 2026);
    expect(dateForWeekdayInRange(0, cross)).toBe('2026-08-31'); // 週一
    expect(dateForWeekdayInRange(6, cross)).toBe('2026-09-06'); // 週日
  });
});

describe('parseIntake — 一般借用', () => {
  const payload = {
    formResponseId: 'r1',
    type: '一般借用',
    borrower: { pastoralZone: '大安6區', name: '王小明', phone: '0912345678' },
    general: {
      month: '九月份',
      weeks: [
        {
          label: '九-3(9/14-9/20) -借士林堂請在位置寫士林',
          text: [
            '週日/1500-1730/小組聚會/30/B1-4',
            '週三 1930-2130 禱告會 12 五教',
            '週六/1400-1600/區聚/40', // 沒場地
            '週日 小組', // 沒時段
          ].join('\n'),
        },
      ],
    },
  };

  const { drafts, skipped } = parseIntake(payload, ROOMS);

  test('正常行：場地/時間/人數/事由 都解析出來', () => {
    const d = drafts[0];
    expect(byName(d.room)).toBe('B1-互動區第4區塊');
    expect(d.booking_date).toBe('2026-09-20');
    expect(d.start_time).toBe('15:00:00');
    expect(d.end_time).toBe('17:30:00');
    expect(d.attendance_count).toBe(30);
    expect(d.purpose).toBe('小組聚會');
    expect(d.booking_type).toBe('一般借用');
    expect(d.needsReview).toBe(false);
  });

  test('空白分隔 + 別名場地（五教）', () => {
    const d = drafts[1];
    expect(byName(d.room)).toBe('B2-第五教室');
    expect(d.booking_date).toBe('2026-09-16');
    expect(d.attendance_count).toBe(12);
  });

  test('沒場地 → 落虛擬場地 + needsReview', () => {
    const d = drafts[2];
    expect(byName(d.room)).toBe('💒 由教會分配');
    expect(d.needsReview).toBe(true);
    expect(d.purpose).toMatch(/待人工確認/);
  });

  test('沒時段 → skipped', () => {
    expect(skipped.some((s) => s.raw === '週日 小組')).toBe(true);
  });

  test('據點只看該行文字，不看週欄位標題的「借士林堂」字樣', () => {
    expect(drafts[0].branch).toBe('仁愛堂');
  });
});

describe('parseIntake — 婚禮＆重要', () => {
  test('多行 + 事由前綴活動名稱；content 決定 booking_type', () => {
    const { drafts } = parseIntake(
      {
        type: '婚禮＆重要場地借用',
        wedding: {
          eventName: '林家婚禮',
          content: '結婚典禮',
          date: '2026-10-04',
          slotsText: '週日/1500-1730/婚禮愛宴/150/副堂',
        },
      },
      ROOMS,
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0].booking_type).toBe('婚禮');
    expect(byName(drafts[0].room)).toBe('B1-副堂');
    expect(drafts[0].purpose).toContain('【林家婚禮】');
  });

  test('特殊活動＆場地 → booking_type=重要', () => {
    const { drafts } = parseIntake(
      {
        type: '婚禮＆重要場地借用',
        wedding: { eventName: 'X', content: '特殊活動＆場地', date: '2026-10-04', slotsText: '' },
      },
      ROOMS,
    );
    expect(drafts[0].booking_type).toBe('重要');
    expect(drafts[0].needsReview).toBe(true);
  });
});

describe('parseIntake — 取消&異動', () => {
  test('一律 needsReview、booking_type=取消或異動、暫記全天', () => {
    const { drafts } = parseIntake(
      { type: '取消&異動', changeReq: { mode: '取消', cancelRoom: 'B2-第五教室', cancelReason: '延期' } },
      ROOMS,
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0].booking_type).toBe('取消或異動');
    expect(drafts[0].needsReview).toBe(true);
    expect(drafts[0].start_time).toBe('00:00:00');
    expect(drafts[0].end_time).toBe('23:59:00');
  });
});
