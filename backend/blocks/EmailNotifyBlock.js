const BaseBlock = require('./BaseBlock');
const { sendBookingConfirmation } = require('../mailService');

/**
 * EmailNotifyBlock
 * 
 * Sends a booking confirmation email asynchronously to the user.
 */
class EmailNotifyBlock extends BaseBlock {
  async execute(context) {
    const { user, targetRooms, slots } = context;
    const userEmail = user.email;

    const allRoomNames = targetRooms.map(r => r.name).join(', ');

    // Send email notification (fired in the background, matching original behavior)
    sendBookingConfirmation(userEmail, { roomName: allRoomNames, slots });
  }
}

module.exports = EmailNotifyBlock;
