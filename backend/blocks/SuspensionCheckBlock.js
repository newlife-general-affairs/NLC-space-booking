const BaseBlock = require('./BaseBlock');
const BookingError = require('./BookingError');
const { isPastoralZoneSuspended } = require('../violationsStore');

/**
 * SuspensionCheckBlock
 * 
 * Verifies if the user's pastoral zone is currently suspended due to excessive violations.
 * Suspension check only applies to regular users (userRole === 'user').
 */
class SuspensionCheckBlock extends BaseBlock {
  async execute(context) {
    const { slots, user, cleanFields } = context;
    const userRole = user.role;
    const cleanPastoralZone = cleanFields.pastoralZone;

    if (userRole === 'user') {
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        const suspended = await isPastoralZoneSuspended(cleanPastoralZone, s.date);
        if (suspended) {
          throw new BookingError(
            `❌ 牧區「${cleanPastoralZone}」因上月累計扣滿 5 點或違規達 2 次，次月資格已取消，無法新增此月份 (${s.date.substring(0, 7)}) 的預約。`,
            403
          );
        }
      }
    }
  }
}

module.exports = SuspensionCheckBlock;
