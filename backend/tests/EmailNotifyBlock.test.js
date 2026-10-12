const EmailNotifyBlock = require('../blocks/EmailNotifyBlock');
const { sendBookingConfirmation } = require('../mailService');

jest.mock('../mailService', () => ({
  sendBookingConfirmation: jest.fn(),
}));

describe('EmailNotifyBlock', () => {
  let block;

  beforeEach(() => {
    block = new EmailNotifyBlock();
    jest.clearAllMocks();
  });

  it('should format room names and call sendBookingConfirmation', async () => {
    const context = {
      user: { email: 'user@example.com' },
      targetRooms: [
        { id: 1, name: 'Main Hall' },
        { id: 2, name: 'Room 202' }
      ],
      slots: [{ date: '2026-08-01', startTime: '10:00', endTime: '12:00' }]
    };

    await block.execute(context);

    expect(sendBookingConfirmation).toHaveBeenCalledWith(
      'user@example.com',
      {
        roomName: 'Main Hall, Room 202',
        slots: [{ date: '2026-08-01', startTime: '10:00', endTime: '12:00' }]
      }
    );
  });
});
